import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useStore } from '../state/store'
import { downloadDeck, fileNameFor } from '../model/io'
import { createDeck, STANDARD_RANKS, THEMES } from '../model/presets'
import { listCards } from '../model/resolve'
import { CardSvg } from '../render/CardSvg'
import { loadDeckFonts } from '../fonts/fonts'

export function TopBar() {
  const deck = useStore((s) => s.deck)
  const canUndo = useStore((s) => s.past.length > 0)
  const canRedo = useStore((s) => s.future.length > 0)
  const { undo, redo, update, importDeckText, notify } = useStore.getState()
  const fileRef = useRef<HTMLInputElement>(null)
  const [menu, setMenu] = useState<'library' | 'new' | null>(null)

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!(e.ctrlKey || e.metaKey)) return
      const t = e.target as HTMLElement
      if (t.closest('input[type=text], textarea')) return
      if (e.key.toLowerCase() === 'z') {
        e.preventDefault()
        if (e.shiftKey) redo()
        else undo()
      } else if (e.key.toLowerCase() === 'y') {
        e.preventDefault()
        redo()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [undo, redo])

  const count = listCards(deck).length

  return (
    <header className="topbar">
      <div className="brand">
        <span className="brand-mark" aria-hidden>
          ♠
        </span>
        <span className="brand-name">Card Atelier</span>
      </div>

      <div className="deck-title">
        <input className="deck-name" value={deck.name} aria-label="Deck name" onChange={(e) => update((d) => void (d.name = e.target.value || 'Untitled deck'), 'name')} />
        <span className="deck-count">{count} cards</span>
      </div>

      <div className="actions">
        <button type="button" className="btn icon" onClick={undo} disabled={!canUndo} title="Undo (Ctrl+Z)" aria-label="Undo">
          ↶
        </button>
        <button type="button" className="btn icon" onClick={redo} disabled={!canRedo} title="Redo (Ctrl+Shift+Z)" aria-label="Redo">
          ↷
        </button>
        <span className="divider" />
        <button type="button" className="btn ghost" onClick={() => setMenu('new')}>
          New
        </button>
        <button type="button" className="btn ghost" onClick={() => setMenu('library')}>
          Library
        </button>
        <button type="button" className="btn ghost" onClick={() => fileRef.current?.click()}>
          Import
        </button>
        <button
          type="button"
          className="btn primary"
          onClick={() => {
            downloadDeck(deck)
            notify(`Saved ${fileNameFor(deck)}`)
          }}
        >
          Export JSON
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".json,application/json"
          hidden
          data-testid="import-input"
          onChange={async (e) => {
            const f = e.target.files?.[0]
            e.target.value = ''
            if (f) importDeckText(await f.text())
          }}
        />
      </div>

      {menu === 'new' && <NewDeckDialog onClose={() => setMenu(null)} />}
      {menu === 'library' && <LibraryDialog onClose={() => setMenu(null)} />}
    </header>
  )
}

function Dialog({ title, onClose, children, wide }: { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return createPortal(
    <div className="scrim" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`dialog ${wide ? 'wide' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
        <header className="dialog-head">
          <h2>{title}</h2>
          <button type="button" className="btn icon" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </header>
        {children}
      </div>
    </div>,
    document.body,
  )
}

function NewDeckDialog({ onClose }: { onClose: () => void }) {
  const newDeck = useStore((s) => s.newDeck)
  const [samples] = useState(() => THEMES.map((t) => createDeck(t.key)))
  useEffect(() => samples.forEach((d) => loadDeckFonts(d.fonts)), [samples])
  const picks = ['hearts-A', 'spades-K', 'diamonds-7']
  return (
    <Dialog title="Start a new deck" onClose={onClose} wide>
      <p className="dialog-note">Pick a starting style. Everything can be changed afterwards.</p>
      <div className="theme-grid">
        {THEMES.map((t, i) => {
          const d = samples[i]
          const cards = listCards(d)
          return (
            <button
              type="button"
              key={t.key}
              className="theme-tile"
              onClick={() => {
                newDeck(t.key)
                onClose()
              }}
            >
              <span className="theme-fan">
                {picks.map((id) => {
                  const c = cards.find((x) => x.id === id)!
                  return (
                    <span className="fan-card" key={id} style={{ aspectRatio: `${d.card.widthMm} / ${d.card.heightMm}` }}>
                      <CardSvg deck={d} card={c} />
                    </span>
                  )
                })}
                <span className="fan-card" style={{ aspectRatio: `${d.card.widthMm} / ${d.card.heightMm}` }}>
                  <CardSvg deck={d} card="back" />
                </span>
              </span>
              <span className="theme-name">{t.name}</span>
              <span className="theme-blurb">{t.blurb}</span>
            </button>
          )
        })}
      </div>
      <p className="dialog-note subtle">
        Every deck has {STANDARD_RANKS.length * 4} cards plus optional jokers.
      </p>
    </Dialog>
  )
}

function LibraryDialog({ onClose }: { onClose: () => void }) {
  const library = useStore((s) => s.library)
  const current = useStore((s) => s.deck.id)
  const { openDeck, deleteDeck, duplicateDeck } = useStore.getState()
  const [confirm, setConfirm] = useState<string | null>(null)
  return (
    <Dialog title="Your decks" onClose={onClose}>
      <p className="dialog-note">Decks are saved automatically in this browser. Export to JSON to keep a copy or use a deck in a game.</p>
      <ul className="library">
        {library.map((d) => (
          <li key={d.id} className={d.id === current ? 'current' : ''}>
            <button
              type="button"
              className="library-open"
              onClick={async () => {
                await openDeck(d.id)
                onClose()
              }}
            >
              <span className="library-name">{d.name}</span>
              <span className="library-meta">{d.id === current ? 'Open now' : `Edited ${new Date(d.updatedAt).toLocaleString()}`}</span>
            </button>
            {confirm === d.id ? (
              <button type="button" className="btn danger small" onClick={() => deleteDeck(d.id)}>
                Really delete
              </button>
            ) : (
              <button type="button" className="btn ghost small" onClick={() => setConfirm(d.id)}>
                Delete
              </button>
            )}
          </li>
        ))}
        {library.length === 0 && <li className="empty">No saved decks yet.</li>}
      </ul>
      <div className="button-row">
        <button
          type="button"
          className="btn ghost"
          onClick={() => {
            duplicateDeck()
            onClose()
          }}
        >
          Duplicate current deck
        </button>
      </div>
    </Dialog>
  )
}
