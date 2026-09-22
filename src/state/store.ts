import { create } from 'zustand'
import { del, get, set } from 'idb-keyval'
import { createDeck, newId } from '../model/presets'
import { normalizeDeck, parseDeck } from '../model/io'
import type { Deck } from '../model/schema'
import { loadDeckFonts } from '../fonts/fonts'
import { syncFonts } from '../model/fontsync'

export interface DeckSummary {
  id: string
  name: string
  updatedAt: string
}

export type PanelKey = 'deck' | 'suits' | 'artwork' | 'back' | 'jokers'

interface State {
  deck: Deck
  ready: boolean
  selectedId: string
  showBack: boolean
  panel: PanelKey
  library: DeckSummary[]
  past: Deck[]
  future: Deck[]
  toast: { text: string; tone: 'ok' | 'error' } | null

  init(): Promise<void>
  /** Apply a change to the deck. Changes sharing a `coalesce` key within a short window become one undo step. */
  update(fn: (d: Deck) => void, coalesce?: string): void
  undo(): void
  redo(): void
  select(id: string): void
  setShowBack(v: boolean): void
  setPanel(p: PanelKey): void
  newDeck(theme: string): void
  openDeck(id: string): Promise<void>
  deleteDeck(id: string): Promise<void>
  duplicateDeck(): void
  importDeckText(text: string): void
  notify(text: string, tone?: 'ok' | 'error'): void
}

const HISTORY_LIMIT = 80
const COALESCE_MS = 700
let lastCoalesce: { key: string; at: number } | null = null
let saveTimer: ReturnType<typeof setTimeout> | undefined
let toastTimer: ReturnType<typeof setTimeout> | undefined
let initStarted = false

const KEY_LIBRARY = 'library'
const KEY_CURRENT = 'current'
const deckKey = (id: string) => `deck:${id}`

function summarize(d: Deck): DeckSummary {
  return { id: d.id, name: d.name, updatedAt: d.updatedAt }
}

export const useStore = create<State>((setState, getState) => {
  function persistSoon() {
    clearTimeout(saveTimer)
    saveTimer = setTimeout(async () => {
      const { deck, library } = getState()
      const lib = [summarize(deck), ...library.filter((l) => l.id !== deck.id)]
      setState({ library: lib })
      try {
        await set(deckKey(deck.id), deck)
        await set(KEY_LIBRARY, lib)
        await set(KEY_CURRENT, deck.id)
      } catch (e) {
        getState().notify(`Could not save to browser storage: ${(e as Error).message}`, 'error')
      }
    }, 400)
  }

  function switchTo(deck: Deck) {
    loadDeckFonts(deck.fonts)
    lastCoalesce = null
    setState({ deck, past: [], future: [], selectedId: firstCardId(deck), showBack: false })
    persistSoon()
  }

  return {
    deck: createDeck('classic'),
    ready: false,
    selectedId: 'spades-A',
    showBack: false,
    panel: 'deck',
    library: [],
    past: [],
    future: [],
    toast: null,

    async init() {
      if (initStarted) return
      initStarted = true
      try {
        const library = ((await get(KEY_LIBRARY)) as DeckSummary[] | undefined) ?? []
        const currentId = (await get(KEY_CURRENT)) as string | undefined
        const stored = currentId ? ((await get(deckKey(currentId))) as Deck | undefined) : undefined
        setState({ library })
        if (stored) {
          switchTo(normalizeDeck(stored))
        } else {
          switchTo(getState().deck)
        }
      } catch {
        switchTo(getState().deck)
      }
      setState({ ready: true })
    },

    update(fn, coalesce) {
      const { deck, past } = getState()
      const next = structuredClone(deck)
      fn(next)
      syncFonts(next)
      next.updatedAt = new Date().toISOString()
      const now = Date.now()
      const merge = coalesce && lastCoalesce && lastCoalesce.key === coalesce && now - lastCoalesce.at < COALESCE_MS
      lastCoalesce = coalesce ? { key: coalesce, at: now } : null
      loadDeckFonts(next.fonts)
      setState({
        deck: next,
        past: merge ? past : [...past, deck].slice(-HISTORY_LIMIT),
        future: [],
      })
      persistSoon()
    },

    undo() {
      const { past, deck, future } = getState()
      if (!past.length) return
      lastCoalesce = null
      setState({ deck: past[past.length - 1], past: past.slice(0, -1), future: [deck, ...future] })
      persistSoon()
    },

    redo() {
      const { past, deck, future } = getState()
      if (!future.length) return
      lastCoalesce = null
      setState({ deck: future[0], past: [...past, deck], future: future.slice(1) })
      persistSoon()
    },

    select(id) {
      setState({ selectedId: id, showBack: false })
    },
    setShowBack(v) {
      setState({ showBack: v })
    },
    setPanel(p) {
      setState({ panel: p })
    },

    newDeck(theme) {
      switchTo(createDeck(theme))
      getState().notify('New deck created')
    },

    async openDeck(id) {
      const stored = (await get(deckKey(id))) as Deck | undefined
      if (!stored) {
        getState().notify('That deck could not be found in storage.', 'error')
        setState({ library: getState().library.filter((l) => l.id !== id) })
        return
      }
      switchTo(normalizeDeck(stored))
    },

    async deleteDeck(id) {
      await del(deckKey(id))
      const library = getState().library.filter((l) => l.id !== id)
      setState({ library })
      await set(KEY_LIBRARY, library)
      if (getState().deck.id === id) {
        if (library[0]) await getState().openDeck(library[0].id)
        else switchTo(createDeck('classic'))
      }
    },

    duplicateDeck() {
      const copy = structuredClone(getState().deck)
      copy.id = newId()
      copy.name = `${copy.name} (copy)`
      copy.createdAt = copy.updatedAt = new Date().toISOString()
      switchTo(copy)
      getState().notify('Deck duplicated')
    },

    importDeckText(text) {
      try {
        const deck = parseDeck(text)
        // Keep an imported deck distinct from one already in the library with the same id.
        if (getState().library.some((l) => l.id === deck.id)) deck.id = newId()
        switchTo(deck)
        getState().notify(`Imported “${deck.name}”`)
      } catch (e) {
        getState().notify((e as Error).message, 'error')
      }
    },

    notify(text, tone = 'ok') {
      clearTimeout(toastTimer)
      setState({ toast: { text, tone } })
      toastTimer = setTimeout(() => setState({ toast: null }), tone === 'error' ? 7000 : 2600)
    },
  }
})

function firstCardId(deck: Deck): string {
  return `${deck.suits[0].id}-${deck.ranks[0].id}`
}
