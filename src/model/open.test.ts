/// <reference types="node" />
import { readFileSync, writeFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { createDeck } from './presets'
import { listCards } from './resolve'
import { DeckImportError, parseDeck } from './io'
import { buildOpenDeck, canonicalJson, frenchDeckType, openJsonSchema, OpenDeck, rasterFor, toFolder } from './open'

const PNG = 'data:image/png;base64,iVBORw0KGgo='
const SVG = 'data:image/svg+xml;base64,PHN2Zz48L3N2Zz4='
const SCHEMA_PATH = new URL('../../docs/open-playing-cards.schema.json', import.meta.url)

function stubImages(deck: ReturnType<typeof createDeck>) {
  return Object.fromEntries([...listCards(deck).map((c) => [c.id, PNG]), ['back', PNG]])
}

describe('open playing cards', () => {
  it('builds a valid file with readable names', () => {
    const deck = createDeck()
    deck.jokers.enabled = true
    const file = OpenDeck.parse(buildOpenDeck(deck, { images: stubImages(deck) }, rasterFor(deck.card, 300)))
    expect(file.cards).toHaveLength(54)
    expect(file.card).toMatchObject({ imageWidth: 750, imageHeight: 1050, dpi: 300 })
    expect(file.ranks.find((r) => r.id === 'K')?.indexHeightMm).toBeCloseTo(5.04, 2)
    expect(file.cards.find((c) => c.id === 'hearts-K')).toMatchObject({ name: 'King of Hearts', value: 13, suit: 'hearts', label: 'K♥' })
    expect(file.cards.find((c) => c.id === 'spades-A')?.name).toBe('Ace of Spades')
    expect(file.cards.at(-1)).toMatchObject({ kind: 'joker', name: 'Joker 2', suit: null, rank: null, value: null })
  })

  it('refuses to build with a missing image', () => {
    const deck = createDeck()
    const images = stubImages(deck)
    delete images['hearts-7']
    expect(() => buildOpenDeck(deck, { images }, rasterFor(deck.card, 150))).toThrow(/hearts-7/)
  })

  it('is rejected by the editor import with a pointer to the .deck.json', () => {
    const deck = createDeck()
    const text = JSON.stringify(buildOpenDeck(deck, { images: stubImages(deck) }, rasterFor(deck.card, 150)))
    expect(() => parseDeck(text)).toThrow(DeckImportError)
    expect(() => parseDeck(text)).toThrow(/\.deck\.json/)
  })

  it('matches the published JSON Schema (run `npm run schema` to regenerate)', () => {
    const generated = JSON.stringify(openJsonSchema(), null, 2) + '\n'
    if (process.env.UPDATE_SCHEMA) writeFileSync(SCHEMA_PATH, generated)
    expect(readFileSync(SCHEMA_PATH, 'utf8').replace(/\r\n/g, '\n')).toBe(generated)
  })
})

describe('open format, fields for readers', () => {
  const build = (deck: ReturnType<typeof createDeck>) => buildOpenDeck(deck, { images: stubImages(deck) }, rasterFor(deck.card, 150))

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

  it('hashes the deck, not the moment or the packaging of the export', () => {
    const deck = createDeck()
    // Stand-in for the real digest: every picture here is the same one byte-for-byte.
    const digest = () => 'picture-hash'
    const a = build(deck)
    const b = buildOpenDeck(deck, { images: stubImages(deck) }, rasterFor(deck.card, 150), { createdAt: '2020-01-01T00:00:00.000Z' })
    expect(canonicalJson(a, digest)).toBe(canonicalJson(b, digest))

    // The same deck written as a folder refers to files instead of data URIs, and must still hash the same.
    const folder = OpenDeck.parse(JSON.parse(new TextDecoder().decode(toFolder(a)[0].data)))
    expect(canonicalJson(folder, digest)).toBe(canonicalJson(a, digest))

    // Key order in the written file must not matter either.
    expect(canonicalJson(reversedKeys(a) as typeof a, digest)).toBe(canonicalJson(a, digest))

    deck.suits[0].color = '#123456'
    expect(canonicalJson(build(deck), digest)).not.toBe(canonicalJson(a, digest))
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
    const file = buildOpenDeck(deck, { images: stubImages(deck) }, rasterFor(deck.card, 150))
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

describe('vector cards', () => {
  const vectors = (deck: ReturnType<typeof createDeck>) =>
    Object.fromEntries([...listCards(deck).map((c) => [c.id, SVG]), ['back', SVG]])

  it('carries a vector beside the image, or on its own', () => {
    const deck = createDeck()
    const both = OpenDeck.parse(buildOpenDeck(deck, { images: stubImages(deck), vectors: vectors(deck) }, rasterFor(deck.card, 150)))
    expect(both.cards[0]).toMatchObject({ image: PNG, vector: SVG })
    expect(both.back).toEqual({ image: PNG, vector: SVG })

    const svgOnly = OpenDeck.parse(buildOpenDeck(deck, { images: {}, vectors: vectors(deck) }, rasterFor(deck.card, 150)))
    expect(svgOnly.cards[0].image).toBeUndefined()
    expect(svgOnly.cards[0].vector).toBe(SVG)
    // Pixel measurements describe the PNGs, so a vector-only deck leaves them out and still validates.
    expect(svgOnly.card.imageWidth).toBeUndefined()
    expect(svgOnly.card.dpi).toBeUndefined()
  })

  it('refuses a card with no picture at all', () => {
    const deck = createDeck()
    expect(() => buildOpenDeck(deck, { images: {} }, rasterFor(deck.card, 150))).toThrow(/No picture/)
  })

  it('packs both file types into the folder form', () => {
    const deck = createDeck()
    const file = buildOpenDeck(deck, { images: stubImages(deck), vectors: vectors(deck) }, rasterFor(deck.card, 150))
    const names = toFolder(file).map((e) => e.name)
    expect(names).toContain('cards/hearts-K.png')
    expect(names).toContain('cards/hearts-K.svg')
    expect(names).toContain('back.svg')
    const packaged = OpenDeck.parse(JSON.parse(new TextDecoder().decode(toFolder(file)[0].data)))
    expect(packaged.cards.find((c) => c.id === 'hearts-K')?.vector).toBe('cards/hearts-K.svg')
  })

  it('says in the schema that a card needs one picture or the other', () => {
    const schema = JSON.parse(readFileSync(SCHEMA_PATH, 'utf8'))
    expect(schema.properties.cards.items.anyOf).toEqual([{ required: ['image'] }, { required: ['vector'] }])
  })
})

describe('picture references', () => {
  const ref = (v: string) => OpenDeck.safeParse({ ...valid, cards: [{ ...valid.cards[0], image: undefined, vector: v }] }).success
  const valid = buildOpenDeck(createDeck(), { images: stubImages(createDeck()) }, rasterFor(createDeck().card, 150))

  it('accepts either data URI form for SVG', () => {
    expect(ref('data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=')).toBe(true)
    expect(ref('data:image/svg+xml,%3Csvg%3E%3C/svg%3E')).toBe(true)
  })

  it('refuses paths that climb out of the deck folder', () => {
    expect(ref('cards/hearts-K.svg')).toBe(true)
    expect(ref('../../etc/passwd.svg')).toBe(false)
    expect(ref('/etc/passwd.svg')).toBe(false)
    expect(ref('cards/../../x.svg')).toBe(false)
  })
})

/** The same data with every object's keys written in the opposite order. */
function reversedKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(reversedKeys)
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .reverse()
        .map(([k, v]) => [k, reversedKeys(v)]),
    )
  }
  return value
}
