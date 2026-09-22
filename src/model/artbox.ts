import type { Deck } from './schema'

export interface Box {
  x: number
  y: number
  w: number
  h: number
}

/** The framed picture window on a face card or joker, in mm. Shared by the renderer and the art guidance. */
export function artBox(card: Deck['card']): Box {
  const inset = 11.5 * (card.widthMm / 63.5)
  return { x: inset, y: inset, w: card.widthMm - 2 * inset, h: card.heightMm - 2 * inset }
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
