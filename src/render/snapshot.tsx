import { renderToStaticMarkup } from 'react-dom/server'
import type { Deck } from '../model/schema'
import { listCards } from '../model/resolve'
import { usedFamilies } from '../model/fontsync'
import { buildOpenDeck, canonicalJson, rasterFor, type OpenDeck } from '../model/open'
import { googleFontCssUrl, SYSTEM_FONTS } from '../fonts/fonts'
import { CardSvg } from './CardSvg'
import { readAsDataUrl } from '../model/images'
import { sha256, sha256Bytes } from '../model/sha256'
import { dataUriBytes, toBase64 } from '../model/zip'
import { loadFonts, outlineSvg } from './outline'

export interface SnapshotResult {
  file: OpenDeck
  /** Families that could not be embedded or outlined, so those cards fell back to another typeface. */
  missingFonts: string[]
}

export interface SnapshotOptions {
  dpi: number
  bleedMm: number
  /** Which pictures to produce: rendered PNGs, vector SVGs with the text outlined, or both. */
  images: 'png' | 'svg' | 'both'
}

/** Render every card and the back, and assemble an Open Playing Cards file. */
export async function snapshotDeck(deck: Deck, options: SnapshotOptions, onProgress: (done: number, total: number) => void): Promise<SnapshotResult> {
  const { dpi, bleedMm, images: want } = options
  const raster = rasterFor(deck.card, dpi, bleedMm)
  const wantPng = want !== 'svg'
  const wantSvg = want !== 'png'
  const { css, missing } = await fontFaces(deck)
  const warnings = new Set(wantPng ? missing : [])
  const { fonts, missing: unoutlined } = wantSvg ? await loadFonts(deck) : { fonts: new Map(), missing: [] }
  const targets = [...listCards(deck), 'back' as const]
  const pngs: Record<string, string> = {}
  const vectors: Record<string, string> = {}

  for (const [i, card] of targets.entries()) {
    onProgress(i, targets.length)
    const id = card === 'back' ? 'back' : card.id
    const markup = renderToStaticMarkup(<CardSvg deck={deck} card={card} bleedMm={bleedMm} idPrefix={id} />)
    if (wantPng) pngs[id] = await rasterize(markup, css, raster.width, raster.height)
    if (wantSvg) {
      const { svg, missing: unread } = outlineSvg(vectorRoot(markup, deck, bleedMm), fonts)
      unread.forEach((f) => warnings.add(f))
      // Text that could not be outlined still needs its font, so those cards carry it.
      vectors[id] = svgDataUri(unread.length ? withFonts(svg, css) : svg)
    }
    // Give the browser a frame so the progress text repaints.
    await new Promise((r) => setTimeout(r))
  }
  onProgress(targets.length, targets.length)
  if (wantSvg) unoutlined.forEach((f) => warnings.add(f))

  const draft = buildOpenDeck(deck, { images: pngs, vectors }, raster)
  const digests = new Map<string, string>()
  const digest = (ref: string) => {
    let hash = digests.get(ref)
    if (!hash) digests.set(ref, (hash = sha256Bytes(dataUriBytes(ref))))
    return hash
  }
  const file = buildOpenDeck(deck, { images: pngs, vectors }, raster, { contentHash: sha256(canonicalJson(draft, digest)), createdAt: draft.createdAt })
  return { file, missingFonts: [...warnings] }
}

/** The vector card: real millimetre size for print tools, viewBox for anything that scales it. */
function vectorRoot(markup: string, deck: Deck, bleedMm: number): string {
  const w = deck.card.widthMm + 2 * bleedMm
  const h = deck.card.heightMm + 2 * bleedMm
  return markup.replace(/^<svg /, `<svg width="${round(w)}mm" height="${round(h)}mm" `)
}

const round = (v: number) => Number(v.toFixed(2))

function withFonts(svg: string, css: string): string {
  return svg.replace(/^(<svg[^>]*>)/, `$1<style>${css}</style>`)
}

function svgDataUri(svg: string): string {
  return 'data:image/svg+xml;base64,' + toBase64(new TextEncoder().encode(svg))
}

/**
 * The card's SVG prepared for rasterising at an exact pixel size.
 *
 * `preserveAspectRatio="none"` matters: the pixel size is rounded from millimetres, so its ratio differs from the
 * card's by a fraction of a percent, and the default "meet" would letterbox the drawing by a twentieth of a pixel.
 * That left the outer pixel columns of a bleed export partly transparent, where the spec promises opaque edges.
 * Stretching instead distorts by about 0.03%, far below anything visible.
 */
export function sizedSvg(markup: string, css: string, width: number, height: number): string {
  // An SVG drawn as an image cannot see page fonts or fetch anything, so fonts ride along as data URIs.
  return markup.replace(/^<svg /, `<svg width="${width}" height="${height}" preserveAspectRatio="none" `).replace(/^(<svg[^>]*>)/, `$1<style>${css}</style>`)
}

async function rasterize(markup: string, css: string, width: number, height: number): Promise<string> {
  const svg = sizedSvg(markup, css, width, height)
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }))
  try {
    const img = new Image()
    img.src = url
    await img.decode()
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    canvas.getContext('2d')!.drawImage(img, 0, 0, width, height)
    return canvas.toDataURL('image/png')
  } finally {
    URL.revokeObjectURL(url)
  }
}

const googleCache = new Map<string, Promise<string>>()

/** @font-face rules for every family the deck uses, with the font files inlined. */
async function fontFaces(deck: Deck): Promise<{ css: string; missing: string[] }> {
  const missing: string[] = []
  const rules: string[] = []
  for (const family of usedFamilies(deck)) {
    if (SYSTEM_FONTS.includes(family)) continue
    const source = deck.fonts.find((f) => f.family === family)
    if (source?.source === 'embedded') {
      rules.push(`@font-face{font-family:'${family}';src:url(${source.data})}`)
      continue
    }
    try {
      let pending = googleCache.get(family)
      if (!pending) {
        pending = inlineGoogleFont(family)
        googleCache.set(family, pending)
        pending.catch(() => googleCache.delete(family))
      }
      rules.push(await pending)
    } catch {
      missing.push(family)
    }
  }
  return { css: rules.join('\n'), missing }
}

async function inlineGoogleFont(family: string): Promise<string> {
  const res = await fetch(googleFontCssUrl(family))
  if (!res.ok) throw new Error(`Font stylesheet for ${family} returned ${res.status}`)
  let css = await res.text()
  const urls = [...new Set([...css.matchAll(/url\((https:[^)]+)\)/g)].map((m) => m[1]))]
  const inlined = await Promise.all(urls.map(async (u) => [u, await toDataUri(u)] as const))
  for (const [u, data] of inlined) css = css.split(u).join(data)
  return css
}

async function toDataUri(url: string): Promise<string> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`${url} returned ${res.status}`)
  return readAsDataUrl(await res.blob())
}
