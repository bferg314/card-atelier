import { renderToStaticMarkup } from 'react-dom/server'
import type { Deck } from '../model/schema'
import { listCards } from '../model/resolve'
import { usedFamilies } from '../model/fontsync'
import { buildOpenDeck, hashableJson, rasterFor, type OpenDeck } from '../model/open'
import { googleFontCssUrl, SYSTEM_FONTS } from '../fonts/fonts'
import { CardSvg } from './CardSvg'
import { readAsDataUrl } from '../model/images'
import { sha256 } from '../model/sha256'

export interface SnapshotResult {
  file: OpenDeck
  /** Families that could not be embedded, so the images fell back to another typeface. */
  missingFonts: string[]
}

/** Render every card and the back to PNG and assemble an Open Playing Cards file. */
export async function snapshotDeck(deck: Deck, dpi: number, bleedMm: number, onProgress: (done: number, total: number) => void): Promise<SnapshotResult> {
  const raster = rasterFor(deck.card, dpi, bleedMm)
  const { css, missing } = await fontFaces(deck)
  const targets = [...listCards(deck), 'back' as const]
  const images: Record<string, string> = {}
  for (const [i, card] of targets.entries()) {
    onProgress(i, targets.length)
    const markup = renderToStaticMarkup(<CardSvg deck={deck} card={card} bleedMm={bleedMm} />)
    images[card === 'back' ? 'back' : card.id] = await rasterize(markup, css, raster.width, raster.height)
    // Give the browser a frame so the progress text repaints.
    await new Promise((r) => setTimeout(r))
  }
  onProgress(targets.length, targets.length)
  const draft = buildOpenDeck(deck, images, raster)
  const file = buildOpenDeck(deck, images, raster, { contentHash: sha256(hashableJson(draft)), createdAt: draft.createdAt })
  return { file, missingFonts: missing }
}

async function rasterize(markup: string, css: string, width: number, height: number): Promise<string> {
  // An SVG drawn as an image cannot see page fonts or fetch anything, so fonts ride along as data URIs.
  const svg = markup.replace(/^<svg /, `<svg width="${width}" height="${height}" `).replace(/^(<svg[^>]*>)/, `$1<style>${css}</style>`)
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
