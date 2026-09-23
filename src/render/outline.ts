import * as fontkit from 'fontkit'
import type { Font } from 'fontkit'
import type { Deck } from '../model/schema'
import { googleFontCssUrl, SYSTEM_FONTS } from '../fonts/fonts'
import { listCards } from '../model/resolve'
import { dataUriBytes } from '../model/zip'

/**
 * Turning the cards' text into paths is what makes a vector card self-contained: no font to load, no family name
 * to resolve, and the same drawing in a browser, in Inkscape and at a print shop.
 */
export type FontSet = Map<string, Font>

const key = (family: string, weight: number) => `${family}:${weight}`

export interface TextStyle {
  size: number
  /** Extra space after every glyph, in user units, as SVG letter-spacing applies it. */
  spacing: number
  anchor: string
  baseline: string | null
  x: number
  y: number
}

/** One run of text as path data, positioned as SVG would have drawn it. */
export function runPath(font: Font, text: string, style: TextStyle): { d: string; width: number } {
  const scale = style.size / font.unitsPerEm
  const run = font.layout(text)
  const width = run.positions.reduce((n, p) => n + p.xAdvance, 0) * scale + style.spacing * run.glyphs.length
  const startX = style.x + (style.anchor === 'middle' ? -width / 2 : style.anchor === 'end' ? -width : 0)
  // "central" centres the em box on y; everything else sits on the baseline.
  const baselineY = style.y + (style.baseline === 'central' ? ((font.ascent + font.descent) / 2) * scale : 0)
  let pen = 0
  let d = ''
  run.glyphs.forEach((glyph, i) => {
    const path = glyph.path.scale(scale, -scale).translate(startX + pen, baselineY)
    const svg = path.toSVG()
    if (svg) d += (d ? ' ' : '') + svg
    pen += run.positions[i].xAdvance * scale + style.spacing
  })
  return { d, width }
}

/** The first real family in a CSS font stack, e.g. "'Playfair Display', Georgia, serif" → Playfair Display. */
export function firstFamily(stack: string | null): string {
  return (stack ?? '').split(',')[0].trim().replace(/^['"]|['"]$/g, '')
}

/**
 * Replace every <text> in the card with paths. Text whose font could not be read is left alone, and its family
 * is returned, so the caller can embed that font instead of silently losing the lettering.
 */
export function outlineSvg(markup: string, fonts: FontSet): { svg: string; missing: string[] } {
  const doc = new DOMParser().parseFromString(markup, 'image/svg+xml')
  const missing = new Set<string>()

  for (const text of [...doc.querySelectorAll('text')]) {
    const family = firstFamily(text.getAttribute('font-family'))
    const weight = Number(text.getAttribute('font-weight') ?? 400)
    const font = fonts.get(key(family, weight)) ?? fonts.get(key(family, 400))
    if (!font) {
      missing.add(family)
      continue
    }
    const style = {
      size: Number(text.getAttribute('font-size') ?? 16),
      spacing: Number(text.getAttribute('letter-spacing') ?? 0),
      anchor: text.getAttribute('text-anchor') ?? 'start',
      baseline: text.getAttribute('dominant-baseline'),
      x: Number(text.getAttribute('x') ?? 0),
      y: Number(text.getAttribute('y') ?? 0),
    }
    let d = ''
    for (const run of runsOf(text, style)) {
      const part = runPath(font, run.text, { ...style, x: run.x, y: run.y })
      if (part.d) d += (d ? ' ' : '') + part.d
    }
    if (!d) {
      missing.add(family)
      continue
    }
    const path = doc.createElementNS('http://www.w3.org/2000/svg', 'path')
    path.setAttribute('d', d)
    const fill = text.getAttribute('fill')
    if (fill) path.setAttribute('fill', fill)
    text.replaceWith(path)
  }

  return { svg: new XMLSerializer().serializeToString(doc), missing: [...missing] }
}

/** A <text> may hold plain text or <tspan>s that move the pen, as the joker's stacked label does. */
function runsOf(text: Element, style: TextStyle): { text: string; x: number; y: number }[] {
  const runs: { text: string; x: number; y: number }[] = []
  let x = style.x
  let y = style.y
  for (const node of [...text.childNodes]) {
    if (node.nodeType === 3) {
      const content = node.textContent ?? ''
      if (content.trim()) runs.push({ text: content, x, y })
      continue
    }
    const el = node as Element
    if (el.hasAttribute('x')) x = Number(el.getAttribute('x'))
    if (el.hasAttribute('y')) y = Number(el.getAttribute('y'))
    if (el.hasAttribute('dy')) y += Number(el.getAttribute('dy'))
    if (el.hasAttribute('dx')) x += Number(el.getAttribute('dx'))
    const content = el.textContent ?? ''
    if (content.trim()) runs.push({ text: content, x, y })
  }
  return runs
}

interface Loaded {
  font: Font | null
  /** True when the font is variable but only its default weight could be read. */
  unweighted?: boolean
}

const cache = new Map<string, Promise<Loaded>>()

export interface LoadedFonts {
  fonts: FontSet
  /** Families with no readable font file, whose text stays live. */
  missing: string[]
  /** Families drawn at their default weight because the weighted outlines could not be read. */
  unweighted: string[]
}

/** Font files for every family and weight the deck draws with. System fonts have no file, so they are reported. */
export async function loadFonts(deck: Deck): Promise<LoadedFonts> {
  const fonts: FontSet = new Map()
  const missing: string[] = []
  const unweighted: string[] = []
  const weights = [400, 700]
  for (const family of drawnFamilies(deck)) {
    if (SYSTEM_FONTS.includes(family)) {
      missing.push(family)
      continue
    }
    const source = deck.fonts.find((f) => f.family === family)
    const loaded = await Promise.all(
      // An uploaded file is one weight unless it is variable, in which case each weight is instanced from it.
      weights.map((w) => (source?.source === 'embedded' ? parse(dataUriBytes(source.data), w) : google(family, w))),
    )
    if (loaded.every((l) => !l.font)) missing.push(family)
    else if (loaded.some((l) => l.unweighted)) unweighted.push(family)
    loaded.forEach((l, i) => l.font && fonts.set(key(family, weights[i]), l.font))
  }
  return { fonts, missing, unweighted }
}

/** Families the cards actually draw with. A disabled joker's font is not worth warning about. */
function drawnFamilies(deck: Deck): Set<string> {
  const families = new Set<string>()
  for (const card of listCards(deck)) families.add(card.kind === 'joker' ? card.joker.font.family : card.suit.font.family)
  return families
}

function google(family: string, weight: number): Promise<Loaded> {
  const id = key(family, weight)
  let pending = cache.get(id)
  if (!pending) {
    pending = fetchGoogleFont(family, weight).catch(() => ({ font: null }))
    cache.set(id, pending)
  }
  return pending
}

async function fetchGoogleFont(family: string, weight: number): Promise<Loaded> {
  const res = await fetch(googleFontCssUrl(family))
  if (!res.ok) return { font: null }
  const css = await res.text()
  // Google serves one @font-face per weight and subset; take the Latin one for the weight asked for.
  const blocks = css.match(/@font-face\s*\{[^}]*\}/g) ?? []
  const block = blocks.find((b) => b.includes(`font-weight: ${weight}`) && b.includes('U+0000-00FF'))
  const url = block?.match(/url\((https:[^)]+)\)/)?.[1]
  if (!url) return { font: null }
  const file = await fetch(url)
  if (!file.ok) return { font: null }
  return parse(new Uint8Array(await file.arrayBuffer()), weight, family)
}

/**
 * Most Google families now ship one variable font for every weight, and the browser applies the weight itself.
 * fontkit can only instance a variable font from an uncompressed sfnt, and Google serves woff2, so for those
 * families the same font is fetched uncompressed from the Google Fonts repository and pinned to the weight the
 * card asks for. Without this, outlined text came out at the font's default instance: Playfair's Regular where
 * the card wanted Bold, and hairline letters for a family whose default is Thin, such as Josefin Sans.
 */
async function parse(bytes: Uint8Array, weight: number, family?: string): Promise<{ font: Font | null; unweighted?: boolean }> {
  const font = create(bytes)
  const axis = font?.variationAxes?.wght
  if (!font || !axis) return { font }
  const instanced = family ? create(await uncompressedFont(family)) : null
  const source = instanced ?? font
  const range = source.variationAxes?.wght
  if (!range) return { font: source }
  const at = source.getVariation({ wght: Math.max(range.min, Math.min(range.max, weight)) }) as Font
  // Without an uncompressed copy the outlines are the font's default weight, which is worth saying out loud.
  return { font: at, unweighted: !instanced }
}

function create(bytes: Uint8Array | null): Font | null {
  if (!bytes) return null
  try {
    const font = fontkit.create(bytes as unknown as Buffer)
    return 'layout' in font ? (font as Font) : null
  } catch {
    return null
  }
}

const MIRROR = 'https://cdn.jsdelivr.net/gh/google/fonts@main'
const uncompressed = new Map<string, Promise<Uint8Array | null>>()

/** The family's variable font as a plain .ttf, from the repository Google Fonts is published from. */
function uncompressedFont(family: string): Promise<Uint8Array | null> {
  let pending = uncompressed.get(family)
  if (!pending) {
    pending = findUncompressed(family).catch(() => null)
    uncompressed.set(family, pending)
  }
  return pending
}

/** Where a family's variable font sits in the Google Fonts repository, most likely first. */
export function mirrorPaths(family: string): string[] {
  const name = family.replace(/\s+/g, '')
  const paths: string[] = []
  for (const licence of ['ofl', 'apache', 'ufl']) {
    for (const file of [`${name}[wght].ttf`, `${name}[ital,wght].ttf`]) {
      paths.push(`${MIRROR}/${licence}/${name.toLowerCase()}/${encodeURIComponent(file)}`)
    }
  }
  return paths
}

async function findUncompressed(family: string): Promise<Uint8Array | null> {
  for (const url of mirrorPaths(family)) {
    const res = await fetch(url)
    if (res.ok) return new Uint8Array(await res.arrayBuffer())
  }
  return null
}

