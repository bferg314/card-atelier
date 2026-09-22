import { useEffect } from 'react'
import { useStore, type PanelKey } from './state/store'
import { TopBar } from './ui/TopBar'
import { Stage } from './ui/Stage'
import { ArtworkPanel, BackPanel, DeckPanel, JokersPanel, SuitsPanel } from './ui/panels'

const TABS: { key: PanelKey; label: string; glyph: string }[] = [
  { key: 'deck', label: 'Deck', glyph: '▭' },
  { key: 'suits', label: 'Suits', glyph: '♣' },
  { key: 'artwork', label: 'Artwork', glyph: '✦' },
  { key: 'back', label: 'Back', glyph: '▦' },
  { key: 'jokers', label: 'Jokers', glyph: '☆' },
]

export function App() {
  const ready = useStore((s) => s.ready)
  const panel = useStore((s) => s.panel)
  const setPanel = useStore((s) => s.setPanel)
  const toast = useStore((s) => s.toast)

  // Keyed on `ready` so a hot-reloaded store (which starts unready) initialises again in development.
  useEffect(() => {
    if (!ready) useStore.getState().init()
  }, [ready])

  if (!ready) return <div className="loading">Shuffling…</div>

  return (
    <div className="app">
      <TopBar />
      <div className="workspace">
        <aside className="sidebar">
          <nav className="tabs" role="tablist">
            {TABS.map((t) => (
              <button key={t.key} type="button" role="tab" aria-selected={panel === t.key} className={panel === t.key ? 'on' : ''} onClick={() => setPanel(t.key)}>
                <span className="tab-glyph" aria-hidden>
                  {t.glyph}
                </span>
                {t.label}
              </button>
            ))}
          </nav>
          <div className="panel" role="tabpanel">
            {panel === 'deck' && <DeckPanel />}
            {panel === 'suits' && <SuitsPanel />}
            {panel === 'artwork' && <ArtworkPanel />}
            {panel === 'back' && <BackPanel />}
            {panel === 'jokers' && <JokersPanel />}
          </div>
        </aside>
        <main className="main">
          <Stage />
        </main>
      </div>
      {toast && (
        <div className={`toast ${toast.tone}`} role="status">
          {toast.text}
        </div>
      )}
    </div>
  )
}
