import type { ArtFrame, Deck } from './schema'

export interface Box {
  x: number
  y: number
  w: number
  h: number
}

/** The framed picture window on a face card or joker, in mm. Shared by the renderer and the art guidance. */
export function artBox(card: Deck['card'], frame: ArtFrame): Box {
  const s = card.widthMm / 63.5
  const x = Math.min(frame.marginXMm * s, card.widthMm / 2 - 2)
  const y = Math.min(frame.marginYMm * s, card.heightMm / 2 - 2)
  return { x, y, w: card.widthMm - 2 * x, h: card.heightMm - 2 * y }
}

/** Cap height as a share of the font size: how much of a capital letter is actually ink. */
export const INDEX_CAP = 0.7

/** Font size of a rank's corner index, in mm. Two-character ranks like "10" are set a little smaller. */
export function indexFontSize(card: Deck['card'], rank: { label: string; lettering: { corner: { scale: number } } }): number {
  const s = card.widthMm / 63.5
  return (rank.label.length > 1 ? 6.2 : 7.2) * s * rank.lettering.corner.scale
}

/** Drawn height of a rank's corner index, in mm. */
export function indexHeightMm(card: Deck['card'], rank: { label: string; lettering: { corner: { scale: number } } }): number {
  return INDEX_CAP * indexFontSize(card, rank)
}

/** Ratios that common image generators offer as presets. */
const COMMON_RATIOS: [number, number][] = [
  [1, 1], [5, 4], [4, 5], [4, 3], [3, 4], [3, 2], [2, 3], [7, 5], [5, 7], [16, 9], [9, 16], [2, 1], [1, 2],
]

export interface RatioAdvice {
  /** Exact window size in mm. */
  w: number
  h: number
  /** Nearest common preset, e.g. "2:3". */
  preset: string
  /** Share of the generated image that gets cropped away to fill the window, 0 to 1. */
  cropped: number
  /** Which edges lose the crop. */
  cropAxis: 'sides' | 'top and bottom' | 'none'
  /** Minimum pixel size for sharp print at 300 dpi. */
  px: { w: number; h: number }
}

export function ratioAdvice(w: number, h: number): RatioAdvice {
  const target = w / h
  let best = COMMON_RATIOS[0]
  for (const r of COMMON_RATIOS) if (Math.abs(Math.log(r[0] / r[1] / target)) < Math.abs(Math.log(best[0] / best[1] / target))) best = r
  const presetRatio = best[0] / best[1]
  // The picture is scaled to cover the window, so the wider of the two loses its excess.
  const cropped = 1 - Math.min(presetRatio, target) / Math.max(presetRatio, target)
  const cropAxis = cropped < 0.005 ? 'none' : presetRatio > target ? 'sides' : 'top and bottom'
  const dots = (v: number) => Math.ceil(((v / 25.4) * 300) / 10) * 10
  return { w, h, preset: `${best[0]}:${best[1]}`, cropped, cropAxis, px: { w: dots(w), h: dots(h) } }
}

export type ArtArea = 'full' | 'half' | 'back'

const COURT_NAMES: Record<string, string> = { A: 'Ace', J: 'Jack', Q: 'Queen', K: 'King' }

/** How a card reads in a prompt, e.g. "the King of Hearts". */
export function cardSubject(rank: { id: string; label: string }, suitName: string): string {
  return `the ${COURT_NAMES[rank.id] ?? rank.label} of ${suitName}`
}

/**
 * A starting prompt for an image generator: subject, composition for the slot, and the shape to ask for.
 * The ratio is spelled out in words because generators disagree on flags (Midjourney's --ar, others' size presets).
 */
export function artPrompt({ area, subject, court, advice, colors }: { area: ArtArea; subject: string; court: boolean; advice: RatioAdvice; colors: string[] }): string {
  const shape = `${advice.preset} ${advice.w >= advice.h ? 'landscape' : 'portrait'}`
  const lines: string[] = []
  if (area === 'back') {
    lines.push('Playing card back design: an ornamental pattern that looks the same when the card is turned upside down (180° rotational symmetry).')
    lines.push('Edge to edge, no focal point near the corners, which are rounded off.')
  } else if (area === 'half') {
    lines.push(court ? `Illustration of ${subject} for a playing card, traditional double-ended court card style.` : `Illustration for ${subject}, a double-ended playing card.`)
    lines.push('Show the figure from the head to the waist only, facing forward, with the head close to the top edge. The bottom edge is where the mirrored copy joins, so let the figure run off it cleanly.')
  } else {
    lines.push(court ? `Full-length illustration of ${subject} for a playing card.` : `Illustration for ${subject}, a playing card.`)
    lines.push('Subject centred and filling the frame, with a little breathing room at every edge.')
  }
  if (colors.length) lines.push(`Palette built around ${colors.join(', ')}.`)
  lines.push('No text, letters, numbers, card corners, borders or frame; the card adds those.')
  lines.push(`Aspect ratio ${shape}, at least ${advice.px.w} × ${advice.px.h} px.`)
  return lines.join(' ')
}
