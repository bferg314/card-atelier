import { SYSTEM_FONTS } from '../fonts/fonts'
import type { Deck } from './schema'

/** Families referenced anywhere in the deck. */
export function usedFamilies(deck: Deck): Set<string> {
  const used = new Set<string>()
  for (const s of deck.suits) used.add(s.font.family)
  for (const j of deck.jokers.items) used.add(j.font.family)
  return used
}

/**
 * Keep deck.fonts in step with what the deck uses: add a source entry for each newly used family,
 * drop web fonts nobody references. Uploaded fonts are kept so they stay available in the pickers.
 */
export function syncFonts(deck: Deck): void {
  const used = usedFamilies(deck)
  const known = new Set(deck.fonts.map((f) => f.family))
  deck.fonts = deck.fonts.filter((f) => f.source === 'embedded' || used.has(f.family))
  for (const family of used) {
    if (known.has(family)) continue
    deck.fonts.push(SYSTEM_FONTS.includes(family) ? { family, source: 'system' } : { family, source: 'google' })
  }
}
