import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { createDeck } from '../model/presets'
import { listCards } from '../model/resolve'
import { CardSvg } from './CardSvg'

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
