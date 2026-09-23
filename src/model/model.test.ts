import { describe, expect, it } from 'vitest'
import { createDeck, THEMES } from './presets'
import { DeckImportError, fileNameFor, normalizeDeck, parseDeck, serializeDeck } from './io'
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
    const box = artBox(createDeck().card, createDeck().artFrame)
    expect(box.w).toBeCloseTo(40.5)
    expect(ratioAdvice(box.w, box.h)).toMatchObject({ preset: '2:3', cropAxis: 'sides' })
    expect(ratioAdvice(box.w, box.h / 2).preset).toBe('5:4')
    expect(ratioAdvice(63.5, 88.9)).toMatchObject({ preset: '5:7', cropAxis: 'none' })
  })
})

describe('art prompt', () => {
  it('names the card, the slot composition and the shape', () => {
    const box = artBox(createDeck().card, createDeck().artFrame)
    const advice = ratioAdvice(box.w, box.h / 2)
    const text = artPrompt({ area: 'half', subject: cardSubject({ id: 'K', label: 'K' }, 'Hearts'), court: true, advice, colors: ['#c0162c'] })
    expect(text).toContain('the King of Hearts')
    expect(text).toContain('head to the waist')
    expect(text).toContain('#c0162c')
    expect(text).toContain('Aspect ratio 5:4 landscape, at least 480 × 390 px.')
  })
})

describe('rank lettering', () => {
  it('fills defaults for decks saved before lettering existed, and round trips changes', () => {
    const deck = createDeck()
    const old = JSON.parse(serializeDeck(deck))
    for (const r of old.ranks) delete r.lettering
    const loaded = parseDeck(JSON.stringify(old))
    expect(loaded.ranks[10].lettering).toEqual({ corner: { scale: 1, x: 0, y: 0 }, monogram: { scale: 1, y: 0 } })

    loaded.ranks[10].lettering.monogram = { scale: 1.2, y: -3 }
    expect(parseDeck(serializeDeck(loaded)).ranks[10].lettering.monogram).toEqual({ scale: 1.2, y: -3 })
  })
})

describe('art frame', () => {
  it('sizes the window from the frame margins and scales them with the card', () => {
    const deck = createDeck()
    expect(artBox(deck.card, deck.artFrame)).toMatchObject({ x: 11.5, y: 11.5, w: 40.5 })
    deck.artFrame.marginXMm = 20
    deck.artFrame.marginYMm = 5
    expect(artBox(deck.card, deck.artFrame)).toMatchObject({ x: 20, y: 5, w: 23.5, h: 78.9 })
    // tarot is wider, so the same margins grow with the card
    deck.card.widthMm = 70
    deck.card.heightMm = 120
    expect(artBox(deck.card, deck.artFrame).x).toBeCloseTo(22.05)
  })

  it('keeps a window even with margins larger than the card', () => {
    const deck = createDeck()
    deck.artFrame.marginXMm = 28
    deck.artFrame.marginYMm = 40
    const box = artBox(deck.card, deck.artFrame)
    expect(box.w).toBeGreaterThan(0)
    expect(box.h).toBeGreaterThan(0)
  })
})

describe('court cards without a picture', () => {
  it('defaults to the monogram and round trips the other choices', () => {
    const deck = createDeck()
    expect(deck.courtCentre).toBe('monogram')
    deck.courtCentre = 'empty'
    expect(parseDeck(serializeDeck(deck)).courtCentre).toBe('empty')
    // decks saved before the setting existed keep the monogram
    const old = JSON.parse(serializeDeck(deck))
    delete old.courtCentre
    expect(parseDeck(JSON.stringify(old)).courtCentre).toBe('monogram')
  })
})

describe('decks read back from storage', () => {
  it('fills fields added since the deck was saved, even when it no longer validates', () => {
    const stored = JSON.parse(serializeDeck(createDeck())) as Record<string, unknown>
    delete stored.courtCentre
    delete stored.artFrame
    // Something the schema rejects, so the strict parse cannot rescue it.
    ;(stored.card as Record<string, unknown>).widthMm = 'oops'
    const deck = normalizeDeck(stored as never)
    expect(deck.courtCentre).toBe('monogram')
    expect(deck.artFrame.shape).toBe('rect')
    // Whatever the deck did say is left alone, including the odd value.
    expect(deck.name).toBe('Classic Deck')
    expect(deck.card.widthMm).toBe('oops')
  })
})
