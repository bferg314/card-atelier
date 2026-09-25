import { createContext, useContext, useId, useRef, useState, type ReactNode } from 'react'
import { GOOGLE_FONTS, SYSTEM_FONTS, loadGoogleFont, fontStack, loadEmbeddedFont } from '../fonts/fonts'
import { importImage, readAsDataUrl } from '../model/images'
import type { FontRef, ImageFit } from '../model/schema'
import { useStore } from '../state/store'
import { IconHelp, IconUpload, IconClose } from './icons'

export function Section({ title, children, aside }: { title: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <section className="section">
      <header className="section-head">
        <h3>{title}</h3>
        {aside}
      </header>
      <div className="section-body">{children}</div>
    </section>
  )
}

const FieldLabel = createContext<string | undefined>(undefined)

export function useFieldLabel(): { 'aria-labelledby'?: string } {
  const id = useContext(FieldLabel)
  return id ? { 'aria-labelledby': id } : {}
}

export function Field({ label, children, hint, help }: { label: string; children: ReactNode; hint?: string; help?: ReactNode }) {
  const id = useId()
  return (
    <div className="field">
      <span className="field-head">
        <span className="field-label" id={id}>
          {label}
        </span>
        {help}
      </span>
      <FieldLabel.Provider value={id}>{children}</FieldLabel.Provider>
      {hint && <span className="field-hint">{hint}</span>}
    </div>
  )
}

export function HelpTip({ label, children }: { label: string; children: ReactNode }) {
  const id = useId()
  const mark = useRef<HTMLButtonElement>(null)
  const [at, setAt] = useState<{ top: number; left: number; width: number; maxHeight: number } | null>(null)

  function show() {
    const r = mark.current?.getBoundingClientRect()
    if (!r) return
    const width = Math.min(340, window.innerWidth - 24)
    setAt({
      top: r.bottom + 8,
      left: Math.min(Math.max(12, r.left - 12), window.innerWidth - width - 12),
      width,
      maxHeight: Math.min(360, window.innerHeight - r.bottom - 20),
    })
  }

  return (
    <span className="help-tip" onMouseEnter={show} onMouseLeave={() => setAt(null)}>
      <button type="button" ref={mark} className="help-mark" aria-label={label} aria-describedby={id} onFocus={show} onBlur={() => setAt(null)}>
        <IconHelp size={13} />
      </button>
      {at && (
        <span role="tooltip" id={id} className="help-bubble" style={at}>
          {children}
        </span>
      )}
    </span>
  )
}

export function Select<T extends string>({ value, options, onChange }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <select className="input" value={value} onChange={(e) => onChange(e.target.value as T)} {...useFieldLabel()}>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  )
}

export function TextField({ value, onChange, placeholder, maxLength }: { value: string; onChange: (v: string) => void; placeholder?: string; maxLength?: number }) {
  return <input className="input" type="text" value={value} placeholder={placeholder} maxLength={maxLength} onChange={(e) => onChange(e.target.value)} {...useFieldLabel()} />
}

export function ColorField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [draft, setDraft] = useState<string | null>(null)
  const named = useFieldLabel()
  const displayVal = draft ?? value

  return (
    <div className="color-field">
      <label className="swatch" style={{ background: value }} title="Click to open color picker">
        <input
          type="color"
          value={value.length === 4 ? expand(value) : value.slice(0, 7)}
          onChange={(e) => onChange(e.target.value)}
          aria-label="Pick color"
        />
      </label>
      <input
        className="input mono color-hex-input"
        value={displayVal}
        onChange={(e) => {
          setDraft(e.target.value)
          if (/^#[0-9a-fA-F]{6}$/.test(e.target.value)) onChange(e.target.value.toLowerCase())
        }}
        onBlur={() => setDraft(null)}
        spellCheck={false}
        placeholder="#000000"
        maxLength={7}
        {...named}
      />
    </div>
  )
}

function expand(hex: string) {
  return '#' + [...hex.slice(1)].map((c) => c + c).join('')
}

/**
 * Clean dual Slider with range bar and direct numeric editing badge.
 */
export function Slider({
  value,
  min,
  max,
  step,
  onChange,
  format,
}: {
  value: number
  min: number
  max: number
  step: number
  onChange: (v: number) => void
  format?: (v: number) => string
}) {
  const named = useFieldLabel()
  const [draft, setDraft] = useState<string | null>(null)

  function nudge(delta: number) {
    const next = Math.min(max, Math.max(min, Number((value + delta).toFixed(2))))
    onChange(next)
  }

  return (
    <div className="slider-control">
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="slider-range"
        {...named}
      />
      <input
        type="text"
        className="slider-val-badge"
        value={draft ?? (format ? format(value) : value)}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          if (draft !== null) {
            const cleaned = parseFloat(draft.replace(/[^0-9.-]/g, ''))
            if (!isNaN(cleaned)) {
              const clamped = Math.min(max, Math.max(min, cleaned))
              onChange(Number(clamped.toFixed(2)))
            }
            setDraft(null)
          }
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
          else if (e.key === 'ArrowUp') {
            e.preventDefault()
            nudge(step)
          } else if (e.key === 'ArrowDown') {
            e.preventDefault()
            nudge(-step)
          }
        }}
        title="Click to type exact value, or use Up/Down arrows to adjust"
        aria-label="Direct value"
      />
    </div>
  )
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="toggle">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="toggle-track" aria-hidden>
        <span className="toggle-thumb" />
      </span>
      <span>{label}</span>
    </label>
  )
}

export function Segmented<T extends string>({ value, options, onChange }: { value: T; options: { value: T; label: ReactNode }[]; onChange: (v: T) => void }) {
  return (
    <div className="segmented" role="radiogroup" {...useFieldLabel()}>
      {options.map((o) => (
        <button key={o.value} type="button" role="radio" aria-checked={o.value === value} className={o.value === value ? 'on' : ''} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function FontPicker({ value, onChange }: { value: FontRef; onChange: (v: FontRef) => void }) {
  const fonts = useStore((s) => s.deck.fonts)
  const update = useStore((s) => s.update)
  const notify = useStore((s) => s.notify)
  const fileRef = useRef<HTMLInputElement>(null)
  const embedded = fonts.filter((f) => f.source === 'embedded').map((f) => f.family)

  async function upload(file: File) {
    if (!/\.(ttf|otf|woff2?)$/i.test(file.name)) {
      notify('Fonts must be .ttf, .otf, .woff or .woff2 files.', 'error')
      return
    }
    if (file.size > 1_500_000) notify('That font is large; it will make the exported deck file big.', 'error')
    const data = await readAsDataUrl(file)
    const family = file.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ').trim()
    try {
      await loadEmbeddedFont(family, data)
    } catch {
      notify('That font file could not be read.', 'error')
      return
    }
    update((d) => {
      d.fonts = d.fonts.filter((f) => f.family !== family)
      d.fonts.push({ family, source: 'embedded', data })
    })
    onChange({ ...value, family })
    notify(`Added font “${family}”`)
  }

  return (
    <div className="font-picker">
      <select
        className="input"
        {...useFieldLabel()}
        value={value.family}
        style={{ fontFamily: fontStack(value.family) }}
        onChange={(e) => {
          if (e.target.value === '__upload__') {
            fileRef.current?.click()
            return
          }
          loadGoogleFont(e.target.value)
          onChange({ ...value, family: e.target.value })
        }}
      >
        {embedded.length > 0 && (
          <optgroup label="Uploaded">
            {embedded.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </optgroup>
        )}
        <optgroup label="Web fonts">
          {GOOGLE_FONTS.map((f) => (
            <option key={f} value={f}>
              {f}
            </option>
          ))}
        </optgroup>
        <optgroup label="System">
          {SYSTEM_FONTS.map((f) => (
            <option key={f} value={f}>
              {f}
            </option>
          ))}
        </optgroup>
        {!GOOGLE_FONTS.includes(value.family) && !SYSTEM_FONTS.includes(value.family) && !embedded.includes(value.family) && <option value={value.family}>{value.family}</option>}
        <option value="__upload__">Upload a font file…</option>
      </select>
      <select className="input weight" value={value.weight} onChange={(e) => onChange({ ...value, weight: Number(e.target.value) })} aria-label="Weight">
        <option value={400}>Regular</option>
        <option value={700}>Bold</option>
      </select>
      <input
        ref={fileRef}
        type="file"
        accept=".ttf,.otf,.woff,.woff2"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) upload(f)
          e.target.value = ''
        }}
      />
    </div>
  )
}

export function ImageDrop({ value, onChange, maxEdge = 1024, label = 'Drop a picture or click to browse' }: { value: string | null; onChange: (v: string | null) => void; maxEdge?: number; label?: string }) {
  const notify = useStore((s) => s.notify)
  const ref = useRef<HTMLInputElement>(null)
  const [over, setOver] = useState(false)
  const [busy, setBusy] = useState(false)

  async function take(file: File | undefined) {
    if (!file) return
    setBusy(true)
    try {
      onChange(await importImage(file, maxEdge))
    } catch (e) {
      notify((e as Error).message || 'That image could not be read.', 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      className={`image-drop ${over ? 'over' : ''} ${value ? 'has' : ''}`}
      onDragOver={(e) => {
        e.preventDefault()
        setOver(true)
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault()
        setOver(false)
        take(e.dataTransfer.files[0])
      }}
    >
      <button type="button" className="image-drop-target" onClick={() => ref.current?.click()} disabled={busy}>
        {value ? (
          <img src={value} alt="Uploaded art preview" />
        ) : (
          <span className="image-drop-icon" aria-hidden>
            <IconUpload size={24} />
          </span>
        )}
        <span>{busy ? 'Processing image…' : value ? 'Replace picture' : label}</span>
      </button>
      {value && (
        <button type="button" className="btn ghost small" onClick={() => onChange(null)} title="Remove picture">
          <IconClose size={12} /> Remove
        </button>
      )}
      <input
        ref={ref}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          take(e.target.files?.[0])
          e.target.value = ''
        }}
      />
    </div>
  )
}

export function FitControls({ fit, onChange }: { fit: ImageFit; onChange: (f: ImageFit) => void }) {
  const pct = (v: number) => `${Math.round(v * 100)}%`
  return (
    <div className="fit-controls">
      <Field label="Zoom">
        <Slider value={fit.scale} min={0.5} max={3} step={0.01} onChange={(scale) => onChange({ ...fit, scale })} format={pct} />
      </Field>
      <Field label="Horizontal Position">
        <Slider value={fit.x} min={-1} max={1} step={0.01} onChange={(x) => onChange({ ...fit, x })} format={(v) => (v > 0 ? '+' : '') + pct(v)} />
      </Field>
      <Field label="Vertical Position">
        <Slider value={fit.y} min={-1} max={1} step={0.01} onChange={(y) => onChange({ ...fit, y })} format={(v) => (v > 0 ? '+' : '') + pct(v)} />
      </Field>
    </div>
  )
}
