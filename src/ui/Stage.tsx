import { memo, useEffect, useRef, useState } from 'react'
import { useStore } from '../state/store'
import { findCard, listCards, type CardRef } from '../model/resolve'
import type { Deck } from '../model/schema'
import { CardSvg } from '../render/CardSvg'
import {
  IconChevronLeft,
  IconChevronRight,
  IconFlip,
  IconStudioView,
  IconGalleryView,
} from './icons'

export function Stage() {
  const deck = useStore((s) => s.deck)
  const selectedId = useStore((s) => s.selectedId)
  const showBack = useStore((s) => s.showBack)
  const setShowBack = useStore((s) => s.setShowBack)
  const select = useStore((s) => s.select)
  const [viewMode, setViewMode] = useState<'studio' | 'gallery'>('studio')
  const heroRef = useRef<HTMLButtonElement>(null)

  const focusHeroCard = (targetId?: string) => {
    if (targetId) select(targetId)
    if (viewMode !== 'studio') {
      setViewMode('studio')
    }
    setTimeout(() => {
      const mainEl = heroRef.current?.closest('.main')
      if (mainEl) {
        mainEl.scrollTo({ top: 0, behavior: 'smooth' })
      } else {
        heroRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
      // Blur any previously active element so no focus outline lingers
      if (document.activeElement && document.activeElement instanceof HTMLElement) {
        document.activeElement.blur()
      }
    }, 40)
  }

  const cards = listCards(deck)
  const index = Math.max(0, cards.findIndex((c) => c.id === selectedId))
  const card = findCard(deck, selectedId) ?? cards[0]

  useEffect(() => {
    if (!findCard(deck, selectedId)) select(cards[0].id)
  }, [deck, selectedId, select, cards])

  // 2D Keyboard Traversal (Up/Down across suits, Left/Right across ranks)
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement
      if (t.closest('input, textarea, select, [contenteditable]')) return

      if (e.key === 'ArrowRight') {
        e.preventDefault()
        select(cards[(index + 1) % cards.length].id)
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault()
        select(cards[(index - 1 + cards.length) % cards.length].id)
      } else if (e.key === 'ArrowDown') {
        e.preventDefault()
        const jokers = cards.filter((c) => c.kind === 'joker')
        if (card.kind === 'standard') {
          const suitIdx = deck.suits.findIndex((s) => s.id === card.suit.id)
          const rankIdx = deck.ranks.findIndex((r) => r.id === card.rank.id)
          if (suitIdx < deck.suits.length - 1) {
            const nextSuit = deck.suits[suitIdx + 1]
            select(`${nextSuit.id}-${card.rank.id}`)
          } else if (jokers.length > 0) {
            // Jump down from last suit (Clubs) to corresponding Joker
            const targetJokerIdx = Math.min(Math.max(0, rankIdx), jokers.length - 1)
            select(jokers[targetJokerIdx].id)
          } else {
            // Wrap around to top suit (Spades)
            const firstSuit = deck.suits[0]
            select(`${firstSuit.id}-${card.rank.id}`)
          }
        } else if (card.kind === 'joker') {
          // Jump down from Joker to wrap around to top suit (Spades)
          const jokerIdx = jokers.findIndex((j) => j.id === card.id)
          const targetRankIdx = Math.min(Math.max(0, jokerIdx), deck.ranks.length - 1)
          const firstSuit = deck.suits[0]
          select(`${firstSuit.id}-${deck.ranks[targetRankIdx].id}`)
        }
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        const jokers = cards.filter((c) => c.kind === 'joker')
        if (card.kind === 'standard') {
          const suitIdx = deck.suits.findIndex((s) => s.id === card.suit.id)
          const rankIdx = deck.ranks.findIndex((r) => r.id === card.rank.id)
          if (suitIdx > 0) {
            const prevSuit = deck.suits[suitIdx - 1]
            select(`${prevSuit.id}-${card.rank.id}`)
          } else if (jokers.length > 0) {
            // Wrap up from first suit (Spades) to corresponding Joker
            const targetJokerIdx = Math.min(Math.max(0, rankIdx), jokers.length - 1)
            select(jokers[targetJokerIdx].id)
          } else {
            // Wrap up to bottom suit (Clubs)
            const lastSuit = deck.suits[deck.suits.length - 1]
            select(`${lastSuit.id}-${card.rank.id}`)
          }
        } else if (card.kind === 'joker') {
          // Jump up from Joker to bottom suit (Clubs)
          const jokerIdx = jokers.findIndex((j) => j.id === card.id)
          const targetRankIdx = Math.min(Math.max(0, jokerIdx), deck.ranks.length - 1)
          const lastSuit = deck.suits[deck.suits.length - 1]
          select(`${lastSuit.id}-${deck.ranks[targetRankIdx].id}`)
        }
      } else if (e.key.toLowerCase() === 'f') {
        e.preventDefault()
        setShowBack(!useStore.getState().showBack)
      } else if (e.key.toLowerCase() === 'g') {
        e.preventDefault()
        setViewMode('gallery')
      } else if (e.key.toLowerCase() === 's') {
        e.preventDefault()
        focusHeroCard()
      } else if (e.key === 'Enter') {
        e.preventDefault()
        focusHeroCard()
      } else if (e.key === 'Escape') {
        if (viewMode === 'studio') {
          e.preventDefault()
          setViewMode('gallery')
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [cards, index, card, deck.suits, deck.ranks, select, setShowBack, viewMode])

  const title = card.kind === 'joker' ? card.joker.label : `${card.rank.label} of ${card.suit.name}`
  const aspect = `${deck.card.widthMm} / ${deck.card.heightMm}`

  return (
    <div className={`stage ${viewMode}`}>
      <div className="stage-view-bar">
        <div className="stage-view-title-group">
          {viewMode === 'studio' ? (
            <div className="caption-flip-hint">
              <span>Viewing:</span>
              <strong>{showBack ? 'Card Back Design' : title}</strong>
            </div>
          ) : (
            <div className="caption-flip-hint">
              <span>Exhibition:</span>
              <strong>{showBack ? 'All Card Backs' : 'Full Deck Spread'}</strong>
              <span className="caption-meta-tag">{cards.length} Cards</span>
            </div>
          )}
        </div>

        <div className="stage-view-actions">
          {viewMode === 'gallery' && (
            <>
              <button
                type="button"
                className="stage-action-btn"
                onClick={() => setShowBack(!showBack)}
                title="Flip all cards between Front and Back (Press F)"
              >
                <IconFlip size={14} />
                <span>{showBack ? 'Show Faces' : 'Flip All to Back'}</span>
              </button>

              <button
                type="button"
                className="stage-action-btn primary"
                onClick={() => focusHeroCard()}
                title="Inspect selected card in Studio Spotlight (Press Enter)"
              >
                <IconStudioView size={14} />
                <span>Inspect in Studio</span>
              </button>
            </>
          )}

          <div className="stage-view-modes" role="radiogroup" aria-label="Canvas view mode">
            <button
              type="button"
              className={viewMode === 'studio' ? 'on' : ''}
              onClick={() => setViewMode('studio')}
              title="Studio Spotlight View (Press S or Enter)"
            >
              <IconStudioView size={15} />
              <span>Studio</span>
            </button>
            <button
              type="button"
              className={viewMode === 'gallery' ? 'on' : ''}
              onClick={() => setViewMode('gallery')}
              title="Gallery Exhibition View (Press G)"
            >
              <IconGalleryView size={15} />
              <span>Gallery</span>
            </button>
          </div>
        </div>
      </div>

      {viewMode === 'studio' && (
        <>
          <div className="spotlight">
            <button
              type="button"
              className="nav prev"
              aria-label="Previous card"
              title="Previous card (Left Arrow)"
              onClick={() => select(cards[(index - 1 + cards.length) % cards.length].id)}
            >
              <IconChevronLeft size={20} />
            </button>

            <button
              ref={heroRef}
              type="button"
              className={`hero ${showBack ? 'flipped' : ''}`}
              style={{ aspectRatio: aspect }}
              onClick={() => setShowBack(!showBack)}
              aria-label={showBack ? 'Flip to front face' : 'Flip to card back'}
              title="Click to flip card (or press F)"
            >
              <span className="hero-inner">
                <span className="hero-face front">
                  <CardSvg deck={deck} card={card} />
                </span>
                <span className="hero-face back">
                  <CardSvg deck={deck} card="back" />
                </span>
              </span>
            </button>

            <button
              type="button"
              className="nav next"
              aria-label="Next card"
              title="Next card (Right Arrow)"
              onClick={() => select(cards[(index + 1) % cards.length].id)}
            >
              <IconChevronRight size={20} />
            </button>
          </div>

          <div className="caption">
            <span className="caption-title">{showBack ? 'Card Back Design' : title}</span>
            <div className="caption-meta-row">
              <span className="caption-meta-tag">
                {index + 1} of {cards.length}
              </span>
              <span className="caption-meta-tag">
                {deck.card.widthMm} × {deck.card.heightMm} mm
              </span>
              <span className="caption-flip-hint">
                <IconFlip size={13} />
                <kbd>F</kbd> flip
              </span>
              <span className="caption-flip-hint">
                <IconGalleryView size={13} />
                <kbd>G</kbd> gallery
              </span>
            </div>
          </div>

          <div className="deck-navigator-header">
            <span className="deck-navigator-title">Deck Navigator</span>
            <span className="deck-navigator-hint">Click any card to inspect • Arrow keys navigate</span>
          </div>
        </>
      )}

      <DeckGrid
        deck={deck}
        cards={cards}
        selectedId={selectedId}
        viewMode={viewMode}
        showBack={viewMode === 'gallery' ? showBack : false}
        onFocusCard={focusHeroCard}
      />

      {viewMode === 'gallery' && (
        <div className="gallery-status-bar">
          <div className="gallery-status-card">
            <span
              className="gallery-status-pip"
              style={{ color: card.kind === 'standard' ? card.suit.color : 'var(--gilt-200)' }}
            >
              {card.kind === 'standard' ? card.suit.symbol : '★'}
            </span>
            <span>
              Selected: <strong>{title}</strong>
              {showBack ? ' (Back)' : ''}
            </span>
            <span className="gallery-status-tag">
              {index + 1} of {cards.length}
            </span>
          </div>
          <div className="gallery-status-actions">
            <span className="gallery-status-hint">
              Double-click card or press <kbd>Enter</kbd> to inspect
            </span>
            <button
              type="button"
              className="btn small primary"
              onClick={() => focusHeroCard()}
            >
              <IconStudioView size={14} />
              Open in Studio
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

const DeckGrid = memo(function DeckGrid({
  deck,
  cards,
  selectedId,
  viewMode,
  showBack,
  onFocusCard,
}: {
  deck: Deck
  cards: CardRef[]
  selectedId: string
  viewMode: 'studio' | 'gallery'
  showBack: boolean
  onFocusCard: (id?: string) => void
}) {
  const select = useStore((s) => s.select)
  const setShowBack = useStore((s) => s.setShowBack)
  const setPanel = useStore((s) => s.setPanel)
  const aspect = `${deck.card.widthMm} / ${deck.card.heightMm}`

  const rows: { key: string; label: string; color: string; symbol: string; cards: CardRef[] }[] = deck.suits.map((s) => ({
    key: s.id,
    label: s.name,
    color: s.color,
    symbol: s.symbol,
    cards: cards.filter((c) => c.kind === 'standard' && c.suit.id === s.id),
  }))
  const jokers = cards.filter((c) => c.kind === 'joker')

  return (
    <div className={`deck-grid ${viewMode}`} aria-label="All cards in deck">
      {rows.map((row) => (
        <div className="grid-row" key={row.key}>
          <div className="grid-label">
            <span className="grid-pip" style={{ color: row.color }}>
              {row.symbol}
            </span>
            {row.label}
          </div>
          <div className="grid-cards">
            {row.cards.map((c) => (
              <GridCard
                key={c.id}
                deck={deck}
                card={c}
                on={c.id === selectedId}
                aspect={aspect}
                showBack={showBack}
                onClick={() => select(c.id)}
                onDoubleClick={() => onFocusCard(c.id)}
              />
            ))}
          </div>
        </div>
      ))}
      <div className="grid-row">
        <div className="grid-label">{jokers.length ? 'Jokers & Back' : 'Card Back'}</div>
        <div className="grid-cards">
          {jokers.map((c) => (
            <GridCard
              key={c.id}
              deck={deck}
              card={c}
              on={c.id === selectedId}
              aspect={aspect}
              showBack={showBack}
              onClick={() => select(c.id)}
              onDoubleClick={() => onFocusCard(c.id)}
            />
          ))}
          <button
            type="button"
            className={`grid-card ${showBack && viewMode === 'studio' ? 'on' : ''}`}
            style={{ aspectRatio: aspect }}
            onClick={() => {
              setShowBack(true)
              setPanel('back')
              if (viewMode === 'gallery') onFocusCard()
            }}
            onDoubleClick={() => {
              setShowBack(true)
              setPanel('back')
              onFocusCard()
            }}
            title="Card back (Click to design back in Studio)"
            aria-label="Card back design"
          >
            <CardSvg deck={deck} card="back" />
          </button>
        </div>
      </div>
    </div>
  )
})

function GridCard({
  deck,
  card,
  on,
  aspect,
  showBack,
  onClick,
  onDoubleClick,
}: {
  deck: Deck
  card: CardRef
  on: boolean
  aspect: string
  showBack: boolean
  onClick: () => void
  onDoubleClick?: () => void
}) {
  const label = card.kind === 'joker' ? card.joker.label : `${card.rank.label} of ${card.suit.name}`

  return (
    <button
      type="button"
      className={`grid-card ${on ? 'on' : ''}`}
      style={{ aspectRatio: aspect }}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      title={`${label}${showBack ? ' (Back)' : ''} — Double-click to open in Studio`}
      aria-label={label}
      data-card={card.id}
    >
      <CardSvg deck={deck} card={showBack ? 'back' : card} />
    </button>
  )
}
