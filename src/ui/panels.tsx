import { useStore } from '../state/store'
import { findCard, listCards } from '../model/resolve'
import { FACE_RANKS } from '../model/presets'
import { artBox, artPrompt, cardSubject, ratioAdvice, type ArtArea } from '../model/artbox'
import { BACK_PATTERNS, defaultLettering, type BackPattern, type Deck, type Joker } from '../model/schema'
import { CardSvg } from '../render/CardSvg'
import { ColorField, Field, FitControls, FontPicker, ImageDrop, Section, Segmented, Slider, TextField, Toggle } from './controls'

const SIZES = [
  { key: 'poker', label: 'Poker', w: 63.5, h: 88.9 },
  { key: 'bridge', label: 'Bridge', w: 57.2, h: 88.9 },
  { key: 'tarot', label: 'Tarot', w: 70, h: 120 },
  { key: 'mini', label: 'Mini', w: 44.5, h: 63.5 },
]

const mm = (v: number) => `${v.toFixed(1)} mm`

export function DeckPanel() {
  const deck = useStore((s) => s.deck)
  const update = useStore((s) => s.update)
  const { card } = deck
  const size = SIZES.find((s) => s.w === card.widthMm && s.h === card.heightMm)?.key ?? 'custom'

  return (
    <>
      <Section title="Details">
        <Field label="Deck name">
          <TextField value={deck.name} maxLength={80} onChange={(v) => update((d) => void (d.name = v || 'Untitled deck'), 'name')} />
        </Field>
        <Field label="Designer">
          <TextField value={deck.author} placeholder="Your name" maxLength={80} onChange={(v) => update((d) => void (d.author = v), 'author')} />
        </Field>
        <Field label="Notes">
          <textarea className="input" rows={2} value={deck.description} placeholder="What games is this deck for?" onChange={(e) => update((d) => void (d.description = e.target.value), 'desc')} />
        </Field>
      </Section>

      <Section title="Card stock">
        <Field label="Size">
          <Segmented
            value={size}
            options={[...SIZES.map((s) => ({ value: s.key, label: s.label })), { value: 'custom', label: 'Custom' }]}
            onChange={(k) => {
              const s = SIZES.find((x) => x.key === k)
              if (s) update((d) => void ((d.card.widthMm = s.w), (d.card.heightMm = s.h)))
            }}
          />
        </Field>
        <div className="row2">
          <Field label="Width">
            <Slider value={card.widthMm} min={40} max={90} step={0.1} format={mm} onChange={(v) => update((d) => void (d.card.widthMm = v), 'w')} />
          </Field>
          <Field label="Height">
            <Slider value={card.heightMm} min={55} max={130} step={0.1} format={mm} onChange={(v) => update((d) => void (d.card.heightMm = v), 'h')} />
          </Field>
        </div>
        <Field label="Corner radius">
          <Slider value={card.cornerRadiusMm} min={0} max={8} step={0.1} format={mm} onChange={(v) => update((d) => void (d.card.cornerRadiusMm = v), 'r')} />
        </Field>
        <div className="row2">
          <Field label="Paper">
            <ColorField value={card.background} onChange={(v) => update((d) => void (d.card.background = v), 'bg')} />
          </Field>
          <Field label="Accent" hint="Frames and ornaments">
            <ColorField value={card.accent} onChange={(v) => update((d) => void (d.card.accent = v), 'accent')} />
          </Field>
        </div>
        <div className="row2">
          <Field label="Edge color">
            <ColorField value={card.border.color} onChange={(v) => update((d) => void (d.card.border.color = v), 'bc')} />
          </Field>
          <Field label="Edge width">
            <Slider value={card.border.widthMm} min={0} max={2} step={0.05} format={mm} onChange={(v) => update((d) => void (d.card.border.widthMm = v), 'bw')} />
          </Field>
        </div>
      </Section>
    </>
  )
}

export function SuitsPanel() {
  const deck = useStore((s) => s.deck)
  const update = useStore((s) => s.update)
  const select = useStore((s) => s.select)
  return (
    <>
      <p className="panel-note">Each suit has its own color, typeface and symbol. Replace the symbol with a picture to design your own suit marks.</p>
      <Section title="Shortcuts">
        <div className="button-row">
          <button type="button" className="btn ghost" onClick={() => update((d) => d.suits.forEach((s) => (s.font = { ...d.suits[0].font })))}>
            Use the {deck.suits[0].name} typeface on every suit
          </button>
        </div>
      </Section>
      {deck.suits.map((suit, i) => (
        <Section
          key={suit.id}
          title={suit.name}
          aside={
            <button type="button" className="suit-chip" style={{ color: suit.color }} onClick={() => select(`${suit.id}-${deck.ranks[0].id}`)} title={`Preview the ${suit.name}`}>
              {suit.symbol}
            </button>
          }
        >
          <div className="row2">
            <Field label="Name">
              <TextField value={suit.name} maxLength={24} onChange={(v) => update((d) => void (d.suits[i].name = v || suit.id), `sn${i}`)} />
            </Field>
            <Field label="Symbol">
              <TextField value={suit.symbol} maxLength={4} onChange={(v) => v && update((d) => void (d.suits[i].symbol = v), `ss${i}`)} />
            </Field>
          </div>
          <Field label="Color">
            <ColorField value={suit.color} onChange={(v) => update((d) => void (d.suits[i].color = v), `sc${i}`)} />
          </Field>
          <Field label="Typeface">
            <FontPicker value={suit.font} onChange={(f) => update((d) => void (d.suits[i].font = f))} />
          </Field>
          <Field label="Custom pip picture" hint="Replaces the symbol on every card of this suit. Transparent PNG or SVG works best.">
            <ImageDrop value={suit.pipImage} maxEdge={512} onChange={(v) => update((d) => void (d.suits[i].pipImage = v))} label="Drop a pip image" />
          </Field>
        </Section>
      ))}
    </>
  )
}

export function ArtworkPanel() {
  const deck = useStore((s) => s.deck)
  const selectedId = useStore((s) => s.selectedId)
  const update = useStore((s) => s.update)
  const select = useStore((s) => s.select)
  const card = findCard(deck, selectedId)
  const withArt = listCards(deck).filter((c) => c.kind === 'standard' && c.face?.image)

  if (!card) return <p className="panel-note">Select a card in the deck to add artwork.</p>
  if (card.kind === 'joker') return <JokerEditor index={deck.jokers.items.findIndex((j) => j.id === card.id)} />

  const face = card.face ?? { image: null, fit: { scale: 1, x: 0, y: 0 }, mirror: true }
  const subject = { subject: cardSubject(card.rank, card.suit.name), court: FACE_RANKS.has(card.rank.id), colors: [card.suit.color, deck.card.accent] }
  const setFace = (patch: Partial<typeof face>, key?: string) =>
    update((d) => {
      const next = { ...face, ...patch }
      if (next.image) d.faces[card.id] = next
      else delete d.faces[card.id]
    }, key)

  return (
    <>
      <p className="panel-note">
        Pictures work on any card. Court cards (J, Q, K) look best with a portrait drawn as a mirrored top half, like a traditional deck. Pick a card from the deck below to edit it.
      </p>
      <Section title={`${card.rank.label} of ${card.suit.name}`}>
        <ImageDrop value={face.image} onChange={(image) => setFace({ image })} />
        {face.image ? (
          <ArtGuide card={deck.card} area={face.mirror ? 'half' : 'full'} {...subject} />
        ) : (
          <>
            <ArtGuide card={deck.card} area="half" {...subject} />
            <ArtGuide card={deck.card} area="full" {...subject} />
          </>
        )}
        {face.image && (
          <>
            <Toggle checked={face.mirror} onChange={(mirror) => setFace({ mirror })} label="Mirror top and bottom (double-ended)" />
            <FitControls fit={face.fit} onChange={(fit) => setFace({ fit }, `fit-${card.id}`)} />
          </>
        )}
        {!face.image && FACE_RANKS.has(card.rank.id) && <p className="field-hint">Without a picture this card shows a typographic monogram in the suit’s typeface.</p>}
      </Section>
      <LetteringControls rankId={card.rank.id} monogram={FACE_RANKS.has(card.rank.id) && !face.image} />
      {face.image && (
        <Section title="Copy to">
          <div className="button-row">
            <button type="button" className="btn ghost" onClick={() => update((d) => deck.suits.forEach((s) => (d.faces[`${s.id}-${card.rank.id}`] = structuredClone(face))))}>
              Every {card.rank.label}
            </button>
            <button type="button" className="btn ghost" onClick={() => update((d) => deck.ranks.filter((r) => FACE_RANKS.has(r.id)).forEach((r) => (d.faces[`${card.suit.id}-${r.id}`] = structuredClone(face))))}>
              All {card.suit.name} court cards
            </button>
          </div>
        </Section>
      )}
      {withArt.length > 0 && (
        <Section title={`Cards with pictures (${withArt.length})`}>
          <div className="mini-cards">
            {withArt.map((c) => (
              <button key={c.id} type="button" className={`mini-card ${c.id === selectedId ? 'on' : ''}`} onClick={() => select(c.id)}>
                <CardSvg deck={deck} card={c} />
              </button>
            ))}
          </div>
        </Section>
      )}
    </>
  )
}

const PATTERN_LABELS: Record<BackPattern, string> = { lattice: 'Lattice', stripes: 'Pinstripe', rosette: 'Rosette', dots: 'Dots', solid: 'Solid' }

export function BackPanel() {
  const deck = useStore((s) => s.deck)
  const update = useStore((s) => s.update)
  const setShowBack = useStore((s) => s.setShowBack)
  const { back } = deck
  const edit = (fn: (d: Deck) => void, key?: string) => {
    setShowBack(true)
    update(fn, key)
  }

  return (
    <>
      <Section title="Style">
        <Segmented
          value={back.kind}
          options={[
            { value: 'pattern', label: 'Pattern' },
            { value: 'image', label: 'Picture' },
          ]}
          onChange={(k) => edit((d) => void (d.back.kind = k))}
        />
        {back.kind === 'pattern' ? (
          <div className="pattern-grid">
            {BACK_PATTERNS.map((p) => (
              <button key={p} type="button" className={`pattern-tile ${back.pattern === p ? 'on' : ''}`} onClick={() => edit((d) => void (d.back.pattern = p))}>
                <CardSvg deck={{ ...deck, back: { ...back, kind: 'pattern', pattern: p } }} card="back" />
                <span>{PATTERN_LABELS[p]}</span>
              </button>
            ))}
          </div>
        ) : (
          <>
            <ImageDrop value={back.image} onChange={(image) => edit((d) => void (d.back.image = image))} />
            <ArtGuide card={deck.card} area="back" subject="" court={false} colors={back.colors} />
            {back.image && <FitControls fit={back.fit} onChange={(fit) => edit((d) => void (d.back.fit = fit), 'backfit')} />}
          </>
        )}
      </Section>
      <Section title="Colors">
        <div className="row2">
          <Field label="Ground">
            <ColorField value={back.colors[0]} onChange={(v) => edit((d) => void (d.back.colors[0] = v), 'bc0')} />
          </Field>
          <Field label="Ink">
            <ColorField value={back.colors[1]} onChange={(v) => edit((d) => void (d.back.colors[1] = v), 'bc1')} />
          </Field>
        </div>
        <button type="button" className="btn ghost small" onClick={() => edit((d) => void (d.back.colors = [d.back.colors[1], d.back.colors[0]]))}>
          Swap colors
        </button>
      </Section>
      <Section title="Frame">
        <Toggle checked={back.border} onChange={(v) => edit((d) => void (d.back.border = v))} label="White border with centre medallion" />
      </Section>
    </>
  )
}

export function JokersPanel() {
  const deck = useStore((s) => s.deck)
  const update = useStore((s) => s.update)
  const select = useStore((s) => s.select)
  const { jokers } = deck
  const base = deck.suits.length * deck.ranks.length

  function setCount(n: number) {
    update((d) => {
      const items = d.jokers.items
      while (items.length < n) {
        const src = items[items.length - 1] ?? { label: 'JOKER', color: d.suits[0].color, font: d.suits[0].font }
        items.push({ id: nextJokerId(items), label: src.label, color: src.color, font: { ...src.font }, image: null, fit: { scale: 1, x: 0, y: 0 } })
      }
      items.length = n
    })
  }

  return (
    <>
      <Section title="Jokers">
        <Toggle
          checked={jokers.enabled}
          onChange={(v) => {
            update((d) => void (d.jokers.enabled = v))
            if (v && jokers.items[0]) select(jokers.items[0].id)
          }}
          label={jokers.enabled ? `Included (${base + jokers.items.length} cards)` : `Not included (${base} cards)`}
        />
        {jokers.enabled && (
          <Field label="How many">
            <Segmented value={String(jokers.items.length)} options={['1', '2', '3', '4'].map((n) => ({ value: n, label: n }))} onChange={(n) => setCount(Number(n))} />
          </Field>
        )}
      </Section>
      {jokers.enabled && jokers.items.map((_, i) => <JokerEditor key={jokers.items[i].id} index={i} />)}
    </>
  )
}

function nextJokerId(items: Joker[]): string {
  let n = items.length + 1
  while (items.some((j) => j.id === `joker-${n}`)) n++
  return `joker-${n}`
}

function JokerEditor({ index }: { index: number }) {
  const joker = useStore((s) => s.deck.jokers.items[index])
  const cardSize = useStore((s) => s.deck.card)
  const update = useStore((s) => s.update)
  const select = useStore((s) => s.select)
  if (!joker) return null
  const set = (fn: (j: Joker) => void, key?: string) => update((d) => fn(d.jokers.items[index]), key)
  return (
    <Section
      title={`Joker ${index + 1}`}
      aside={
        <button type="button" className="btn ghost small" onClick={() => select(joker.id)}>
          Preview
        </button>
      }
    >
      <div className="row2">
        <Field label="Label">
          <TextField value={joker.label} maxLength={12} onChange={(v) => set((j) => void (j.label = v || 'JOKER'), `jl${index}`)} />
        </Field>
        <Field label="Color">
          <ColorField value={joker.color} onChange={(v) => set((j) => void (j.color = v), `jc${index}`)} />
        </Field>
      </div>
      <Field label="Typeface">
        <FontPicker value={joker.font} onChange={(f) => set((j) => void (j.font = f))} />
      </Field>
      <Field label="Picture">
        <ImageDrop value={joker.image} onChange={(v) => set((j) => void (j.image = v))} />
      </Field>
      <ArtGuide card={cardSize} area="full" subject="the Joker" court colors={[joker.color]} />
      {joker.image && <FitControls fit={joker.fit} onChange={(fit) => set((j) => void (j.fit = fit), `jf${index}`)} />}
    </Section>
  )
}

/** Upload limit applied by ImageDrop, mirrored here so the guidance can warn about it. */
const IMPORT_MAX_EDGE = 1024

/** Tells the artist what shape and size to generate for a picture slot on the current card size. */
function ArtGuide({ card, area, subject, court, colors }: { card: Deck['card']; area: ArtArea; subject: string; court: boolean; colors: string[] }) {
  const notify = useStore((s) => s.notify)
  const box = artBox(card)
  const [w, h] = area === 'back' ? [card.widthMm, card.heightMm] : area === 'half' ? [box.w, box.h / 2] : [box.w, box.h]
  const a = ratioAdvice(w, h)
  const what = area === 'back' ? 'The back picture covers the full card,' : area === 'half' ? 'Mirrored (double-ended): each half is' : 'Single picture: the window is'
  const size = `${w.toFixed(1)} × ${h.toFixed(1)} mm`
  // Mirrored halves are pinned to the top edge, so any vertical excess comes off the bottom only.
  const edges = area === 'half' && a.cropAxis === 'top and bottom' ? 'bottom' : a.cropAxis
  const crop = a.cropAxis === 'none' ? 'with no cropping' : `losing about ${Math.round(a.cropped * 100)}% off the ${edges}`
  const overCap = Math.max(a.px.w, a.px.h) > IMPORT_MAX_EDGE
  return (
    <div className="art-guide">
      <p className="field-hint">
        {what} {size}. Generate at <strong>{a.preset}</strong> {a.w >= a.h ? 'landscape' : 'portrait'}; it fills the window {crop}.
        {area === 'half' && ' Draw only the top half of the figure (head to waist), anchored to the top edge; the card rotates a copy for the bottom.'}
        {area === 'back' && ' The rounded corners trim the image, so keep detail away from them.'}
      </p>
      <p className="field-hint">
        For sharp print at 300 dpi you need {a.px.w} × {a.px.h} px.{' '}
        {overCap ? `Uploads are scaled to ${IMPORT_MAX_EDGE} px on the long edge, so print will be a little under 300 dpi.` : 'Larger uploads are fine; they are scaled down on import.'}
      </p>
      <button
        type="button"
        className="btn ghost small"
        onClick={() =>
          navigator.clipboard.writeText(artPrompt({ area, subject, court, advice: a, colors })).then(
            () => notify('Prompt copied. Add your own style before generating.'),
            () => notify('The clipboard is not available in this browser.', 'error'),
          )
        }
      >
        Copy prompt
      </button>
    </div>
  )
}

/** Size and position of the corner index and court monogram, shared by every card of one rank. */
function LetteringControls({ rankId, monogram }: { rankId: string; monogram: boolean }) {
  const index = useStore((s) => s.deck.ranks.findIndex((r) => r.id === rankId))
  const rank = useStore((s) => s.deck.ranks[index])
  const update = useStore((s) => s.update)
  if (!rank) return null
  const { corner, monogram: mono } = rank.lettering
  const set = (field: string, fn: (l: typeof rank.lettering) => void) => update((d) => fn(d.ranks[index].lettering), `letter-${rankId}-${field}`)
  const pct = (v: number) => `${Math.round(v * 100)}%`
  const offset = (v: number) => `${v > 0 ? '+' : ''}${v.toFixed(1)} mm`
  const changed = JSON.stringify(rank.lettering) !== JSON.stringify(defaultLettering())
  return (
    <Section
      title={`Lettering (every ${rank.label})`}
      aside={
        changed && (
          <button type="button" className="btn ghost small" onClick={() => update((d) => void (d.ranks[index].lettering = defaultLettering()))}>
            Reset
          </button>
        )
      }
    >
      <div className="fit-controls">
        <p className="field-hint">Corner index</p>
        <Field label="Size">
          <Slider value={corner.scale} min={0.5} max={2} step={0.01} onChange={(v) => set('corner-scale', (l) => void (l.corner.scale = v))} format={pct} />
        </Field>
        <Field label="Horizontal">
          <Slider value={corner.x} min={-5} max={5} step={0.1} onChange={(v) => set('corner-x', (l) => void (l.corner.x = v))} format={offset} />
        </Field>
        <Field label="Vertical">
          <Slider value={corner.y} min={-5} max={5} step={0.1} onChange={(v) => set('corner-y', (l) => void (l.corner.y = v))} format={offset} />
        </Field>
        {monogram && (
          <>
            <p className="field-hint">Centre monogram</p>
            <Field label="Size">
              <Slider value={mono.scale} min={0.5} max={2} step={0.01} onChange={(v) => set('monogram-scale', (l) => void (l.monogram.scale = v))} format={pct} />
            </Field>
            <Field label="Vertical">
              <Slider value={mono.y} min={-15} max={15} step={0.1} onChange={(v) => set('monogram-y', (l) => void (l.monogram.y = v))} format={offset} />
            </Field>
          </>
        )}
      </div>
    </Section>
  )
}
