import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { createDeck } from '../model/presets'
import { listCards } from '../model/resolve'
import { CardSvg } from './CardSvg'
import { sizedSvg } from './snapshot'

const deck = createDeck()
const card = listCards(deck).find((c) => c.id === 'hearts-K')!

describe('card rendering', () => {
  it('trims to the card by default, with rounded corners', () => {
    const svg = renderToStaticMarkup(<CardSvg deck={deck} card={card} />)
    expect(svg).toContain('viewBox="0 0 63.5 88.9"')
    expect(svg).toContain('rx="3.5"')
  })

  it('extends the paper into the bleed and squares the corners', () => {
    const svg = renderToStaticMarkup(<CardSvg deck={deck} card={card} bleedMm={2} />)
    expect(svg).toContain('viewBox="-2 -2 67.5 92.9"')
    // clip and paper both cover the full bleed box, and the clip is square
    expect(svg).toContain('<rect x="-2" y="-2" width="67.5" height="92.9" rx="0"')
    expect(svg).toContain(`fill="${deck.card.background}"`)
    // the card border still sits at the trim edge
    expect(svg).toContain('x="0.25" y="0.25"')
  })

  it('runs a patterned back to the bleed edge', () => {
    const plain = { ...deck, back: { ...deck.back, border: false } }
    const svg = renderToStaticMarkup(<CardSvg deck={plain} card="back" bleedMm={2} />)
    expect(svg).toContain('width="67.5" height="92.9"')
  })
})

describe('rasterised markup', () => {
  it('fills the bitmap exactly, so bleed edges stay opaque', () => {
    const markup = renderToStaticMarkup(<CardSvg deck={deck} card={card} bleedMm={2} />)
    const svg = sizedSvg(markup, '@font-face{}', 399, 549)
    // 2 mm of bleed at 150 dpi is 11.81 px, so the pixel size rounds and its ratio no longer matches the card's.
    expect(svg).toContain('width="399" height="549" preserveAspectRatio="none"')
    expect(svg).toContain('<style>@font-face{}</style>')
    expect(svg.indexOf('<style>')).toBeLessThan(svg.indexOf('<defs>'))
  })
})

describe('court cards from older decks', () => {
  it('still draws the monogram when the deck predates the setting', () => {
    const older = createDeck()
    delete (older as { courtCentre?: unknown }).courtCentre
    const king = listCards(older).find((c) => c.id === 'hearts-K')!
    const svg = renderToStaticMarkup(<CardSvg deck={older} card={king} />)
    const current = renderToStaticMarkup(<CardSvg deck={createDeck()} card={king} />)
    expect((svg.match(/>K</g) ?? []).length).toBe((current.match(/>K</g) ?? []).length)
  })

  it('names its ids after the card when one is asked for, so several cards can share a page', () => {
    const king = listCards(deck).find((c) => c.id === 'hearts-K')!
    const svg = renderToStaticMarkup(<CardSvg deck={deck} card={king} idPrefix="hearts-K" />)
    expect(svg).toContain('id="hearts-K-card"')
    expect(svg).not.toMatch(/id="c[Rr]/)
  })
})
