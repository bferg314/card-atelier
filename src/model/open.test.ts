/// <reference types="node" />
import { readFileSync, writeFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { createDeck } from './presets'
import { listCards } from './resolve'
import { DeckImportError, parseDeck } from './io'
import { buildOpenDeck, OpenDeck, rasterFor } from './open'

const PNG = 'data:image/png;base64,iVBORw0KGgo='
const SCHEMA_PATH = new URL('../../docs/open-playing-cards.schema.json', import.meta.url)

function stubImages(deck: ReturnType<typeof createDeck>) {
  return Object.fromEntries([...listCards(deck).map((c) => [c.id, PNG]), ['back', PNG]])
}

describe('open playing cards', () => {
  it('builds a valid file with readable names', () => {
    const deck = createDeck()
    deck.jokers.enabled = true
    const file = OpenDeck.parse(buildOpenDeck(deck, stubImages(deck), rasterFor(deck.card, 300)))
    expect(file.cards).toHaveLength(54)
    expect(file.card).toMatchObject({ imageWidth: 750, imageHeight: 1050, dpi: 300 })
    expect(file.cards.find((c) => c.id === 'hearts-K')).toMatchObject({ name: 'King of Hearts', value: 13, suit: 'hearts', label: 'K♥' })
    expect(file.cards.find((c) => c.id === 'spades-A')?.name).toBe('Ace of Spades')
    expect(file.cards.at(-1)).toMatchObject({ kind: 'joker', name: 'Joker', suit: null, rank: null, value: null })
  })

  it('refuses to build with a missing image', () => {
    const deck = createDeck()
    const images = stubImages(deck)
    delete images['hearts-7']
    expect(() => buildOpenDeck(deck, images, rasterFor(deck.card, 150))).toThrow(/hearts-7/)
  })

  it('is rejected by the editor import with a pointer to the .deck.json', () => {
    const deck = createDeck()
    const text = JSON.stringify(buildOpenDeck(deck, stubImages(deck), rasterFor(deck.card, 150)))
    expect(() => parseDeck(text)).toThrow(DeckImportError)
    expect(() => parseDeck(text)).toThrow(/\.deck\.json/)
  })

  it('matches the published JSON Schema (run `npm run schema` to regenerate)', () => {
    const generated = JSON.stringify(z.toJSONSchema(OpenDeck, { io: 'input' }), null, 2) + '\n'
    if (process.env.UPDATE_SCHEMA) writeFileSync(SCHEMA_PATH, generated)
    expect(readFileSync(SCHEMA_PATH, 'utf8')).toBe(generated)
  })
})
