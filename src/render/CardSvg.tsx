import { useId, type ReactNode } from 'react'
import type { Back, Deck, FontRef, FrameShape, ImageFit, Joker, Lettering, Suit } from '../model/schema'
import type { CardRef } from '../model/resolve'
import { FACE_RANKS } from '../model/presets'
import { artBox } from '../model/artbox'
import { fontStack } from '../fonts/fonts'
import { normalizeSymbol, PIP_LAYOUTS, SUIT_PATHS } from './pips'

interface Props {
  deck: Deck
  /** A card from listCards(), or 'back'. */
  card: CardRef | 'back'
  className?: string
  /** Millimetres of printable bleed on every side. With bleed the card is drawn square and edge to edge. */
  bleedMm?: number
}

/** Renders one card as SVG in millimetre units, so it scales cleanly at any size. */
export function CardSvg({ deck, card, className, bleedMm = 0 }: Props) {
  const uid = 'c' + useId().replace(/[^a-zA-Z0-9]/g, '')
  const { widthMm: W, heightMm: H, cornerRadiusMm: R, background, border } = deck.card
  const inset = border.widthMm / 2
  const b = Math.max(0, bleedMm)
  const title = card === 'back' ? `${deck.name} back` : card.kind === 'joker' ? card.joker.label : `${card.rank.label} of ${card.suit.name}`

  let body: ReactNode
  if (card === 'back') body = <BackArt deck={deck} back={deck.back} uid={uid} bleed={b} />
  else if (card.kind === 'joker') body = <JokerArt deck={deck} joker={card.joker} uid={uid} />
  else body = <StandardArt deck={deck} card={card} uid={uid} />

  return (
    <svg className={className} viewBox={`${-b} ${-b} ${W + 2 * b} ${H + 2 * b}`} role="img" aria-label={title} xmlns="http://www.w3.org/2000/svg">
      <defs>
        <clipPath id={`${uid}-card`}>
          {/* Bleed is meant to be trimmed off, so it is printed square and to the edge. */}
          <rect x={-b} y={-b} width={W + 2 * b} height={H + 2 * b} rx={b > 0 ? 0 : R} />
        </clipPath>
      </defs>
      <g clipPath={`url(#${uid}-card)`}>
        <rect x={-b} y={-b} width={W + 2 * b} height={H + 2 * b} fill={card === 'back' ? deck.back.colors[0] : background} />
        {body}
      </g>
      {border.widthMm > 0 && (
        <rect x={inset} y={inset} width={W - border.widthMm} height={H - border.widthMm} rx={Math.max(0, R - inset)} fill="none" stroke={border.color} strokeWidth={border.widthMm} />
      )}
    </svg>
  )
}

/* ---------- shared pieces ---------- */

function fontProps(font: FontRef) {
  return { fontFamily: fontStack(font.family), fontWeight: font.weight }
}

/** A suit symbol centred on (x, y) with the given height. */
export function Pip({ suit, x, y, size, flip = false }: { suit: Suit; x: number; y: number; size: number; flip?: boolean }) {
  const rotate = flip ? ` rotate(180)` : ''
  if (suit.pipImage) {
    return (
      <g transform={`translate(${x} ${y})${rotate}`}>
        <image href={suit.pipImage} x={-size / 2} y={-size / 2} width={size} height={size} preserveAspectRatio="xMidYMid meet" />
      </g>
    )
  }
  const paths = SUIT_PATHS[normalizeSymbol(suit.symbol)]
  if (paths) {
    const k = size / 100
    return (
      <g transform={`translate(${x} ${y})${rotate} scale(${k}) translate(-50 -50)`} fill={suit.color}>
        {paths.map((d, i) => (
          <path key={i} d={d} />
        ))}
      </g>
    )
  }
  return (
    <g transform={`translate(${x} ${y})${rotate}`}>
      <text x={0} y={0} fontSize={size} textAnchor="middle" dominantBaseline="central" fill={suit.color} {...fontProps(suit.font)}>
        {suit.symbol}
      </text>
    </g>
  )
}

/** An image clipped to a box, covering it, then nudged by the user's scale and offset. */
function FittedImage({ href, x, y, w, h, fit, clipId, align = 'xMidYMid' }: { href: string; x: number; y: number; w: number; h: number; fit: ImageFit; clipId: string; align?: string }) {
  const cx = x + w / 2
  const cy = y + h / 2
  return (
    <>
      <defs>
        <clipPath id={clipId}>
          <rect x={x} y={y} width={w} height={h} />
        </clipPath>
      </defs>
      <g clipPath={`url(#${clipId})`}>
        <g transform={`translate(${cx + (fit.x * w) / 2} ${cy + (fit.y * h) / 2}) scale(${fit.scale}) translate(${-cx} ${-cy})`}>
          <image href={href} x={x} y={y} width={w} height={h} preserveAspectRatio={`${align} slice`} />
        </g>
      </g>
    </>
  )
}

/** Outline of the picture window: a rounded rectangle, an arched top, or an oval. */
export function framePath(shape: FrameShape, x: number, y: number, w: number, h: number, r: number): string {
  const x2 = x + w
  const y2 = y + h
  if (shape === 'oval') {
    const rx = w / 2
    const ry = h / 2
    return `M${x} ${y + ry}A${rx} ${ry} 0 0 1 ${x2} ${y + ry}A${rx} ${ry} 0 0 1 ${x} ${y + ry}Z`
  }
  const k = Math.max(0, Math.min(r, w / 2, h / 2))
  if (shape === 'arch') {
    // Straight sides that spring into a half-ellipse at the top; the foot keeps the corner radius.
    const ry = Math.min(w / 2, h - k)
    return `M${x} ${y + ry}A${w / 2} ${ry} 0 0 1 ${x2} ${y + ry}L${x2} ${y2 - k}Q${x2} ${y2} ${x2 - k} ${y2}L${x + k} ${y2}Q${x} ${y2} ${x} ${y2 - k}Z`
  }
  return `M${x + k} ${y}L${x2 - k} ${y}Q${x2} ${y} ${x2} ${y + k}L${x2} ${y2 - k}Q${x2} ${y2} ${x2 - k} ${y2}L${x + k} ${y2}Q${x} ${y2} ${x} ${y2 - k}L${x} ${y + k}Q${x} ${y} ${x + k} ${y}Z`
}

/** The frame around court card art and pictures, plus the window it clips them to. */
function Panel({ deck, x, y, w, h, tintColor, clipId, children }: { deck: Deck; x: number; y: number; w: number; h: number; tintColor: string; clipId: string; children?: ReactNode }) {
  const f = deck.artFrame
  const s = deck.card.widthMm / 63.5
  const stroke = f.color ?? deck.card.accent
  const width = f.widthMm * s
  const radius = f.cornerRadiusMm * s
  const inner = framePath(f.shape, x, y, w, h, radius)
  const gap = width * 2
  const outer = framePath(f.shape, x - gap, y - gap, w + 2 * gap, h + 2 * gap, radius + gap)
  return (
    <g>
      <defs>
        <clipPath id={clipId}>
          <path d={inner} />
        </clipPath>
      </defs>
      {f.tint > 0 && <path d={inner} fill={tintColor} opacity={f.tint} />}
      <g clipPath={`url(#${clipId})`}>{children}</g>
      {f.lines !== 'none' && <path d={inner} fill="none" stroke={stroke} strokeWidth={width} />}
      {f.lines === 'double' && <path d={outer} fill="none" stroke={stroke} strokeWidth={width * 0.45} />}
    </g>
  )
}

/* ---------- standard cards ---------- */

/** Room kept below the baseline for letters with a tail (J, Q), as a fraction of the font size. */
const DESCENT = 0.3
/** Cap height as a fraction of the font size, used to keep the top of a resized corner label in place. */
const CAP = 0.7

function Corners({ deck, suit, label, lettering }: { deck: Deck; suit: Suit; label: string; lettering: Lettering['corner'] }) {
  const { widthMm: W, heightMm: H } = deck.card
  const s = W / 63.5
  const base = label.length > 1 ? 6.2 * s : 7.2 * s
  const size = base * lettering.scale
  // The top of the label stays put as it grows; the pip moves down to keep clear of any tail.
  const baseline = 9.2 * s - CAP * base + CAP * size
  // The pip grows with the letter, so a resized index stays a matched pair.
  const pipSize = 4.4 * s * lettering.scale
  const pipY = baseline + DESCENT * size + 0.5 * s + pipSize / 2
  const corner = (
    <g transform={`translate(${lettering.x * s} ${lettering.y * s})`}>
      <text x={5 * s} y={baseline} fontSize={size} textAnchor="middle" fill={suit.color} letterSpacing={label.length > 1 ? -0.4 * s * lettering.scale : 0} {...fontProps(suit.font)}>
        {label}
      </text>
      <Pip suit={suit} x={5 * s} y={pipY} size={pipSize} />
    </g>
  )
  return (
    <>
      {corner}
      <g transform={`rotate(180 ${W / 2} ${H / 2})`}>{corner}</g>
    </>
  )
}

function StandardArt({ deck, card, uid }: { deck: Deck; card: Extract<CardRef, { kind: 'standard' }>; uid: string }) {
  const { widthMm: W, heightMm: H, accent } = deck.card
  const s = W / 63.5
  const { suit, rank, face } = card
  const { x: px, y: py, w: pw, h: ph } = artBox(deck.card, deck.artFrame)

  let center: ReactNode
  if (face?.image) {
    if (face.mirror) {
      const half = ph / 2
      center = (
        <Panel deck={deck} x={px} y={py} w={pw} h={ph} tintColor={suit.color} clipId={`${uid}-topframe`}>
          <FittedImage href={face.image} x={px} y={py} w={pw} h={half} fit={face.fit} clipId={`${uid}-top`} align="xMidYMin" />
          <g transform={`rotate(180 ${W / 2} ${H / 2})`}>
            <FittedImage href={face.image} x={px} y={py} w={pw} h={half} fit={face.fit} clipId={`${uid}-bot`} align="xMidYMin" />
          </g>
          <line x1={px} y1={H / 2} x2={px + pw} y2={H / 2} stroke={accent} strokeWidth={0.3} />
        </Panel>
      )
    } else {
      center = (
        <Panel deck={deck} x={px} y={py} w={pw} h={ph} tintColor={suit.color} clipId={`${uid}-fullframe`}>
          <FittedImage href={face.image} x={px} y={py} w={pw} h={ph} fit={face.fit} clipId={`${uid}-full`} />
        </Panel>
      )
    }
  } else if (FACE_RANKS.has(rank.id)) {
    center = <CourtMonogram deck={deck} suit={suit} label={rank.label} lettering={rank.lettering.monogram} clipId={`${uid}-mono`} x={px} y={py} w={pw} h={ph} />
  } else if (rank.value === 1 || rank.id === 'A') {
    center = <AceArt deck={deck} suit={suit} />
  } else {
    const layout = PIP_LAYOUTS[rank.value]
    if (layout) {
      const left = 20 * s
      const right = W - 20 * s
      const top = 18 * s
      const bottom = H - 18 * s
      const size = 9.6 * s
      center = layout.map(([ux, uy], i) => (
        <Pip key={i} suit={suit} x={left + ux * (right - left)} y={top + uy * (bottom - top)} size={size} flip={uy > 0.5} />
      ))
    } else {
      // Non-standard rank value: show the label large in the middle.
      center = (
        <text x={W / 2} y={H / 2} fontSize={22 * s} textAnchor="middle" dominantBaseline="central" fill={suit.color} {...fontProps(suit.font)}>
          {rank.label}
        </text>
      )
    }
  }

  return (
    <>
      {center}
      <Corners deck={deck} suit={suit} label={rank.label} lettering={rank.lettering.corner} />
    </>
  )
}

function AceArt({ deck, suit }: { deck: Deck; suit: Suit }) {
  const { widthMm: W, heightMm: H, accent } = deck.card
  const s = W / 63.5
  const cx = W / 2
  const cy = H / 2
  const ticks = Array.from({ length: 24 }, (_, i) => i * 15)
  return (
    <g>
      <circle cx={cx} cy={cy} r={17 * s} fill="none" stroke={accent} strokeWidth={0.35} />
      <circle cx={cx} cy={cy} r={18.4 * s} fill="none" stroke={accent} strokeWidth={0.15} />
      {ticks.map((a) => (
        <line key={a} x1={cx} y1={cy - 18.4 * s} x2={cx} y2={cy - (a % 45 === 0 ? 20.6 : 19.5) * s} stroke={accent} strokeWidth={0.25} transform={`rotate(${a} ${cx} ${cy})`} />
      ))}
      <Pip suit={suit} x={cx} y={cy} size={22 * s} />
    </g>
  )
}

function CourtMonogram({ deck, suit, label, lettering, clipId, x, y, w, h }: { deck: Deck; suit: Suit; label: string; lettering: Lettering['monogram']; clipId: string; x: number; y: number; w: number; h: number }) {
  const { widthMm: W, heightMm: H, accent } = deck.card
  const s = W / 63.5
  const fontSize = 18 * s * lettering.scale
  const pipY = y + h * 0.385
  const pipSize = 5.6 * s
  // Sit the baseline high enough that a tail (J, Q) clears the pip, then apply the rank's own nudge.
  const baseline = pipY - pipSize / 2 - 1.2 * s - DESCENT * fontSize + lettering.y * s
  const centre = deck.courtCentre
  const half = (
    <g>
      {centre === 'monogram' && (
        <text x={W / 2} y={baseline} fontSize={fontSize} textAnchor="middle" fill={suit.color} {...fontProps(suit.font)}>
          {label}
        </text>
      )}
      {centre !== 'empty' && <Pip suit={suit} x={W / 2} y={centre === 'pip' ? y + h * 0.27 : pipY} size={centre === 'pip' ? pipSize * 2.4 : pipSize} />}
      {centre === 'monogram' && <circle cx={W / 2 - 6 * s} cy={y + h * 0.385} r={0.6 * s} fill={accent} />}
      {centre === 'monogram' && <circle cx={W / 2 + 6 * s} cy={y + h * 0.385} r={0.6 * s} fill={accent} />}
      <path
        d={`M${x + 3 * s} ${y + h * 0.5 - 1.5 * s} Q${W / 2} ${y + h * 0.5 - 6 * s} ${x + w - 3 * s} ${y + h * 0.5 - 1.5 * s}`}
        fill="none"
        stroke={accent}
        strokeWidth={0.3}
      />
    </g>
  )
  // The panel clips its children, so a nudged or enlarged letter is trimmed by the frame.
  return (
    <Panel deck={deck} x={x} y={y} w={w} h={h} tintColor={suit.color} clipId={clipId}>
      {centre !== 'empty' && (
        <>
          {half}
          <g transform={`rotate(180 ${W / 2} ${H / 2})`}>{half}</g>
          <line x1={x} y1={H / 2} x2={x + w} y2={H / 2} stroke={accent} strokeWidth={0.3} />
          <circle cx={W / 2} cy={H / 2} r={1.1 * s} fill={accent} />
        </>
      )}
    </Panel>
  )
}

/* ---------- jokers ---------- */

function JokerArt({ deck, joker, uid }: { deck: Deck; joker: Joker; uid: string }) {
  const { widthMm: W, heightMm: H, accent } = deck.card
  const s = W / 63.5
  const letters = [...joker.label]
  const step = 4.1 * s
  const corner = (
    <text x={5 * s} y={7.5 * s} fontSize={3.8 * s} textAnchor="middle" fill={joker.color} {...fontProps(joker.font)}>
      {letters.map((ch, i) => (
        <tspan key={i} x={5 * s} dy={i === 0 ? 0 : step}>
          {ch}
        </tspan>
      ))}
    </text>
  )
  const { x: px, y: py, w: pw, h: ph } = artBox(deck.card, deck.artFrame)
  return (
    <>
      {joker.image ? (
        <Panel deck={deck} x={px} y={py} w={pw} h={ph} tintColor={joker.color} clipId={`${uid}-jokerartframe`}>
          <FittedImage href={joker.image} x={px} y={py} w={pw} h={ph} fit={joker.fit} clipId={`${uid}-joker`} />
        </Panel>
      ) : (
        <Panel deck={deck} x={px} y={py} w={pw} h={ph} tintColor={joker.color} clipId={`${uid}-jokertypeframe`}>
          <Jester x={W / 2} y={H / 2 - 5 * s} size={30 * s} color={joker.color} accent={accent} />
          <text x={W / 2} y={H / 2 + 20 * s} fontSize={6 * s} textAnchor="middle" fill={joker.color} letterSpacing={0.8 * s} {...fontProps(joker.font)}>
            {joker.label}
          </text>
        </Panel>
      )}
      {corner}
      <g transform={`rotate(180 ${W / 2} ${H / 2})`}>{corner}</g>
    </>
  )
}

/** A simple three-pointed jester's cap with bells. */
function Jester({ x, y, size, color, accent }: { x: number; y: number; size: number; color: string; accent: string }) {
  const k = size / 100
  return (
    <g transform={`translate(${x} ${y}) scale(${k}) translate(-50 -50)`}>
      <path d="M14 78C18 52 12 30 2 18c20 4 34 18 40 40 0-22 2-40 8-54 6 14 8 32 8 54 6-22 20-36 40-40-10 12-16 34-12 60Z" fill={color} />
      <path d="M10 76h80c2 0 4 2 4 5v5c0 3-2 5-4 5H10c-2 0-4-2-4-5v-5c0-3 2-5 4-5Z" fill={accent} />
      <circle cx={2} cy={18} r={4.5} fill={accent} />
      <circle cx={50} cy={4} r={4.5} fill={accent} />
      <circle cx={98} cy={18} r={4.5} fill={accent} />
      {[22, 36, 50, 64, 78].map((cx) => (
        <circle key={cx} cx={cx} cy={83.5} r={2} fill={color} />
      ))}
    </g>
  )
}

/* ---------- backs ---------- */

function BackArt({ deck, back, uid, bleed }: { deck: Deck; back: Back; uid: string; bleed: number }) {
  const { widthMm: W, heightMm: H, cornerRadiusMm: R } = deck.card
  const s = W / 63.5
  const [c0, c1] = back.colors
  const margin = back.border ? 3.2 * s : 0
  const x = margin
  const y = margin
  const w = W - 2 * margin
  const h = H - 2 * margin

  if (back.kind === 'image' && back.image) {
    return (
      <>
        <FittedImage href={back.image} x={0} y={0} w={W} h={H} fit={back.fit} clipId={`${uid}-backimg`} />
        {back.border && <rect x={x} y={y} width={w} height={h} rx={Math.max(0, R - margin / 2)} fill="none" stroke={c1} strokeWidth={0.5} />}
      </>
    )
  }

  const patternId = `${uid}-pat`
  return (
    <>
      <defs>
        <PatternDef id={patternId} pattern={back.pattern} c0={c0} c1={c1} s={s} />
      </defs>
      {back.border && <rect x={-bleed} y={-bleed} width={W + 2 * bleed} height={H + 2 * bleed} fill={c1} opacity={0.12} />}
      {/* Without a border the pattern is the edge of the card, so it runs into the bleed. */}
      <rect
        x={back.border ? x : -bleed}
        y={back.border ? y : -bleed}
        width={back.border ? w : W + 2 * bleed}
        height={back.border ? h : H + 2 * bleed}
        rx={back.border ? Math.max(0, R - margin / 2) : 0}
        fill={back.pattern === 'solid' ? c0 : `url(#${patternId})`}
      />
      {back.border && (
        <>
          <rect x={x} y={y} width={w} height={h} rx={Math.max(0, R - margin / 2)} fill="none" stroke={c1} strokeWidth={0.55} />
          <rect x={x + 1.2 * s} y={y + 1.2 * s} width={w - 2.4 * s} height={h - 2.4 * s} rx={Math.max(0, R - margin)} fill="none" stroke={c1} strokeWidth={0.2} />
          <Medallion deck={deck} c0={c0} c1={c1} />
        </>
      )}
    </>
  )
}

function Medallion({ deck, c0, c1 }: { deck: Deck; c0: string; c1: string }) {
  const { widthMm: W, heightMm: H } = deck.card
  const s = W / 63.5
  const cx = W / 2
  const cy = H / 2
  const r = 9.5 * s
  const spots: [number, number][] = [
    [0, -1],
    [1, 0],
    [0, 1],
    [-1, 0],
  ]
  return (
    <g>
      <circle cx={cx} cy={cy} r={r + 1.4 * s} fill={c0} stroke={c1} strokeWidth={0.2} />
      <circle cx={cx} cy={cy} r={r} fill={c0} stroke={c1} strokeWidth={0.55} />
      {deck.suits.slice(0, 4).map((suit, i) => (
        <Pip key={suit.id} suit={{ ...suit, color: c1 }} x={cx + spots[i][0] * r * 0.52} y={cy + spots[i][1] * r * 0.52} size={4.2 * s} />
      ))}
      <circle cx={cx} cy={cy} r={0.9 * s} fill={c1} />
    </g>
  )
}

function PatternDef({ id, pattern, c0, c1, s }: { id: string; pattern: Back['pattern']; c0: string; c1: string; s: number }) {
  switch (pattern) {
    case 'lattice': {
      const t = 5 * s
      return (
        <pattern id={id} width={t} height={t} patternUnits="userSpaceOnUse">
          <rect width={t} height={t} fill={c0} />
          <path d={`M0 0L${t} ${t}M${t} 0L0 ${t}`} stroke={c1} strokeWidth={0.28} opacity={0.85} />
          <path d={`M${t / 2} ${t * 0.3}L${t * 0.7} ${t / 2}L${t / 2} ${t * 0.7}L${t * 0.3} ${t / 2}Z`} fill={c1} opacity={0.9} />
        </pattern>
      )
    }
    case 'stripes': {
      const t = 2.6 * s
      return (
        <pattern id={id} width={t} height={t} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width={t} height={t} fill={c0} />
          <rect width={t * 0.28} height={t} fill={c1} opacity={0.75} />
        </pattern>
      )
    }
    case 'rosette': {
      const t = 7 * s
      const r = t / 2
      return (
        <pattern id={id} width={t} height={t} patternUnits="userSpaceOnUse">
          <rect width={t} height={t} fill={c0} />
          <g fill="none" stroke={c1} strokeWidth={0.26}>
            <circle cx={0} cy={0} r={r} />
            <circle cx={t} cy={0} r={r} />
            <circle cx={0} cy={t} r={r} />
            <circle cx={t} cy={t} r={r} />
            <circle cx={r} cy={r} r={r} />
          </g>
          <circle cx={r} cy={r} r={0.45 * s} fill={c1} />
        </pattern>
      )
    }
    case 'dots': {
      const t = 3.4 * s
      return (
        <pattern id={id} width={t} height={t} patternUnits="userSpaceOnUse">
          <rect width={t} height={t} fill={c0} />
          <circle cx={t / 4} cy={t / 4} r={0.5 * s} fill={c1} />
          <circle cx={(3 * t) / 4} cy={(3 * t) / 4} r={0.5 * s} fill={c1} />
        </pattern>
      )
    }
    default:
      return (
        <pattern id={id} width={1} height={1} patternUnits="userSpaceOnUse">
          <rect width={1} height={1} fill={c0} />
        </pattern>
      )
  }
}
