import { Deck, migrate } from './schema'
import { resolveCards } from './resolve'

export function serializeDeck(deck: Deck): string {
  const out: Deck = { ...deck, updatedAt: new Date().toISOString(), cards: resolveCards(deck) }
  return JSON.stringify(out, null, 2)
}

export class DeckImportError extends Error {}

/** Parse and validate a deck file. Throws DeckImportError with a readable message on failure. */
export function parseDeck(text: string): Deck {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    throw new DeckImportError('That file is not valid JSON.')
  }
  if (!raw || typeof raw !== 'object' || (raw as { format?: unknown }).format !== 'playing-card-deck') {
    throw new DeckImportError('That file is not a playing card deck (missing "format": "playing-card-deck").')
  }
  try {
    raw = migrate(raw)
  } catch (e) {
    throw new DeckImportError((e as Error).message)
  }
  const result = Deck.safeParse(raw)
  if (!result.success) {
    const lines = result.error.issues.slice(0, 5).map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`)
    throw new DeckImportError(`The deck file has problems:\n${lines.join('\n')}`)
  }
  const { cards: _ignored, ...deck } = result.data
  return deck
}

export function fileNameFor(deck: Deck): string {
  const slug = deck.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'deck'
  return `${slug}.deck.json`
}

export function downloadDeck(deck: Deck): void {
  const blob = new Blob([serializeDeck(deck)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileNameFor(deck)
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
