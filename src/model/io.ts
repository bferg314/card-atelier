import { Deck, migrate } from './schema'
import { OPEN_FORMAT } from './open'
import { resolveCards } from './resolve'
import { createDeck } from './presets'

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
  if (raw && typeof raw === 'object' && (raw as { format?: unknown }).format === OPEN_FORMAT) {
    throw new DeckImportError('That is an Open Playing Cards file, a finished export for games. It has no editing details; import the matching .deck.json instead.')
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

/**
 * Fill defaults on a deck read back from browser storage. Stored decks skip import validation, so fields added
 * since they were saved would otherwise be missing.
 *
 * A deck that fails validation used to be returned untouched, which left every newer field undefined and drew
 * cards wrong rather than loudly failing. Now its missing keys are filled from a fresh deck instead.
 */
export function normalizeDeck(stored: Deck): Deck {
  const result = Deck.safeParse(stored)
  if (result.success) {
    const { cards: _ignored, ...deck } = result.data
    return deck
  }
  console.warn('Stored deck did not match the schema; filling in defaults.', result.error.issues.slice(0, 5))
  return fillMissing(stored, createDeck()) as Deck
}

/** Copy anything the template has and the value lacks, without touching what the value already says. */
function fillMissing(value: unknown, template: unknown): unknown {
  if (Array.isArray(value) && Array.isArray(template)) {
    return value.map((item, i) => fillMissing(item, template[i] ?? template[0]))
  }
  if (isPlainObject(value) && isPlainObject(template)) {
    const out: Record<string, unknown> = { ...value }
    for (const [key, fallback] of Object.entries(template)) {
      out[key] = key in value ? fillMissing(value[key], fallback) : structuredClone(fallback)
    }
    return out
  }
  return value
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function slug(deck: Deck): string {
  return deck.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'deck'
}

export function fileNameFor(deck: Deck): string {
  return `${slug(deck)}.deck.json`
}

export function openFileNameFor(deck: Deck): string {
  return `${slug(deck)}.cards.json`
}

export function openFolderNameFor(deck: Deck): string {
  return `${slug(deck)}.cards.zip`
}

export function downloadDeck(deck: Deck): void {
  downloadJson(fileNameFor(deck), serializeDeck(deck))
}

export function downloadJson(name: string, text: string): void {
  downloadFile(name, new Blob([text], { type: 'application/json' }))
}

export function downloadFile(name: string, blob: Blob): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
