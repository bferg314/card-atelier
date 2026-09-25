import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useStore } from '../state/store'
import { downloadDeck, downloadFile, downloadJson, fileNameFor, openFileNameFor, openFolderNameFor } from '../model/io'
import { rasterFor, toFolder } from '../model/open'
import { zip } from '../model/zip'
import { Segmented, Toggle } from './controls'
import { createDeck, STANDARD_RANKS, THEMES } from '../model/presets'
import { listCards } from '../model/resolve'
import { CardSvg } from '../render/CardSvg'
import { loadDeckFonts } from '../fonts/fonts'
import {
  IconUndo,
  IconRedo,
  IconNew,
  IconLibrary,
  IconImport,
  IconExport,
  IconClose,
  IconTrash,
  IconCopy,
  IconCheck,
} from './icons'

export function TopBar() {
  const deck = useStore((s) => s.deck)
  const canUndo = useStore((s) => s.past.length > 0)
  const canRedo = useStore((s) => s.future.length > 0)
  const { undo, redo, update, importDeckText } = useStore.getState()
  const fileRef = useRef<HTMLInputElement>(null)
  const [menu, setMenu] = useState<'library' | 'new' | 'export' | null>(null)

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
        <input
          className="deck-name"
          value={deck.name}
          aria-label="Deck name"
          onChange={(e) => update((d) => void (d.name = e.target.value || 'Untitled deck'), 'name')}
          placeholder="Deck Name"
        />
        <span className="deck-count">{count} cards</span>
      </div>

      <div className="actions">
        <button
          type="button"
          className="btn icon"
          onClick={undo}
          disabled={!canUndo}
          title="Undo (Ctrl+Z)"
          aria-label="Undo"
        >
          <IconUndo size={16} />
        </button>
        <button
          type="button"
          className="btn icon"
          onClick={redo}
          disabled={!canRedo}
          title="Redo (Ctrl+Shift+Z)"
          aria-label="Redo"
        >
          <IconRedo size={16} />
        </button>
        <span className="divider" />
        <button type="button" className="btn ghost" onClick={() => setMenu('new')}>
          <IconNew size={15} />
          New
        </button>
        <button type="button" className="btn ghost" onClick={() => setMenu('library')}>
          <IconLibrary size={15} />
          Library
        </button>
        <button type="button" className="btn ghost" onClick={() => fileRef.current?.click()}>
          <IconImport size={15} />
          Import
        </button>
        <button type="button" className="btn primary" onClick={() => setMenu('export')}>
          <IconExport size={16} />
          Export
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
      {menu === 'export' && <ExportDialog onClose={() => setMenu(null)} />}
    </header>
  )
}

function Dialog({
  title,
  onClose,
  children,
  wide,
}: {
  title: string
  onClose: () => void
  children: React.ReactNode
  wide?: boolean
}) {
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
          <button type="button" className="btn icon ghost" onClick={onClose} aria-label="Close dialog">
            <IconClose size={16} />
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
  const past = useStore((s) => s.past)
  const [samples] = useState(() => THEMES.map((t) => createDeck(t.key)))
  useEffect(() => samples.forEach((d) => loadDeckFonts(d.fonts)), [samples])
  const picks = ['hearts-A', 'spades-K', 'diamonds-7']

  return (
    <Dialog title="Start a New Deck" onClose={onClose} wide>
      <p className="dialog-note">
        Select an artisanal starting style. You can customize every detail, typeface, and color afterwards.
      </p>
      {past.length > 0 && (
        <div className="field-hint warn" style={{ marginBottom: 16 }}>
          Starting a new deck will replace your current workspace. Decks in your Library remain safely stored.
        </div>
      )}
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
        Every standard deck begins with {STANDARD_RANKS.length * 4} cards plus optional custom jokers.
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
    <Dialog title="Deck Library" onClose={onClose}>
      <p className="dialog-note">
        Decks are saved automatically to your local browser storage. Export as JSON to share or use inside games.
      </p>
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
              <span className="library-meta">
                {d.id === current ? '✦ Active Deck in Workspace' : `Edited ${new Date(d.updatedAt).toLocaleString()}`}
              </span>
            </button>
            {confirm === d.id ? (
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <button
                  type="button"
                  className="btn danger small"
                  onClick={() => {
                    deleteDeck(d.id)
                    setConfirm(null)
                  }}
                >
                  <IconTrash size={12} /> Confirm Delete
                </button>
                <button type="button" className="btn ghost small" onClick={() => setConfirm(null)}>
                  Cancel
                </button>
              </div>
            ) : (
              <button
                type="button"
                className="btn ghost small"
                onClick={() => setConfirm(d.id)}
                title="Delete this deck from browser storage"
              >
                <IconTrash size={13} />
              </button>
            )}
          </li>
        ))}
        {library.length === 0 && <li className="empty">No saved decks in storage yet.</li>}
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
          <IconCopy size={15} />
          Duplicate Current Deck
        </button>
      </div>
    </Dialog>
  )
}

const BLEED_MM = 2

const PICTURES = [
  { value: 'both' as const, label: 'Both (PNG & SVG)' },
  { value: 'png' as const, label: 'Raster (PNG)' },
  { value: 'svg' as const, label: 'Vector (SVG)' },
]

const RESOLUTIONS = [
  { value: '150', label: 'Screen (150 DPI)' },
  { value: '300', label: 'Print (300 DPI)' },
]

function ExportDialog({ onClose }: { onClose: () => void }) {
  const deck = useStore((s) => s.deck)
  const notify = useStore((s) => s.notify)
  const [dpi, setDpi] = useState('150')
  const [images, setImages] = useState<'png' | 'svg' | 'both'>('both')
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)
  const [warning, setWarning] = useState<string | null>(null)
  const [bleed, setBleed] = useState(false)
  const bleedMm = bleed ? BLEED_MM : 0
  const raster = rasterFor(deck.card, Number(dpi), bleedMm)
  const busy = progress !== null

  async function exportOpen(as: 'json' | 'folder') {
    setWarning(null)
    setProgress({ done: 0, total: listCards(deck).length + 1 })
    try {
      const { snapshotDeck } = await import('../render/snapshot')
      const { file, missingFonts, unweightedFonts } = await snapshotDeck(
        deck,
        { dpi: Number(dpi), bleedMm, images },
        (done, total) => setProgress({ done, total }),
      )
      const name = as === 'json' ? openFileNameFor(deck) : openFolderNameFor(deck)
      const size =
        as === 'json'
          ? (() => {
              const text = JSON.stringify(file)
              downloadJson(name, text)
              return text.length
            })()
          : (() => {
              const bytes = zip(toFolder(file))
              downloadFile(name, new Blob([bytes as BlobPart], { type: 'application/zip' }))
              return bytes.length
            })()
      notify(`Saved ${name} (${(size / 1_048_576).toFixed(1)} MB)`)
      if (unweightedFonts.length) {
        setWarning(
          `${unweightedFonts.join(', ')} is a variable font whose weighted outlines could not be fetched. Vector cards will use its default weight.`,
        )
      } else if (missingFonts.length) {
        setWarning(
          images === 'png'
            ? `Could not embed ${missingFonts.join(', ')}. Those cards will use a fallback typeface.`
            : `Could not read ${missingFonts.join(', ')}. Lettering remains live text instead of vector outlines.`,
        )
      } else {
        onClose()
      }
    } catch (e) {
      notify(`Export failed: ${(e as Error).message}`, 'error')
    } finally {
      setProgress(null)
    }
  }

  const progressPercent = progress ? Math.round((progress.done / progress.total) * 100) : 0

  return (
    <Dialog title="Export Deck" onClose={busy ? () => {} : onClose}>
      <div className="export-card">
        <h3>Card Atelier Source (.deck.json)</h3>
        <p className="dialog-note" style={{ margin: '4px 0 12px' }}>
          Complete archival project file: card layout, lettering, fonts, and custom artwork. Import back at any time to resume editing.
        </p>
        <button
          type="button"
          className="btn ghost"
          disabled={busy}
          onClick={() => {
            downloadDeck(deck)
            notify(`Saved ${fileNameFor(deck)}`)
            onClose()
          }}
        >
          <IconExport size={15} />
          Download .deck.json
        </button>
      </div>

      <div className="export-card">
        <h3>Open Playing Cards Package</h3>
        <p className="dialog-note" style={{ margin: '4px 0 14px' }}>
          Production-ready assets for game engines and printing, compliant with the Open Playing Cards standard.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <span className="field-label" style={{ marginBottom: 6, display: 'block' }}>Format</span>
            <Segmented value={images} options={PICTURES} onChange={setImages} />
            <p className="field-hint" style={{ marginTop: 6 }}>
              {images === 'svg'
                ? 'Vector art with lettering converted to outlines: razor-sharp at any scale.'
                : images === 'both'
                  ? 'Includes both vector SVG and raster PNG for maximum compatibility.'
                  : 'High-fidelity raster images ready for any graphics engine.'}
            </p>
          </div>

          {images !== 'svg' && (
            <div>
              <span className="field-label" style={{ marginBottom: 6, display: 'block' }}>Resolution</span>
              <Segmented value={dpi} options={RESOLUTIONS} onChange={setDpi} />
              <p className="field-hint" style={{ marginTop: 6 }}>
                Output size: <strong>{raster.width} × {raster.height} px</strong> per card at {dpi} DPI ({dpi === '300' ? 'Archival print grade' : 'Screen & web grade'}).
              </p>
            </div>
          )}

          <Toggle
            checked={bleed}
            onChange={setBleed}
            label={`Add standard ${BLEED_MM} mm print bleed (square, opaque cutting edges)`}
          />

          {busy && (
            <div>
              <div className="export-progress-bar">
                <div className="export-progress-fill" style={{ width: `${progressPercent}%` }} />
              </div>
              <span className="field-hint" style={{ color: 'var(--gilt-200)' }}>
                Rendering cards: {progress.done} of {progress.total} ({progressPercent}%)…
              </span>
            </div>
          )}

          {warning && <p className="field-hint warn">{warning}</p>}

          <div className="button-row" style={{ marginTop: 8 }}>
            <button type="button" className="btn primary" disabled={busy} onClick={() => exportOpen('json')}>
              <IconCheck size={16} />
              {progress ? `Rendering ${progressPercent}%` : 'Single File (.cards.json)'}
            </button>
            <button
              type="button"
              className="btn ghost"
              disabled={busy}
              onClick={() => exportOpen('folder')}
              title="A ZIP archive holding deck.json and one PNG per card"
            >
              Folder Archive (.zip)
            </button>
          </div>
        </div>
      </div>
    </Dialog>
  )
}
