import type { Deck, Face, Joker, Rank, ResolvedCard, Suit } from './schema'

export type CardRef =
  | { kind: 'standard'; id: string; suit: Suit; rank: Rank; face: Face | undefined }
  | { kind: 'joker'; id: string; joker: Joker }

export function cardId(suitId: string, rankId: string): string {
  return `${suitId}-${rankId}`
}

/** Every card in play order: each suit in turn, ranks ascending, then jokers when enabled. */
export function listCards(deck: Deck): CardRef[] {
  const out: CardRef[] = []
  for (const suit of deck.suits) {
    for (const rank of deck.ranks) {
      const id = cardId(suit.id, rank.id)
      out.push({ kind: 'standard', id, suit, rank, face: deck.faces[id] })
    }
  }
  if (deck.jokers.enabled) {
    for (const joker of deck.jokers.items) out.push({ kind: 'joker', id: joker.id, joker })
  }
  return out
}

export function findCard(deck: Deck, id: string): CardRef | undefined {
  return listCards(deck).find((c) => c.id === id)
}

/** The flat, game-friendly list written into exported JSON. */
export function resolveCards(deck: Deck): ResolvedCard[] {
  return listCards(deck).map((c) =>
    c.kind === 'standard'
      ? { id: c.id, kind: 'standard', suit: c.suit.id, rank: c.rank.id, value: c.rank.value, label: `${c.rank.label}${c.suit.symbol}`, color: c.suit.color }
      : { id: c.id, kind: 'joker', suit: null, rank: null, value: null, label: c.joker.label, color: c.joker.color },
  )
}
