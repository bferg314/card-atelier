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

const cache = new Map<string, Promise<Font | null>>()

/** Font files for every family and weight the deck draws with. System fonts have no file, so they are reported. */
export async function loadFonts(deck: Deck): Promise<{ fonts: FontSet; missing: string[] }> {
  const fonts: FontSet = new Map()
  const missing: string[] = []
  for (const family of drawnFamilies(deck)) {
    if (SYSTEM_FONTS.includes(family)) {
      missing.push(family)
      continue
    }
    const source = deck.fonts.find((f) => f.family === family)
    if (source?.source === 'embedded') {
      const font = parse(dataUriBytes(source.data))
      if (font) {
        // An uploaded file is one weight; use it wherever that family is asked for.
        fonts.set(key(family, 400), font)
        fonts.set(key(family, 700), font)
      } else missing.push(family)
      continue
    }
    const loaded = await Promise.all([400, 700].map((w) => google(family, w)))
    if (loaded.every((f) => !f)) missing.push(family)
    loaded.forEach((font, i) => font && fonts.set(key(family, [400, 700][i]), font))
  }
  return { fonts, missing }
}

/** Families the cards actually draw with. A disabled joker's font is not worth warning about. */
function drawnFamilies(deck: Deck): Set<string> {
  const families = new Set<string>()
  for (const card of listCards(deck)) families.add(card.kind === 'joker' ? card.joker.font.family : card.suit.font.family)
  return families
}

function google(family: string, weight: number): Promise<Font | null> {
  const id = key(family, weight)
  let pending = cache.get(id)
  if (!pending) {
    pending = fetchGoogleFont(family, weight).catch(() => null)
    cache.set(id, pending)
  }
  return pending
}

async function fetchGoogleFont(family: string, weight: number): Promise<Font | null> {
  const res = await fetch(googleFontCssUrl(family))
  if (!res.ok) return null
  const css = await res.text()
  // Google serves one @font-face per weight and subset; take the Latin one for the weight asked for.
  const blocks = css.match(/@font-face\s*\{[^}]*\}/g) ?? []
  const block = blocks.find((b) => b.includes(`font-weight: ${weight}`) && b.includes('U+0000-00FF'))
  const url = block?.match(/url\((https:[^)]+)\)/)?.[1]
  if (!url) return null
  const file = await fetch(url)
  if (!file.ok) return null
  return parse(new Uint8Array(await file.arrayBuffer()))
}

function parse(bytes: Uint8Array): Font | null {
  try {
    const font = fontkit.create(bytes as unknown as Buffer)
    return 'layout' in font ? (font as Font) : null
  } catch {
    return null
  }
}
