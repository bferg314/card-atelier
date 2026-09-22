import { DECK_FORMAT, DECK_VERSION, defaultArtFrame, defaultLettering, type Deck, type Rank, type Suit } from './schema'

export const STANDARD_RANKS: Omit<Rank, 'lettering'>[] = [
  { id: 'A', label: 'A', value: 1 },
  { id: '2', label: '2', value: 2 },
  { id: '3', label: '3', value: 3 },
  { id: '4', label: '4', value: 4 },
  { id: '5', label: '5', value: 5 },
  { id: '6', label: '6', value: 6 },
  { id: '7', label: '7', value: 7 },
  { id: '8', label: '8', value: 8 },
  { id: '9', label: '9', value: 9 },
  { id: '10', label: '10', value: 10 },
  { id: 'J', label: 'J', value: 11 },
  { id: 'Q', label: 'Q', value: 12 },
  { id: 'K', label: 'K', value: 13 },
]

export const FACE_RANKS = new Set(['J', 'Q', 'K'])

interface Theme {
  key: string
  name: string
  blurb: string
  font: string
  indexFont: string
  dark: string
  light: string
  background: string
  border: string
  accent: string
  back: Deck['back']
}

export const THEMES: Theme[] = [
  {
    key: 'classic',
    name: 'Classic',
    blurb: 'Crisp ivory stock, red and black, a navy lattice back.',
    font: 'Playfair Display',
    indexFont: 'Playfair Display',
    dark: '#15151a',
    light: '#c0162c',
    background: '#fdfbf6',
    border: '#d8d2c4',
    accent: '#c9a24b',
    back: { kind: 'pattern', pattern: 'lattice', colors: ['#1c2e57', '#e9dcc0'], image: null, fit: { scale: 1, x: 0, y: 0 }, border: true },
  },
  {
    key: 'noir',
    name: 'Noir',
    blurb: 'Charcoal and silver with a quiet oxblood red.',
    font: 'Cinzel',
    indexFont: 'Cinzel',
    dark: '#1d1d1f',
    light: '#7d1624',
    background: '#f1efea',
    border: '#1d1d1f',
    accent: '#8a8a8f',
    back: { kind: 'pattern', pattern: 'stripes', colors: ['#121214', '#8a8a8f'], image: null, fit: { scale: 1, x: 0, y: 0 }, border: true },
  },
  {
    key: 'deco',
    name: 'Art Deco',
    blurb: 'Emerald and brass, geometric type, a rosette back.',
    font: 'Poiret One',
    indexFont: 'Federo',
    dark: '#0f3d33',
    light: '#a8321e',
    background: '#faf5e8',
    border: '#b8913b',
    accent: '#b8913b',
    back: { kind: 'pattern', pattern: 'rosette', colors: ['#0f3d33', '#d4af5a'], image: null, fit: { scale: 1, x: 0, y: 0 }, border: true },
  },
  {
    key: 'botanical',
    name: 'Botanical',
    blurb: 'Soft sage and terracotta on warm paper.',
    font: 'Cormorant Garamond',
    indexFont: 'Cormorant Garamond',
    dark: '#34513f',
    light: '#b6532f',
    background: '#f7f1e3',
    border: '#c9bb99',
    accent: '#8c9a6a',
    back: { kind: 'pattern', pattern: 'dots', colors: ['#34513f', '#e7dcc0'], image: null, fit: { scale: 1, x: 0, y: 0 }, border: true },
  },
]

function suits(theme: Theme): Suit[] {
  const base = [
    { id: 'spades', name: 'Spades', symbol: '♠', color: theme.dark },
    { id: 'hearts', name: 'Hearts', symbol: '♥', color: theme.light },
    { id: 'diamonds', name: 'Diamonds', symbol: '♦', color: theme.light },
    { id: 'clubs', name: 'Clubs', symbol: '♣', color: theme.dark },
  ]
  return base.map((s) => ({ ...s, font: { family: theme.font, weight: 700 }, pipImage: null }))
}

/** A random v4 UUID. crypto.randomUUID only exists in secure contexts, so plain-http LAN previews fall back to getRandomValues. */
export function newId(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  const b = crypto.getRandomValues(new Uint8Array(16))
  b[6] = (b[6] & 0x0f) | 0x40
  b[8] = (b[8] & 0x3f) | 0x80
  const h = [...b].map((x) => x.toString(16).padStart(2, '0')).join('')
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`
}

export function createDeck(themeKey = 'classic', name?: string): Deck {
  const theme = THEMES.find((t) => t.key === themeKey) ?? THEMES[0]
  const now = new Date().toISOString()
  const families = [...new Set([theme.font, theme.indexFont])]
  return {
    format: DECK_FORMAT,
    version: DECK_VERSION,
    id: newId(),
    name: name ?? `${theme.name} Deck`,
    author: '',
    description: '',
    createdAt: now,
    updatedAt: now,
    card: {
      widthMm: 63.5,
      heightMm: 88.9,
      cornerRadiusMm: 3.5,
      background: theme.background,
      border: { color: theme.border, widthMm: 0.5 },
      accent: theme.accent,
    },
    fonts: families.map((family) => ({ family, source: 'google' as const })),
    suits: suits(theme),
    ranks: STANDARD_RANKS.map((r) => ({ ...r, lettering: defaultLettering() })),
    artFrame: defaultArtFrame(),
    faces: {},
    back: structuredClone(theme.back),
    jokers: {
      enabled: false,
      items: [
        { id: 'joker-1', label: 'JOKER', color: theme.light, font: { family: theme.indexFont, weight: 700 }, image: null, fit: { scale: 1, x: 0, y: 0 } },
        { id: 'joker-2', label: 'JOKER', color: theme.dark, font: { family: theme.indexFont, weight: 700 }, image: null, fit: { scale: 1, x: 0, y: 0 } },
      ],
    },
  }
}
