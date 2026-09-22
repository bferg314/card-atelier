/**
 * Pip positions for number cards, in a unit box: x 0 (left column) to 1 (right column),
 * y 0 (top row) to 1 (bottom row). Pips below the middle are drawn upside down, as on real cards.
 */
export type PipPos = [x: number, y: number]

const L = 0
const C = 0.5
const R = 1

export const PIP_LAYOUTS: Record<number, PipPos[]> = {
  2: [[C, 0], [C, 1]],
  3: [[C, 0], [C, 0.5], [C, 1]],
  4: [[L, 0], [R, 0], [L, 1], [R, 1]],
  5: [[L, 0], [R, 0], [C, 0.5], [L, 1], [R, 1]],
  6: [[L, 0], [R, 0], [L, 0.5], [R, 0.5], [L, 1], [R, 1]],
  7: [[L, 0], [R, 0], [C, 0.25], [L, 0.5], [R, 0.5], [L, 1], [R, 1]],
  8: [[L, 0], [R, 0], [C, 0.25], [L, 0.5], [R, 0.5], [C, 0.75], [L, 1], [R, 1]],
  9: [[L, 0], [R, 0], [L, 1 / 3], [R, 1 / 3], [C, 0.5], [L, 2 / 3], [R, 2 / 3], [L, 1], [R, 1]],
  10: [[L, 0], [R, 0], [C, 1 / 6], [L, 1 / 3], [R, 1 / 3], [L, 2 / 3], [R, 2 / 3], [C, 5 / 6], [L, 1], [R, 1]],
}

/** Vector suit shapes in a 100×100 box, used when a suit keeps its standard symbol. Each entry is drawn as separate filled paths. */
export const SUIT_PATHS: Record<string, string[]> = {
  '♥': ['M50 90C22 68 4 50 4 31 4 15 16 5 29 5c10 0 17 6 21 14 4-8 11-14 21-14 13 0 25 10 25 26 0 19-18 37-46 59Z'],
  '♦': ['M50 3Q67 29 88 50 67 71 50 97 33 71 12 50 33 29 50 3Z'],
  '♠': ['M50 4c12 19 44 34 44 57 0 13-10 22-22 22-9 0-16-5-19-11 1 11 5 18 13 24H34c8-6 12-13 13-24-3 6-10 11-19 11-12 0-22-9-22-22C6 38 38 23 50 4Z'],
  '♣': [
    'M31 27a19 19 0 1 0 38 0a19 19 0 1 0-38 0Z',
    'M7 59a19 19 0 1 0 38 0a19 19 0 1 0-38 0Z',
    'M55 59a19 19 0 1 0 38 0a19 19 0 1 0-38 0Z',
    'M40 38h20v26H40Z',
    'M47 58c0 16-4 27-13 38h32c-9-11-13-22-13-38Z',
  ],
}

export function normalizeSymbol(symbol: string): string {
  const s = symbol.replace(/\uFE0F|\uFE0E/g, '')
  const map: Record<string, string> = { '♤': '♠', '♡': '♥', '♢': '♦', '♧': '♣' }
  return map[s] ?? s
}
