/// <reference types="node" />
import { readFileSync } from 'node:fs'
import * as fontkit from 'fontkit'
import { describe, expect, it } from 'vitest'
import { firstFamily, mirrorPaths, runPath } from './outline'

// A font every Linux box has, so the maths is checked against real glyph metrics.
const font = fontkit.create(readFileSync('/usr/share/fonts/truetype/liberation/LiberationSerif-Regular.ttf') as never) as fontkit.Font
const style = { size: 10, spacing: 0, anchor: 'start', baseline: null, x: 0, y: 0 }

describe('text outlining', () => {
  it('reads the family out of a CSS stack', () => {
    expect(firstFamily("'Playfair Display', Georgia, 'Times New Roman', serif")).toBe('Playfair Display')
    expect(firstFamily(null)).toBe('')
  })

  it('draws paths whose width matches the font advances', () => {
    const { d, width } = runPath(font, 'K', style)
    expect(d.startsWith('M')).toBe(true)
    const advance = font.layout('K').positions[0].xAdvance / font.unitsPerEm
    expect(width).toBeCloseTo(advance * 10, 6)
  })

  it('adds letter spacing after every glyph, as SVG does', () => {
    const plain = runPath(font, 'AB', style).width
    expect(runPath(font, 'AB', { ...style, spacing: 1 }).width).toBeCloseTo(plain + 2, 6)
  })

  it('anchors the run the way text-anchor says', () => {
    const { width } = runPath(font, 'K', style)
    const startsAt = (anchor: string) => Number(/^M(-?[\d.]+)/.exec(runPath(font, 'K', { ...style, anchor, x: 100 }).d)![1])
    // fontkit emits path data rounded to two decimals, so allow a twentieth of a user unit.
    expect(startsAt('middle')).toBeCloseTo(startsAt('start') - width / 2, 1)
    expect(startsAt('end')).toBeCloseTo(startsAt('start') - width, 1)
  })

  it('shifts a central baseline down by half the em box', () => {
    const topOf = (baseline: string | null) => Number(/^M-?[\d.]+ (-?[\d.]+)/.exec(runPath(font, 'K', { ...style, baseline, y: 50 }).d)![1])
    const half = ((font.ascent + font.descent) / 2 / font.unitsPerEm) * 10
    expect(topOf('central')).toBeCloseTo(topOf(null) + half, 1)
  })
})

describe('variable fonts', () => {
  it('looks for the uncompressed font where Google Fonts publishes it', () => {
    const [first, ...rest] = mirrorPaths('Josefin Sans')
    expect(first).toBe('https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/josefinsans/JosefinSans%5Bwght%5D.ttf')
    expect(rest).toContain('https://cdn.jsdelivr.net/gh/google/fonts@main/apache/josefinsans/JosefinSans%5Bwght%5D.ttf')
    // A family with an italic axis names the file differently.
    expect(rest).toContain('https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/josefinsans/JosefinSans%5Bital%2Cwght%5D.ttf')
    expect(mirrorPaths('EB Garamond')[0]).toContain('/ofl/ebgaramond/EBGaramond%5Bwght%5D.ttf')
  })
})
