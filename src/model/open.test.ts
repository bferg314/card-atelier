/// <reference types="node" />
import { readFileSync, writeFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { createDeck } from './presets'
import { listCards } from './resolve'
import { DeckImportError, parseDeck } from './io'
import { buildOpenDeck, frenchDeckType, hashableJson, openJsonSchema, OpenDeck, rasterFor, toFolder } from './open'

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
    expect(file.cards.at(-1)).toMatchObject({ kind: 'joker', name: 'Joker 2', suit: null, rank: null, value: null })
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
    const generated = JSON.stringify(openJsonSchema(), null, 2) + '\n'
    if (process.env.UPDATE_SCHEMA) writeFileSync(SCHEMA_PATH, generated)
    expect(readFileSync(SCHEMA_PATH, 'utf8')).toBe(generated)
  })
})

describe('open format, fields for readers', () => {
  const build = (deck: ReturnType<typeof createDeck>) => buildOpenDeck(deck, stubImages(deck), rasterFor(deck.card, 150))

  it('marks a standard pack and stops marking an altered one', () => {
    const deck = createDeck()
    expect(build(deck).deckType).toBe('french-52')
    deck.jokers.enabled = true
    expect(build(deck).deckType).toBe('french-52')
    deck.suits[1].id = 'cups'
    expect(frenchDeckType(deck)).toBeUndefined()
    expect(build(deck).deckType).toBeUndefined()
  })

  it('carries identity, licence and order, and omits empty metadata', () => {
    const deck = createDeck()
    deck.license = 'CC-BY-4.0'
    deck.source = 'https://example.com/decks/classic'
    deck.jokers.enabled = true
    const file = OpenDeck.parse(build(deck))
    expect(file.deckId).toBe(deck.id)
    expect(file.$schema).toMatch(/open-playing-cards\.schema\.json$/)
    expect(file).toMatchObject({ license: 'CC-BY-4.0', source: 'https://example.com/decks/classic' })
    expect('author' in file).toBe(false)
    expect('description' in file).toBe(false)
    expect(file.cards.map((c) => c.order)).toEqual(file.cards.map((_, i) => i))
    expect(file.suits.map((s) => s.order)).toEqual([0, 1, 2, 3])
    // two jokers named the same are told apart
    expect(file.cards.slice(-2).map((c) => c.name)).toEqual(['Joker 1', 'Joker 2'])
  })

  it('hashes the deck, not the moment it was exported', () => {
    const deck = createDeck()
    const a = build(deck)
    const b = buildOpenDeck(deck, stubImages(deck), rasterFor(deck.card, 150), { createdAt: '2020-01-01T00:00:00.000Z' })
    expect(hashableJson(a)).toBe(hashableJson(b))
    deck.suits[0].color = '#123456'
    expect(hashableJson(build(deck))).not.toBe(hashableJson(a))
  })

  it('publishes a schema without generator artefacts', () => {
    const schema = JSON.parse(readFileSync(SCHEMA_PATH, 'utf8'))
    expect(JSON.stringify(schema)).not.toContain('starts_with')
    expect(schema.properties.version).toMatchObject({ type: 'integer', const: 1 })
    expect(schema.properties.card.properties.imageWidth.minimum).toBe(1)
    expect(schema.properties.createdAt.format).toBe('date-time')
    expect(schema.required).not.toContain('author')
  })
})

describe('folder packaging', () => {
  it('moves images out to files and still validates', () => {
    const deck = createDeck()
    const file = buildOpenDeck(deck, stubImages(deck), rasterFor(deck.card, 150))
    const entries = toFolder(file)
    expect(entries[0].name).toBe('deck.json')
    expect(entries.map((e) => e.name)).toContain('cards/hearts-K.png')
    expect(entries.map((e) => e.name)).toContain('back.png')
    expect(entries).toHaveLength(1 + 52 + 1)

    const packaged = OpenDeck.parse(JSON.parse(new TextDecoder().decode(entries[0].data)))
    expect(packaged.back.image).toBe('back.png')
    expect(packaged.cards.find((c) => c.id === 'hearts-K')?.image).toBe('cards/hearts-K.png')
  })
})
