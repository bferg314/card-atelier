import { memo, useEffect } from 'react'
import { useStore } from '../state/store'
import { findCard, listCards, type CardRef } from '../model/resolve'
import type { Deck } from '../model/schema'
import { CardSvg } from '../render/CardSvg'

export function Stage() {
  const deck = useStore((s) => s.deck)
  const selectedId = useStore((s) => s.selectedId)
  const showBack = useStore((s) => s.showBack)
  const setShowBack = useStore((s) => s.setShowBack)
  const select = useStore((s) => s.select)
  const cards = listCards(deck)
  const index = Math.max(0, cards.findIndex((c) => c.id === selectedId))
  const card = findCard(deck, selectedId) ?? cards[0]

  useEffect(() => {
    if (!findCard(deck, selectedId)) select(cards[0].id)
  }, [deck, selectedId, select, cards])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement
      if (t.closest('input, textarea, select, [contenteditable]')) return
      if (e.key === 'ArrowRight') select(cards[(index + 1) % cards.length].id)
      else if (e.key === 'ArrowLeft') select(cards[(index - 1 + cards.length) % cards.length].id)
      else if (e.key === 'f') setShowBack(!useStore.getState().showBack)
      else return
      e.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [cards, index, select, setShowBack])

  const title = card.kind === 'joker' ? card.joker.label : `${card.rank.label} of ${card.suit.name}`
  const aspect = `${deck.card.widthMm} / ${deck.card.heightMm}`

  return (
    <div className="stage">
      <div className="spotlight">
        <button type="button" className="nav prev" aria-label="Previous card" onClick={() => select(cards[(index - 1 + cards.length) % cards.length].id)}>
          ‹
        </button>
        <button type="button" className={`hero ${showBack ? 'flipped' : ''}`} style={{ aspectRatio: aspect }} onClick={() => setShowBack(!showBack)} aria-label="Flip card">
          <span className="hero-inner">
            <span className="hero-face front">
              <CardSvg deck={deck} card={card} />
            </span>
            <span className="hero-face back">
              <CardSvg deck={deck} card="back" />
            </span>
          </span>
        </button>
        <button type="button" className="nav next" aria-label="Next card" onClick={() => select(cards[(index + 1) % cards.length].id)}>
          ›
        </button>
      </div>
      <div className="caption">
        <span className="caption-title">{showBack ? 'Card back' : title}</span>
        <span className="caption-meta">
          {index + 1} of {cards.length} · {deck.card.widthMm} × {deck.card.heightMm} mm · click the card or press F to flip
        </span>
      </div>
      <DeckGrid deck={deck} cards={cards} selectedId={selectedId} />
    </div>
  )
}

const DeckGrid = memo(function DeckGrid({ deck, cards, selectedId }: { deck: Deck; cards: CardRef[]; selectedId: string }) {
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
    <div className="deck-grid" aria-label="All cards">
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
              <GridCard key={c.id} deck={deck} card={c} on={c.id === selectedId} aspect={aspect} onClick={() => select(c.id)} />
            ))}
          </div>
        </div>
      ))}
      <div className="grid-row">
        <div className="grid-label">{jokers.length ? 'Jokers & back' : 'Back'}</div>
        <div className="grid-cards">
          {jokers.map((c) => (
            <GridCard key={c.id} deck={deck} card={c} on={c.id === selectedId} aspect={aspect} onClick={() => select(c.id)} />
          ))}
          <button
            type="button"
            className="grid-card"
            style={{ aspectRatio: aspect }}
            onClick={() => {
              setShowBack(true)
              setPanel('back')
            }}
            title="Card back"
          >
            <CardSvg deck={deck} card="back" />
          </button>
        </div>
      </div>
    </div>
  )
})

function GridCard({ deck, card, on, aspect, onClick }: { deck: Deck; card: CardRef; on: boolean; aspect: string; onClick: () => void }) {
  const label = card.kind === 'joker' ? card.joker.label : `${card.rank.label} of ${card.suit.name}`
  return (
    <button type="button" className={`grid-card ${on ? 'on' : ''}`} style={{ aspectRatio: aspect }} onClick={onClick} title={label} data-card={card.id}>
      <CardSvg deck={deck} card={card} />
    </button>
  )
}
