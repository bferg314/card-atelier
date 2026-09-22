import { z } from 'zod'
import type { Deck } from './schema'
import { listCards, resolveCards } from './resolve'
import { cardSubject } from './artbox'
import pkg from '../../package.json'

/**
 * Open Playing Cards: a finished-deck format for games. Each card is a rendered PNG plus the few facts a game
 * needs (suit, rank, value). It holds nothing about how Card Atelier draws a card, so it stays stable when the
 * editor changes. The spec lives in docs/open-playing-cards.md; the JSON Schema is generated from this file.
 */
export const OPEN_FORMAT = 'open-playing-cards'
export const OPEN_VERSION = 1

const pngDataUri = z.string().startsWith('data:image/png;base64,').describe('PNG image as a base64 data URI.')
const hex = z.string().regex(/^#([0-9a-f]{6}|[0-9a-f]{8})$/).describe('Colour as lower-case #rrggbb, or #rrggbbaa when it has transparency.')

export const OpenCard = z.object({
  id: z.string().describe('Stable id, "<suit>-<rank>" for standard cards, e.g. "hearts-K".'),
  kind: z.enum(['standard', 'joker']),
  suit: z.string().nullable().describe('Suit id, or null for jokers.'),
  rank: z.string().nullable().describe('Rank id, or null for jokers.'),
  value: z.number().nullable().describe('Numeric rank, A = 1 to K = 13; null for jokers.'),
  label: z.string().describe('Short label, e.g. "K♥".'),
  name: z.string().describe('Readable name, e.g. "King of Hearts".'),
  color: hex.describe('Main ink colour of the card.'),
  image: pngDataUri.describe('The card face at card.imageWidth × card.imageHeight, with transparent rounded corners.'),
})

export const OpenDeck = z.object({
  format: z.literal(OPEN_FORMAT),
  version: z.literal(OPEN_VERSION),
  name: z.string(),
  author: z.string(),
  description: z.string(),
  generator: z.object({ name: z.string(), version: z.string() }).describe('What wrote the file. Informational only.'),
  createdAt: z.string().describe('ISO 8601 timestamp.'),
  card: z.object({
    widthMm: z.number(),
    heightMm: z.number(),
    cornerRadiusMm: z.number(),
    imageWidth: z.number().int().describe('Pixel width of every image in the file.'),
    imageHeight: z.number().int(),
    dpi: z.number(),
  }),
  suits: z.array(z.object({ id: z.string(), name: z.string(), symbol: z.string(), color: hex })),
  ranks: z.array(z.object({ id: z.string(), label: z.string(), value: z.number() })),
  back: z.object({ image: pngDataUri }),
  cards: z.array(OpenCard).describe('Every card in play order: suit by suit, ranks ascending, jokers last.'),
})

export type OpenDeck = z.infer<typeof OpenDeck>

export interface Raster {
  dpi: number
  width: number
  height: number
}

/** Pixel size of one card at the given resolution. */
export function rasterFor(card: Deck['card'], dpi: number): Raster {
  const px = (mm: number) => Math.round((mm / 25.4) * dpi)
  return { dpi, width: px(card.widthMm), height: px(card.heightMm) }
}

/** Assemble the file from rendered images keyed by card id, plus "back". */
export function buildOpenDeck(deck: Deck, images: Record<string, string>, raster: Raster, generator = { name: 'Card Atelier', version: pkg.version }): OpenDeck {
  const refs = listCards(deck)
  const image = (id: string) => {
    const uri = images[id]
    if (!uri) throw new Error(`No image rendered for ${id}.`)
    return uri
  }
  const cards = resolveCards(deck).map((c, i) => {
    const ref = refs[i]
    const name = ref.kind === 'standard' ? cardSubject(ref.rank, ref.suit.name).replace(/^the /, '') : titleCase(ref.joker.label)
    return { ...c, color: normalizeHex(c.color), name, image: image(c.id) }
  })
  return {
    format: OPEN_FORMAT,
    version: OPEN_VERSION,
    name: deck.name,
    author: deck.author,
    description: deck.description,
    generator,
    createdAt: new Date().toISOString(),
    card: { widthMm: deck.card.widthMm, heightMm: deck.card.heightMm, cornerRadiusMm: deck.card.cornerRadiusMm, imageWidth: raster.width, imageHeight: raster.height, dpi: raster.dpi },
    suits: deck.suits.map(({ id, name, symbol, color }) => ({ id, name, symbol, color: normalizeHex(color) })),
    ranks: deck.ranks.map(({ id, label, value }) => ({ id, label, value })),
    back: { image: image('back') },
    cards,
  }
}

function titleCase(s: string): string {
  return s.toLowerCase().replace(/(^|\s)\S/g, (m) => m.toUpperCase())
}

/** Atelier accepts #rgb and #rgba too; the open format always spells colours out in full. */
export function normalizeHex(c: string): string {
  const h = c.toLowerCase()
  return h.length === 4 || h.length === 5 ? '#' + [...h.slice(1)].map((ch) => ch + ch).join('') : h
}
