import { useEffect } from 'react'
import { useStore, type PanelKey } from './state/store'
import { TopBar } from './ui/TopBar'
import { Stage } from './ui/Stage'
import { ArtworkPanel, BackPanel, DeckPanel, JokersPanel, SuitsPanel } from './ui/panels'
import {
  IconDeck,
  IconSuits,
  IconArtwork,
  IconBackPattern,
  IconJoker,
} from './ui/icons'

const TABS: { key: PanelKey; label: string; icon: typeof IconDeck }[] = [
  { key: 'deck', label: 'Deck', icon: IconDeck },
  { key: 'suits', label: 'Suits', icon: IconSuits },
  { key: 'artwork', label: 'Artwork', icon: IconArtwork },
  { key: 'back', label: 'Back', icon: IconBackPattern },
  { key: 'jokers', label: 'Jokers', icon: IconJoker },
]

export function App() {
  const ready = useStore((s) => s.ready)
  const panel = useStore((s) => s.panel)
  const setPanel = useStore((s) => s.setPanel)
  const setShowBack = useStore((s) => s.setShowBack)
  const select = useStore((s) => s.select)
  const deck = useStore((s) => s.deck)
  const toast = useStore((s) => s.toast)

  // Keyed on `ready` so a hot-reloaded store (which starts unready) initialises again in development.
  useEffect(() => {
    if (!ready) useStore.getState().init()
  }, [ready])

  function handleTabClick(key: PanelKey) {
    setPanel(key)
    // Smart auto-sync: Show back when entering Back panel; show front when editing Suits or Artwork
    if (key === 'back') {
      setShowBack(true)
    } else if (key === 'suits' || key === 'artwork') {
      setShowBack(false)
    } else if (key === 'jokers') {
      setShowBack(false)
      if (deck.jokers.enabled && deck.jokers.items[0]) {
        select(deck.jokers.items[0].id)
      }
    }
  }

  if (!ready) return <div className="loading">Shuffling deck atelier…</div>

  return (
    <div className="app">
      <TopBar />
      <div className="workspace">
        <aside className="sidebar">
          <nav className="tabs" role="tablist" aria-label="Sidebar navigation panels">
            {TABS.map((t) => {
              const Icon = t.icon
              const isSelected = panel === t.key
              return (
                <button
                  key={t.key}
                  type="button"
                  role="tab"
                  aria-selected={isSelected}
                  className={isSelected ? 'on' : ''}
                  onClick={() => handleTabClick(t.key)}
                >
                  <span className="tab-glyph" aria-hidden>
                    <Icon size={16} />
                  </span>
                  {t.label}
                </button>
              )
            })}
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
