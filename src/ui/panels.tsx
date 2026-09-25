import { useState } from 'react'
import { useStore } from '../state/store'
import { findCard, listCards } from '../model/resolve'
import { FACE_RANKS } from '../model/presets'
import { artBox, artPrompt, cardSubject, ratioAdvice, type ArtArea } from '../model/artbox'
import { BACK_PATTERNS, COURT_CENTRES, defaultArtFrame, defaultLettering, FRAME_SHAPES, type BackPattern, type Deck, type Joker } from '../model/schema'
import { CardSvg } from '../render/CardSvg'
import { ColorField, Field, FitControls, FontPicker, HelpTip, ImageDrop, Section, Segmented, Select, Slider, TextField, Toggle } from './controls'
import { IconSparkles, IconCopy, IconFlip } from './icons'

const SIZES = [
  { key: 'poker', label: 'Poker (63.5 × 88.9)', w: 63.5, h: 88.9 },
  { key: 'bridge', label: 'Bridge (57.2 × 88.9)', w: 57.2, h: 88.9 },
  { key: 'tarot', label: 'Tarot (70 × 120)', w: 70, h: 120 },
  { key: 'mini', label: 'Mini (44.5 × 63.5)', w: 44.5, h: 63.5 },
]

const mm = (v: number) => `${v.toFixed(1)} mm`

const LICENCES = [
  { value: '', label: 'Unstated (Default)', blurb: 'No explicit license stated. Anyone wishing to reuse this deck must seek your permission.' },
  { value: 'CC-BY-4.0', label: 'CC BY 4.0', blurb: 'Anyone may use the deck, including commercially in video games or print, with attribution.' },
  { value: 'CC0-1.0', label: 'CC0 1.0 (Public Domain)', blurb: 'Dedicated to the public domain: free for any use with no conditions.' },
  { value: 'CC-BY-SA-4.0', label: 'CC BY-SA 4.0', blurb: 'Free to share and adapt, but derivatives must carry the exact same license.' },
  { value: 'All rights reserved', label: 'All Rights Reserved', blurb: 'Explicitly proprietary: all rights reserved by the author.' },
  { value: 'other', label: 'Other SPDX ID…', blurb: 'Custom license identifier (e.g. MIT, Apache-2.0).' },
]

function LicenceField() {
  const license = useStore((s) => s.deck.license)
  const update = useStore((s) => s.update)
  const [writingOwn, setWritingOwn] = useState(false)
  const known = LICENCES.some((l) => l.value === license && l.value !== 'other')
  const choice = known && !writingOwn ? license : 'other'

  return (
    <Field
      label="Licence"
      hint="Written into the Open Playing Cards export header"
      help={
        <HelpTip label="What these licences mean">
          <strong>How others may use this deck</strong>
          {LICENCES.map((l) => (
            <span key={l.value || 'none'}>
              <em>{l.label}:</em> {l.blurb}
            </span>
          ))}
          <span>The licence covers your card composition, not external artwork or fonts you brought in.</span>
        </HelpTip>
      }
    >
      <Select
        value={choice}
        options={LICENCES.map(({ value, label }) => ({ value, label }))}
        onChange={(v) => {
          setWritingOwn(v === 'other')
          if (v !== 'other') update((d) => void (d.license = v))
        }}
      />
      {choice === 'other' && (
        <TextField
          value={license}
          placeholder="e.g. MIT or Proprietary"
          maxLength={80}
          onChange={(v) => update((d) => void (d.license = v), 'license')}
        />
      )}
    </Field>
  )
}

export function DeckPanel() {
  const deck = useStore((s) => s.deck)
  const update = useStore((s) => s.update)
  const { card } = deck
  const size = SIZES.find((s) => s.w === card.widthMm && s.h === card.heightMm)?.key ?? 'custom'

  return (
    <>
      <Section title="Deck Details">
        <Field label="Deck Name">
          <TextField
            value={deck.name}
            maxLength={80}
            onChange={(v) => update((d) => void (d.name = v || 'Untitled deck'), 'name')}
          />
        </Field>
        <Field label="Designer / Atelier">
          <TextField
            value={deck.author}
            placeholder="Atelier Master or Studio Name"
            maxLength={80}
            onChange={(v) => update((d) => void (d.author = v), 'author')}
          />
        </Field>
        <div className="row2">
          <LicenceField />
          <Field label="Source URL">
            <TextField
              value={deck.source}
              placeholder="https://atelier.cards/deck"
              maxLength={200}
              onChange={(v) => update((d) => void (d.source = v), 'source')}
            />
          </Field>
        </div>
        <Field label="Archival Notes">
          <textarea
            className="input"
            rows={2}
            aria-label="Notes"
            value={deck.description}
            placeholder="Intended rules, solitaire variants, or printing notes…"
            onChange={(e) => update((d) => void (d.description = e.target.value), 'desc')}
          />
        </Field>
      </Section>

      <Section title="Card Stock & Dimensions">
        <Field label="Standard Ratio">
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
            <Slider
              value={card.widthMm}
              min={40}
              max={90}
              step={0.1}
              format={mm}
              onChange={(v) => update((d) => void (d.card.widthMm = v), 'w')}
            />
          </Field>
          <Field label="Height">
            <Slider
              value={card.heightMm}
              min={55}
              max={130}
              step={0.1}
              format={mm}
              onChange={(v) => update((d) => void (d.card.heightMm = v), 'h')}
            />
          </Field>
        </div>
        <Field label="Corner Radius">
          <Slider
            value={card.cornerRadiusMm}
            min={0}
            max={8}
            step={0.1}
            format={mm}
            onChange={(v) => update((d) => void (d.card.cornerRadiusMm = v), 'r')}
          />
        </Field>
        <div className="row2">
          <Field label="Paper Stock">
            <ColorField
              value={card.background}
              onChange={(v) => update((d) => void (d.card.background = v), 'bg')}
            />
          </Field>
          <Field label="Accent Gold" hint="Frames, monogram halos and trim">
            <ColorField
              value={card.accent}
              onChange={(v) => update((d) => void (d.card.accent = v), 'accent')}
            />
          </Field>
        </div>
        <div className="row2">
          <Field label="Edge Color">
            <ColorField
              value={card.border.color}
              onChange={(v) => update((d) => void (d.card.border.color = v), 'bc')}
            />
          </Field>
          <Field label="Edge Width">
            <Slider
              value={card.border.widthMm}
              min={0}
              max={2}
              step={0.05}
              format={mm}
              onChange={(v) => update((d) => void (d.card.border.widthMm = v), 'bw')}
            />
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
      <p className="panel-note">
        Customize the heraldry for all 4 suits: symbols, ink pigments, bespoke typefaces, and custom pip artwork.
      </p>
      <Section title="Heraldry Shortcuts">
        <div className="button-row">
          <button
            type="button"
            className="btn ghost"
            onClick={() => update((d) => d.suits.forEach((s) => (s.font = { ...d.suits[0].font })))}
          >
            <IconSparkles size={14} />
            Apply {deck.suits[0].name} Typeface to All Suits
          </button>
        </div>
      </Section>
      {deck.suits.map((suit, i) => (
        <Section
          key={suit.id}
          title={suit.name}
          aside={
            <button
              type="button"
              className="suit-chip"
              style={{ color: suit.color }}
              onClick={() => select(`${suit.id}-${deck.ranks[0].id}`)}
              title={`Preview Ace of ${suit.name}`}
            >
              {suit.symbol}
            </button>
          }
        >
          <div className="row2">
            <Field label="Suit Name">
              <TextField
                value={suit.name}
                maxLength={24}
                onChange={(v) => update((d) => void (d.suits[i].name = v || suit.id), `sn${i}`)}
              />
            </Field>
            <Field label="Symbol">
              <TextField
                value={suit.symbol}
                maxLength={4}
                onChange={(v) => v && update((d) => void (d.suits[i].symbol = v), `ss${i}`)}
              />
            </Field>
          </div>
          <Field label="Suit Ink Color">
            <ColorField
              value={suit.color}
              onChange={(v) => update((d) => void (d.suits[i].color = v), `sc${i}`)}
            />
          </Field>
          <Field label="Corner Typeface">
            <FontPicker value={suit.font} onChange={(f) => update((d) => void (d.suits[i].font = f))} />
          </Field>
          <Field
            label="Custom Pip Artwork"
            hint="Replaces the standard font glyph on every card of this suit. Transparent SVG or PNG recommended."
          >
            <ImageDrop
              value={suit.pipImage}
              maxEdge={512}
              onChange={(v) => update((d) => void (d.suits[i].pipImage = v))}
              label="Drop custom pip illustration"
            />
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

  if (!card) return <p className="panel-note">Select a card from the deck grid to design custom artwork.</p>
  if (card.kind === 'joker') return <JokerEditor index={deck.jokers.items.findIndex((j) => j.id === card.id)} />

  const face = card.face ?? { image: null, fit: { scale: 1, x: 0, y: 0 }, mirror: true }
  const isCourt = FACE_RANKS.has(card.rank.id)
  const subject = {
    subject: cardSubject(card.rank, card.suit.name),
    court: isCourt,
    colors: [card.suit.color, deck.card.accent],
  }

  const setFace = (patch: Partial<typeof face>, key?: string) =>
    update((d) => {
      const next = { ...face, ...patch }
      if (next.image) d.faces[card.id] = next
      else delete d.faces[card.id]
    }, key)

  return (
    <>
      <p className="panel-note">
        {isCourt
          ? `Now styling ${card.rank.label} of ${card.suit.name}. Court cards support double-ended mirrored portraits or full-bleed illustration.`
          : `Now styling ${card.rank.label} of ${card.suit.name}. Number cards render procedural pips, or you can assign a custom illustration.`}
      </p>

      <Section title={`${card.rank.label} of ${card.suit.name}`}>
        <ImageDrop value={face.image} onChange={(image) => setFace({ image })} />
        {face.image ? (
          <ArtGuide card={deck.card} frame={deck.artFrame} area={face.mirror ? 'half' : 'full'} {...subject} />
        ) : (
          <>
            <ArtGuide card={deck.card} frame={deck.artFrame} area="half" {...subject} />
            <ArtGuide card={deck.card} frame={deck.artFrame} area="full" {...subject} />
          </>
        )}
        {face.image && (
          <>
            <Toggle
              checked={face.mirror}
              onChange={(mirror) => setFace({ mirror })}
              label="Mirror top and bottom (classic double-ended court)"
            />
            <FitControls fit={face.fit} onChange={(fit) => setFace({ fit }, `fit-${card.id}`)} />
          </>
        )}
        {!face.image && isCourt && (
          <p className="field-hint" style={{ marginTop: 6 }}>
            ✦ Without an uploaded portrait, this court card displays an architectural monogram framed in {card.suit.name} lettering.
          </p>
        )}
      </Section>

      <ArtFrameControls />
      <LetteringControls rankId={card.rank.id} monogram={isCourt && !face.image} />

      {face.image && (
        <Section title="Batch Assignment">
          <div className="button-row">
            <button
              type="button"
              className="btn ghost small"
              onClick={() =>
                update((d) =>
                  deck.suits.forEach((s) => (d.faces[`${s.id}-${card.rank.id}`] = structuredClone(face))),
                )
              }
            >
              <IconCopy size={13} />
              Apply to Every {card.rank.label}
            </button>
            <button
              type="button"
              className="btn ghost small"
              onClick={() =>
                update((d) =>
                  deck.ranks
                    .filter((r) => FACE_RANKS.has(r.id))
                    .forEach((r) => (d.faces[`${card.suit.id}-${r.id}`] = structuredClone(face))),
                )
              }
            >
              <IconCopy size={13} />
              Apply to All {card.suit.name} Courts
            </button>
          </div>
        </Section>
      )}

      {withArt.length > 0 && (
        <Section title={`Illustrated Cards in Deck (${withArt.length})`}>
          <div className="mini-cards">
            {withArt.map((c) => (
              <button
                key={c.id}
                type="button"
                className={`mini-card ${c.id === selectedId ? 'on' : ''}`}
                onClick={() => select(c.id)}
                title={c.kind === 'joker' ? c.joker.label : `${c.rank.label} of ${c.suit.name}`}
              >
                <CardSvg deck={deck} card={c} />
              </button>
            ))}
          </div>
        </Section>
      )}
    </>
  )
}

const PATTERN_LABELS: Record<BackPattern, string> = {
  lattice: 'Lattice',
  stripes: 'Pinstripe',
  rosette: 'Rosette',
  dots: 'Polka Dots',
  solid: 'Solid Velvet',
}

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
      <p className="panel-note">
        Design the card back. The preview spotlight automatically displays your active back composition.
      </p>

      <Section title="Pattern & Graphic Style">
        <Segmented
          value={back.kind}
          options={[
            { value: 'pattern', label: 'Artisanal Pattern' },
            { value: 'image', label: 'Custom Artwork' },
          ]}
          onChange={(k) => edit((d) => void (d.back.kind = k))}
        />
        {back.kind === 'pattern' ? (
          <div className="pattern-grid" style={{ marginTop: 12 }}>
            {BACK_PATTERNS.map((p) => (
              <button
                key={p}
                type="button"
                className={`pattern-tile ${back.pattern === p ? 'on' : ''}`}
                onClick={() => edit((d) => void (d.back.pattern = p))}
              >
                <CardSvg deck={{ ...deck, back: { ...back, kind: 'pattern', pattern: p } }} card="back" />
                <span>{PATTERN_LABELS[p]}</span>
              </button>
            ))}
          </div>
        ) : (
          <div style={{ marginTop: 12 }}>
            <ImageDrop value={back.image} onChange={(image) => edit((d) => void (d.back.image = image))} />
            <ArtGuide card={deck.card} frame={deck.artFrame} area="back" subject="" court={false} colors={back.colors} />
            {back.image && <FitControls fit={back.fit} onChange={(fit) => edit((d) => void (d.back.fit = fit), 'backfit')} />}
          </div>
        )}
      </Section>

      <Section title="Palette & Inks">
        <div className="row2">
          <Field label="Ground Color">
            <ColorField value={back.colors[0]} onChange={(v) => edit((d) => void (d.back.colors[0] = v), 'bc0')} />
          </Field>
          <Field label="Ink Color">
            <ColorField value={back.colors[1]} onChange={(v) => edit((d) => void (d.back.colors[1] = v), 'bc1')} />
          </Field>
        </div>
        <div style={{ marginTop: 8 }}>
          <button
            type="button"
            className="btn ghost small"
            onClick={() => edit((d) => void (d.back.colors = [d.back.colors[1], d.back.colors[0]]))}>
            <IconFlip size={13} />
            Invert / Swap Colors
          </button>
        </div>
      </Section>

      <Section title="Border & Medallion">
        <Toggle
          checked={back.border}
          onChange={(v) => edit((d) => void (d.back.border = v))}
          label="White border with center heraldic medallion"
        />
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
        items.push({
          id: nextJokerId(items),
          label: src.label,
          color: src.color,
          font: { ...src.font },
          image: null,
          fit: { scale: 1, x: 0, y: 0 },
        })
      }
      items.length = n
    })
  }

  return (
    <>
      <Section title="Jokers Configuration">
        <Toggle
          checked={jokers.enabled}
          onChange={(v) => {
            update((d) => void (d.jokers.enabled = v))
            if (v && jokers.items[0]) select(jokers.items[0].id)
          }}
          label={jokers.enabled ? `Jokers Included (${base + jokers.items.length} cards total)` : `Jokers Disabled (${base} cards)`}
        />
        {jokers.enabled && (
          <div style={{ marginTop: 12 }}>
            <Field label="Quantity">
              <Segmented
                value={String(jokers.items.length)}
                options={['1', '2', '3', '4'].map((n) => ({ value: n, label: `${n} Joker${n !== '1' ? 's' : ''}` }))}
                onChange={(n) => setCount(Number(n))}
              />
            </Field>
          </div>
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
  const frame = useStore((s) => s.deck.artFrame)
  const selectedId = useStore((s) => s.selectedId)
  const update = useStore((s) => s.update)
  const select = useStore((s) => s.select)
  if (!joker) return null

  const isSelected = selectedId === joker.id
  const set = (fn: (j: Joker) => void, key?: string) => update((d) => fn(d.jokers.items[index]), key)

  return (
    <Section
      title={`Joker #${index + 1}`}
      aside={
        <button
          type="button"
          className={`btn ${isSelected ? 'primary' : 'ghost'} small`}
          onClick={() => select(joker.id)}
        >
          {isSelected ? 'Viewing' : 'Preview'}
        </button>
      }
    >
      <div className="row2">
        <Field label="Banner Label">
          <TextField
            value={joker.label}
            maxLength={12}
            onChange={(v) => set((j) => void (j.label = v || 'JOKER'), `jl${index}`)}
          />
        </Field>
        <Field label="Ink Color">
          <ColorField value={joker.color} onChange={(v) => set((j) => void (j.color = v), `jc${index}`)} />
        </Field>
      </div>
      <Field label="Banner Typeface">
        <FontPicker value={joker.font} onChange={(f) => set((j) => void (j.font = f))} />
      </Field>
      <Field label="Joker Illustration">
        <ImageDrop value={joker.image} onChange={(v) => set((j) => void (j.image = v))} />
      </Field>
      <ArtGuide card={cardSize} frame={frame} area="full" subject="the Joker" court colors={[joker.color]} />
      {joker.image && <FitControls fit={joker.fit} onChange={(fit) => set((j) => void (j.fit = fit), `jf${index}`)} />}
    </Section>
  )
}

const IMPORT_MAX_EDGE = 1024

function ArtGuide({
  card,
  frame,
  area,
  subject,
  court,
  colors,
}: {
  card: Deck['card']
  frame: Deck['artFrame']
  area: ArtArea
  subject: string
  court: boolean
  colors: string[]
}) {
  const notify = useStore((s) => s.notify)
  const box = artBox(card, frame)
  const [w, h] = area === 'back' ? [card.widthMm, card.heightMm] : area === 'half' ? [box.w, box.h / 2] : [box.w, box.h]
  const a = ratioAdvice(w, h)
  const what = area === 'back' ? 'The picture covers the full card,' : area === 'half' ? 'Each mirrored half is' : 'The art window is'
  const size = `${w.toFixed(1)} × ${h.toFixed(1)} mm`
  const edges = area === 'half' && a.cropAxis === 'top and bottom' ? 'bottom' : a.cropAxis
  const crop = a.cropAxis === 'none' ? 'with no cropping' : `losing about ${Math.round(a.cropped * 100)}% off the ${edges}`
  const overCap = Math.max(a.px.w, a.px.h) > IMPORT_MAX_EDGE
  const shape = `${a.preset} ${a.w >= a.h ? 'landscape' : 'portrait'}`
  const heading = area === 'back' ? 'Full Back Illustration' : area === 'half' ? 'Mirrored Court Half (Double-Ended)' : 'Single Portrait Window'

  return (
    <details className="art-guide">
      <summary>
        <span>{heading}</span>
        <span className="art-guide-shape">{shape}</span>
      </summary>
      <p className="field-hint">
        {what} {size}. Recommended generation aspect: <strong>{shape}</strong> ({crop}).
        {area === 'half' && ' Paint the top half of the portrait (head to waist); the engine mirrors and inverts the lower half.'}
        {area === 'back' && ' Keep critical details inside the rounded corner boundaries.'}
      </p>
      <p className="field-hint">
        For 300 DPI print quality: {a.px.w} × {a.px.h} px.
        {overCap ? ` Uploads are normalized to ${IMPORT_MAX_EDGE} px maximum dimension.` : ''}
      </p>
      <div style={{ marginTop: 8 }}>
        <button
          type="button"
          className="btn ghost small"
          onClick={() =>
            navigator.clipboard.writeText(artPrompt({ area, subject, court, advice: a, colors })).then(
              () => notify('Prompt copied to clipboard.'),
              () => notify('Clipboard write unavailable in this browser.', 'error'),
            )
          }
        >
          <IconCopy size={13} />
          Copy AI Generator Prompt
        </button>
      </div>
    </details>
  )
}

function LetteringControls({ rankId, monogram }: { rankId: string; monogram: boolean }) {
  const index = useStore((s) => s.deck.ranks.findIndex((r) => r.id === rankId))
  const rank = useStore((s) => s.deck.ranks[index])
  const update = useStore((s) => s.update)
  if (!rank) return null
  const { corner, monogram: mono } = rank.lettering
  const set = (field: string, fn: (l: typeof rank.lettering) => void) =>
    update((d) => fn(d.ranks[index].lettering), `letter-${rankId}-${field}`)
  const pct = (v: number) => `${Math.round(v * 100)}%`
  const offset = (v: number) => `${v > 0 ? '+' : ''}${v.toFixed(1)} mm`
  const changed = JSON.stringify(rank.lettering) !== JSON.stringify(defaultLettering())

  return (
    <Section
      title={`Lettering & Index (${rank.label})`}
      aside={
        changed && (
          <button
            type="button"
            className="btn ghost small"
            onClick={() => update((d) => void (d.ranks[index].lettering = defaultLettering()))}
          >
            Reset
          </button>
        )
      }
    >
      <div className="fit-controls">
        <span className="field-label">Corner Index Size & Position</span>
        <Field label="Index Scale">
          <Slider
            value={corner.scale}
            min={0.5}
            max={2}
            step={0.01}
            onChange={(v) => set('corner-scale', (l) => void (l.corner.scale = v))}
            format={pct}
          />
        </Field>
        <div className="row2">
          <Field label="Horizontal Shift">
            <Slider
              value={corner.x}
              min={-5}
              max={5}
              step={0.1}
              onChange={(v) => set('corner-x', (l) => void (l.corner.x = v))}
              format={offset}
            />
          </Field>
          <Field label="Vertical Shift">
            <Slider
              value={corner.y}
              min={-5}
              max={5}
              step={0.1}
              onChange={(v) => set('corner-y', (l) => void (l.corner.y = v))}
              format={offset}
            />
          </Field>
        </div>

        {monogram && (
          <>
            <span className="field-label" style={{ marginTop: 10 }}>Center Monogram</span>
            <Field label="Monogram Scale">
              <Slider
                value={mono.scale}
                min={0.5}
                max={2}
                step={0.01}
                onChange={(v) => set('monogram-scale', (l) => void (l.monogram.scale = v))}
                format={pct}
              />
            </Field>
            <Field label="Monogram Vertical Position">
              <Slider
                value={mono.y}
                min={-15}
                max={15}
                step={0.1}
                onChange={(v) => set('monogram-y', (l) => void (l.monogram.y = v))}
                format={offset}
              />
            </Field>
          </>
        )}
      </div>

      <div className="button-row" style={{ marginTop: 10 }}>
        <button
          type="button"
          className="btn ghost small"
          onClick={() => update((d) => d.ranks.forEach((r) => (r.lettering.corner = { ...corner })))}
        >
          <IconCopy size={13} />
          Copy Index to All Ranks
        </button>
        {monogram && (
          <button
            type="button"
            className="btn ghost small"
            onClick={() =>
              update((d) =>
                d.ranks.filter((r) => FACE_RANKS.has(r.id)).forEach((r) => (r.lettering.monogram = { ...mono })),
              )
            }
          >
            <IconCopy size={13} />
            Copy Monogram to J, Q, K
          </button>
        )}
      </div>
    </Section>
  )
}

const SHAPE_LABELS: Record<(typeof FRAME_SHAPES)[number], string> = { rect: 'Rectangle', arch: 'Arched Arch', oval: 'Classic Oval' }
const CENTRE_LABELS: Record<(typeof COURT_CENTRES)[number], string> = { monogram: 'Architectural Monogram', pip: 'Giant Heraldic Pip', empty: 'Blank Studio' }

function ArtFrameControls() {
  const deck = useStore((s) => s.deck)
  const update = useStore((s) => s.update)
  const frame = deck.artFrame
  const set = (field: string, fn: (f: Deck['artFrame']) => void) => update((d) => fn(d.artFrame), `frame-${field}`)
  const mm = (v: number) => `${v.toFixed(1)} mm`
  const pct = (v: number) => `${Math.round(v * 100)}%`
  const changed = JSON.stringify(frame) !== JSON.stringify(defaultArtFrame())

  return (
    <Section
      title="Architectural Art Frame"
      aside={
        changed && (
          <button type="button" className="btn ghost small" onClick={() => update((d) => void (d.artFrame = defaultArtFrame()))}>
            Reset
          </button>
        )
      }
    >
      <Field label="Unillustrated Face Fallback" hint="Rendered on J, Q, K without uploaded portraits">
        <Segmented
          value={deck.courtCentre}
          options={COURT_CENTRES.map((v) => ({ value: v, label: CENTRE_LABELS[v] }))}
          onChange={(v) => update((d) => void (d.courtCentre = v))}
        />
      </Field>
      <Field label="Frame Silhouette">
        <Segmented
          value={frame.shape}
          options={FRAME_SHAPES.map((v) => ({ value: v, label: SHAPE_LABELS[v] }))}
          onChange={(shape) => set('shape', (f) => void (f.shape = shape))}
        />
      </Field>
      <div className="row2">
        <Field label="Side Margins">
          <Slider value={frame.marginXMm} min={2} max={28} step={0.1} onChange={(v) => set('mx', (f) => void (f.marginXMm = v))} format={mm} />
        </Field>
        <Field label="Vertical Margins">
          <Slider value={frame.marginYMm} min={2} max={40} step={0.1} onChange={(v) => set('my', (f) => void (f.marginYMm = v))} format={mm} />
        </Field>
      </div>
      {frame.shape !== 'oval' && (
        <Field label="Frame Corner Radius">
          <Slider value={frame.cornerRadiusMm} min={0} max={20} step={0.1} onChange={(v) => set('r', (f) => void (f.cornerRadiusMm = v))} format={mm} />
        </Field>
      )}
      <Field label="Frame Molding Lines">
        <Segmented
          value={frame.lines}
          options={[
            { value: 'double' as const, label: 'Double Fillet' },
            { value: 'single' as const, label: 'Single Rule' },
            { value: 'none' as const, label: 'No Molding' },
          ]}
          onChange={(lines) => set('lines', (f) => void (f.lines = lines))}
        />
      </Field>
      {frame.lines !== 'none' && (
        <Field label="Line Stroke Width">
          <Slider value={frame.widthMm} min={0.05} max={3} step={0.05} onChange={(v) => set('w', (f) => void (f.widthMm = v))} format={(v) => `${v.toFixed(2)} mm`} />
        </Field>
      )}
      <div className="row2">
        <Field label="Molding Color" hint={frame.color ? undefined : 'Following deck accent gold'}>
          <ColorField value={frame.color ?? deck.card.accent} onChange={(v) => set('color', (f) => void (f.color = v))} />
        </Field>
        <Field label="Suit Color Wash">
          <Slider value={frame.tint} min={0} max={0.4} step={0.01} onChange={(v) => set('tint', (f) => void (f.tint = v))} format={pct} />
        </Field>
      </div>
      {frame.color && (
        <button type="button" className="btn ghost small" onClick={() => set('color', (f) => void (f.color = null))}>
          Follow Deck Accent Gold
        </button>
      )}
    </Section>
  )
}
