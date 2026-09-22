import { z } from 'zod'

export const DECK_FORMAT = 'playing-card-deck'
export const DECK_VERSION = 1

const color = z.string().regex(/^#[0-9a-fA-F]{3,8}$/, 'must be a hex color like #1a1a1a')
const dataUri = z.string().startsWith('data:', 'must be a data: URI')

export const FontRef = z.object({
  family: z.string().min(1),
  weight: z.number().int().min(100).max(900).default(700),
})

export const FontSource = z.discriminatedUnion('source', [
  z.object({ family: z.string().min(1), source: z.literal('google') }),
  z.object({ family: z.string().min(1), source: z.literal('system') }),
  z.object({ family: z.string().min(1), source: z.literal('embedded'), data: dataUri }),
])

export const ImageFit = z.object({
  scale: z.number().min(0.1).max(5).default(1),
  x: z.number().min(-1).max(1).default(0),
  y: z.number().min(-1).max(1).default(0),
})

export const Suit = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  symbol: z.string().min(1),
  color: color,
  font: FontRef,
  pipImage: dataUri.nullable().default(null),
})

/** Per-rank nudges to the corner index and court monogram. Offsets are mm at poker width and scale with the card. */
export const Lettering = z.object({
  corner: z
    .object({
      scale: z.number().min(0.5).max(2).default(1),
      x: z.number().min(-5).max(5).default(0),
      y: z.number().min(-5).max(5).default(0),
    })
    .default({ scale: 1, x: 0, y: 0 }),
  monogram: z
    .object({
      scale: z.number().min(0.5).max(2).default(1),
      y: z.number().min(-15).max(15).default(0),
    })
    .default({ scale: 1, y: 0 }),
})

export function defaultLettering(): Lettering {
  return { corner: { scale: 1, x: 0, y: 0 }, monogram: { scale: 1, y: 0 } }
}

export const Rank = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  value: z.number(),
  lettering: Lettering.default(defaultLettering),
})

export const Face = z.object({
  image: dataUri.nullable().default(null),
  fit: ImageFit.default({ scale: 1, x: 0, y: 0 }),
  mirror: z.boolean().default(true),
})

export const BACK_PATTERNS = ['lattice', 'stripes', 'rosette', 'dots', 'solid'] as const

export const Back = z.object({
  kind: z.enum(['pattern', 'image']),
  pattern: z.enum(BACK_PATTERNS),
  colors: z.tuple([color, color]),
  image: dataUri.nullable().default(null),
  fit: ImageFit.default({ scale: 1, x: 0, y: 0 }),
  border: z.boolean().default(true),
})

export const Joker = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  color: color,
  font: FontRef,
  image: dataUri.nullable().default(null),
  fit: ImageFit.default({ scale: 1, x: 0, y: 0 }),
})

export const FRAME_SHAPES = ['rect', 'arch', 'oval'] as const

/** The frame around the picture window on face cards and jokers. Lengths are mm at poker width and scale with the card. */
export const ArtFrame = z.object({
  shape: z.enum(FRAME_SHAPES).default('rect'),
  marginXMm: z.number().min(0).max(28).default(11.5),
  marginYMm: z.number().min(0).max(40).default(11.5),
  cornerRadiusMm: z.number().min(0).max(20).default(0),
  lines: z.enum(['double', 'single', 'none']).default('double'),
  widthMm: z.number().min(0.05).max(3).default(0.45),
  color: color.nullable().default(null).describe('Frame colour, or null to follow the deck accent.'),
  tint: z.number().min(0).max(0.4).default(0).describe('How strongly the suit colour washes the window behind the art.'),
})

export function defaultArtFrame(): ArtFrame {
  return { shape: 'rect', marginXMm: 11.5, marginYMm: 11.5, cornerRadiusMm: 0, lines: 'double', widthMm: 0.45, color: null, tint: 0 }
}

export const CardSpec = z.object({
  widthMm: z.number().min(30).max(150),
  heightMm: z.number().min(40).max(200),
  cornerRadiusMm: z.number().min(0).max(15),
  background: color,
  border: z.object({ color: color, widthMm: z.number().min(0).max(5) }),
  accent: color,
})

export const ResolvedCard = z.object({
  id: z.string(),
  kind: z.enum(['standard', 'joker']),
  suit: z.string().nullable(),
  rank: z.string().nullable(),
  value: z.number().nullable(),
  label: z.string(),
  color: color,
})

export const Deck = z.object({
  format: z.literal(DECK_FORMAT),
  version: z.literal(DECK_VERSION),
  id: z.string().min(1),
  name: z.string().min(1),
  author: z.string().default(''),
  description: z.string().default(''),
  createdAt: z.string(),
  updatedAt: z.string(),
  card: CardSpec,
  fonts: z.array(FontSource).default([]),
  suits: z.array(Suit).min(1),
  ranks: z.array(Rank).min(1),
  artFrame: ArtFrame.default(defaultArtFrame),
  faces: z.record(z.string(), Face).default({}),
  back: Back,
  jokers: z.object({ enabled: z.boolean(), items: z.array(Joker) }),
  /** Resolved flat card list, written on export for consuming games. Ignored on import. */
  cards: z.array(ResolvedCard).optional(),
})

export type FontRef = z.infer<typeof FontRef>
export type FontSource = z.infer<typeof FontSource>
export type ImageFit = z.infer<typeof ImageFit>
export type Suit = z.infer<typeof Suit>
export type Rank = z.infer<typeof Rank>
export type Lettering = z.infer<typeof Lettering>
export type Face = z.infer<typeof Face>
export type Back = z.infer<typeof Back>
export type BackPattern = (typeof BACK_PATTERNS)[number]
export type Joker = z.infer<typeof Joker>
export type ArtFrame = z.infer<typeof ArtFrame>
export type FrameShape = (typeof FRAME_SHAPES)[number]
export type CardSpec = z.infer<typeof CardSpec>
export type ResolvedCard = z.infer<typeof ResolvedCard>
export type Deck = z.infer<typeof Deck>

/** Upgrade older deck files to the current version. Version 1 is the first, so this is the hook for later changes. */
export function migrate(raw: unknown): unknown {
  if (raw && typeof raw === 'object' && 'version' in raw) {
    const v = (raw as { version: unknown }).version
    if (typeof v === 'number' && v > DECK_VERSION) {
      throw new Error(`This deck was made with a newer version of the format (v${v}); this app reads up to v${DECK_VERSION}.`)
    }
  }
  return raw
}
