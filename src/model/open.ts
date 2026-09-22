import { z } from 'zod'
import type { Deck } from './schema'
import { listCards, resolveCards } from './resolve'
import { cardSubject } from './artbox'
import { dataUriBytes, type ZipEntry } from './zip'
import pkg from '../../package.json'

/**
 * Open Playing Cards: a finished-deck format for games. Each card is a rendered PNG plus the few facts a game
 * needs (suit, rank, value). It holds nothing about how Card Atelier draws a card, so it stays stable when the
 * editor changes. The spec lives in docs/open-playing-cards.md; the JSON Schema is generated from this file.
 */
export const OPEN_FORMAT = 'open-playing-cards'
export const OPEN_VERSION = 1
export const OPEN_SCHEMA_URL = 'https://raw.githubusercontent.com/bferg314/card-atelier/main/docs/open-playing-cards.schema.json'

/** The well-known ids of a standard French 52-card pack, which `deckType` promises. */
export const FRENCH_SUITS = ['spades', 'hearts', 'diamonds', 'clubs']
export const FRENCH_RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K']

/** An image: a base64 PNG data URI, or a relative path when the deck is packaged as a folder. */
const imageRef = z
  .string()
  .regex(/^(data:image\/png;base64,[A-Za-z0-9+/=]+|[\w./-]+\.png)$/)
  .describe('PNG image: a base64 data: URI, or a path relative to this file when the deck is packaged as a folder.')
const hex = z
  .string()
  .regex(/^#([0-9a-f]{6}|[0-9a-f]{8})$/)
  .describe('Colour as lower-case #rrggbb, or #rrggbbaa when it has transparency.')

export const OpenCard = z.object({
  id: z.string().describe('Stable id, "<suit>-<rank>" for standard cards, e.g. "hearts-K".'),
  kind: z.enum(['standard', 'joker']),
  order: z.int().min(0).describe('Position in play order, so a shuffled or filtered hand can be sorted back.'),
  suit: z.string().nullable().describe('Suit id, or null for jokers.'),
  rank: z.string().nullable().describe('Rank id, or null for jokers.'),
  value: z.number().nullable().describe('Default ordinal for the rank, A = 1 to K = 13; null for jokers. Not a game rule.'),
  label: z.string().describe('Short label, e.g. "K♥".'),
  name: z.string().describe('Readable name, e.g. "King of Hearts".'),
  color: hex.describe('Main ink colour of the card.'),
  image: imageRef.describe('The card face at card.imageWidth × card.imageHeight, with transparent rounded corners.'),
})

export const OpenDeck = z.object({
  $schema: z.string().optional().describe('Where this file’s JSON Schema lives.'),
  format: z.literal(OPEN_FORMAT),
  version: z.literal(OPEN_VERSION),
  deckId: z.string().describe('Stable id of the deck, unchanged across exports and edits.'),
  contentHash: z.string().optional().describe('SHA-256 of this file with $schema, createdAt, generator and contentHash removed. Equal hashes mean the same deck.'),
  deckType: z.literal('french-52').optional().describe('Set when the deck is exactly a standard French pack (plus optional jokers).'),
  name: z.string(),
  author: z.string().optional(),
  description: z.string().optional(),
  license: z.string().optional().describe('How this deck may be used, ideally an SPDX id such as "CC-BY-4.0".'),
  source: z.string().optional().describe('Where the deck came from, for attribution.'),
  generator: z.object({ name: z.string(), version: z.string() }).describe('What wrote the file. Informational only.'),
  createdAt: z.iso.datetime().describe('When the file was written.'),
  card: z.object({
    widthMm: z.number().describe('Trim width of the finished card.'),
    heightMm: z.number(),
    cornerRadiusMm: z.number(),
    bleedMm: z.number().optional().describe('Extra image beyond the trim size on every side, for printing. Absent or 0 means the image is trimmed to size.'),
    imageWidth: z.int().min(1).describe('Pixel width of every image in the file, bleed included.'),
    imageHeight: z.int().min(1),
    dpi: z.number(),
  }),
  suits: z.array(z.object({ id: z.string(), name: z.string(), symbol: z.string(), color: hex, order: z.int().min(0) })),
  ranks: z.array(z.object({ id: z.string(), label: z.string(), value: z.number() })),
  back: z.object({ image: imageRef }),
  cards: z.array(OpenCard).describe('Every card in play order: suit by suit, ranks ascending, jokers last.'),
})

export type OpenDeck = z.infer<typeof OpenDeck>

export interface Raster {
  dpi: number
  width: number
  height: number
  /** Millimetres of bleed included on every side of the image. */
  bleedMm: number
}

/** Pixel size of one card at the given resolution, including any print bleed. */
export function rasterFor(card: Deck['card'], dpi: number, bleedMm = 0): Raster {
  const px = (mm: number) => Math.round((mm / 25.4) * dpi)
  return { dpi, bleedMm, width: px(card.widthMm + 2 * bleedMm), height: px(card.heightMm + 2 * bleedMm) }
}

/** "french-52" when the deck is the standard pack under the well-known ids, so a reader can rely on the mapping. */
export function frenchDeckType(deck: Deck): 'french-52' | undefined {
  const same = (a: string[], b: string[]) => a.length === b.length && a.every((v, i) => v === b[i])
  const suits = deck.suits.map((s) => s.id)
  const ranks = deck.ranks.map((r) => r.id)
  return same(suits, FRENCH_SUITS) && same(ranks, FRENCH_RANKS) ? 'french-52' : undefined
}

export interface BuildOptions {
  contentHash?: string
  generator?: { name: string; version: string }
  createdAt?: string
}

/** Assemble the file from rendered images keyed by card id, plus "back". */
export function buildOpenDeck(deck: Deck, images: Record<string, string>, raster: Raster, options: BuildOptions = {}): OpenDeck {
  const refs = listCards(deck)
  const image = (id: string) => {
    const uri = images[id]
    if (!uri) throw new Error(`No image rendered for ${id}.`)
    return uri
  }
  const jokerNames = numberDuplicates(refs.map((r) => (r.kind === 'joker' ? titleCase(r.joker.label) : '')))
  const cards = resolveCards(deck).map((c, i) => {
    const ref = refs[i]
    const name = ref.kind === 'standard' ? cardSubject(ref.rank, ref.suit.name).replace(/^the /, '') : jokerNames[i]
    return { ...c, order: i, color: normalizeHex(c.color), name, image: image(c.id) }
  })
  const file: OpenDeck = {
    $schema: OPEN_SCHEMA_URL,
    format: OPEN_FORMAT,
    version: OPEN_VERSION,
    deckId: deck.id,
    ...(options.contentHash ? { contentHash: options.contentHash } : {}),
    ...(frenchDeckType(deck) ? { deckType: 'french-52' as const } : {}),
    name: deck.name,
    ...(deck.author ? { author: deck.author } : {}),
    ...(deck.description ? { description: deck.description } : {}),
    ...(deck.license ? { license: deck.license } : {}),
    ...(deck.source ? { source: deck.source } : {}),
    generator: options.generator ?? { name: 'Card Atelier', version: pkg.version },
    createdAt: options.createdAt ?? new Date().toISOString(),
    card: {
      widthMm: deck.card.widthMm,
      heightMm: deck.card.heightMm,
      cornerRadiusMm: deck.card.cornerRadiusMm,
      ...(raster.bleedMm ? { bleedMm: raster.bleedMm } : {}),
      imageWidth: raster.width,
      imageHeight: raster.height,
      dpi: raster.dpi,
    },
    suits: deck.suits.map(({ id, name, symbol, color }, order) => ({ id, name, symbol, color: normalizeHex(color), order })),
    ranks: deck.ranks.map(({ id, label, value }) => ({ id, label, value })),
    back: { image: image('back') },
    cards,
  }
  return file
}

/** What contentHash covers: everything that describes the deck, and nothing that changes on every export. */
export function hashableJson(file: OpenDeck): string {
  const { $schema: _s, contentHash: _h, createdAt: _c, generator: _g, ...rest } = file
  return JSON.stringify(rest)
}

/** "Joker, Joker" reads as one card twice, so repeated names are numbered. */
function numberDuplicates(names: string[]): string[] {
  const counts = new Map<string, number>()
  for (const n of names) if (n) counts.set(n, (counts.get(n) ?? 0) + 1)
  const seen = new Map<string, number>()
  return names.map((n) => {
    if (!n || (counts.get(n) ?? 0) < 2) return n
    const k = (seen.get(n) ?? 0) + 1
    seen.set(n, k)
    return `${n} ${k}`
  })
}

function titleCase(s: string): string {
  return s.toLowerCase().replace(/(^|\s)\S/g, (m) => m.toUpperCase())
}

/** Atelier accepts #rgb and #rgba too; the open format always spells colours out in full. */
export function normalizeHex(c: string): string {
  const h = c.toLowerCase()
  return h.length === 4 || h.length === 5 ? '#' + [...h.slice(1)].map((ch) => ch + ch).join('') : h
}

/**
 * The published JSON Schema. Generated from the zod definition so the two cannot drift; `npm run schema`
 * writes it to docs/. The override fixes the one place zod cannot express: a literal integer version.
 */
export function openJsonSchema(): unknown {
  return z.toJSONSchema(OpenDeck, {
    io: 'input',
    override: (ctx) => {
      const s = ctx.jsonSchema as { type?: string; const?: unknown }
      if (s.const === OPEN_VERSION && s.type === 'number') s.type = 'integer'
    },
  })
}

/**
 * The same document packaged as a folder: images become relative paths and travel as their own PNG files,
 * which is what a game engine wants to load. Returns the entries ready for zip().
 */
export function toFolder(file: OpenDeck): ZipEntry[] {
  const entries: ZipEntry[] = []
  const move = (uri: string, path: string) => {
    entries.push({ name: path, data: dataUriBytes(uri) })
    return path
  }
  const folder: OpenDeck = {
    ...file,
    back: { image: move(file.back.image, 'back.png') },
    cards: file.cards.map((c) => ({ ...c, image: move(c.image, `cards/${c.id}.png`) })),
  }
  return [{ name: 'deck.json', data: new TextEncoder().encode(JSON.stringify(folder, null, 2)) }, ...entries]
}
