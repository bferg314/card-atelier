import { describe, expect, it } from 'vitest'
import { createDeck, THEMES } from './presets'
import { DeckImportError, fileNameFor, parseDeck, serializeDeck } from './io'
import { resolveCards } from './resolve'
import { artBox, artPrompt, cardSubject, ratioAdvice } from './artbox'

describe('deck model', () => {
  it('builds 52 cards, 54 with jokers', () => {
    const deck = createDeck()
    expect(resolveCards(deck)).toHaveLength(52)
    deck.jokers.enabled = true
    const cards = resolveCards(deck)
    expect(cards).toHaveLength(54)
    expect(cards.at(-1)).toMatchObject({ kind: 'joker', suit: null })
  })

  it('round-trips through JSON for every theme', () => {
    for (const t of THEMES) {
      const deck = createDeck(t.key)
      deck.faces['hearts-K'] = { image: 'data:image/png;base64,AAAA', fit: { scale: 1.2, x: 0.1, y: 0 }, mirror: true }
      const text = serializeDeck(deck)
      const parsed = JSON.parse(text)
      expect(parsed.cards).toHaveLength(52)
      const back = parseDeck(text)
      expect(back).toEqual({ ...deck, updatedAt: back.updatedAt })
      expect(back).not.toHaveProperty('cards')
    }
  })

  it('reports readable errors', () => {
    expect(() => parseDeck('nope')).toThrow(DeckImportError)
    expect(() => parseDeck('{"a":1}')).toThrow(/not a playing card deck/)
    const bad = JSON.parse(serializeDeck(createDeck()))
    bad.suits[0].color = 'red'
    expect(() => parseDeck(JSON.stringify(bad))).toThrow(/suits\.0\.color/)
    bad.version = 99
    expect(() => parseDeck(JSON.stringify(bad))).toThrow(/newer version/)
  })

  it('slugs file names', () => {
    expect(fileNameFor({ ...createDeck(), name: 'My Fancy Deck!' })).toBe('my-fancy-deck.deck.json')
  })
})

describe('art guidance', () => {
  it('matches the poker art window to the nearest generator preset', () => {
    const box = artBox(createDeck().card)
    expect(box.w).toBeCloseTo(40.5)
    expect(ratioAdvice(box.w, box.h)).toMatchObject({ preset: '2:3', cropAxis: 'sides' })
    expect(ratioAdvice(box.w, box.h / 2).preset).toBe('5:4')
    expect(ratioAdvice(63.5, 88.9)).toMatchObject({ preset: '5:7', cropAxis: 'none' })
  })
})

describe('art prompt', () => {
  it('names the card, the slot composition and the shape', () => {
    const box = artBox(createDeck().card)
    const advice = ratioAdvice(box.w, box.h / 2)
    const text = artPrompt({ area: 'half', subject: cardSubject({ id: 'K', label: 'K' }, 'Hearts'), court: true, advice, colors: ['#c0162c'] })
    expect(text).toContain('the King of Hearts')
    expect(text).toContain('head to the waist')
    expect(text).toContain('#c0162c')
    expect(text).toContain('Aspect ratio 5:4 landscape, at least 480 × 390 px.')
  })
})
