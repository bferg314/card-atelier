import type { FontSource } from '../model/schema'

export const GOOGLE_FONTS = [
  'Playfair Display',
  'Cinzel',
  'Cinzel Decorative',
  'Cormorant Garamond',
  'EB Garamond',
  'Libre Baskerville',
  'IM Fell English SC',
  'Poiret One',
  'Federo',
  'Limelight',
  'Bebas Neue',
  'Oswald',
  'Abril Fatface',
  'UnifrakturMaguntia',
  'Pirata One',
  'Metamorphous',
  'Spectral SC',
  'Josefin Sans',
  'Righteous',
  'Special Elite',
]

export const SYSTEM_FONTS = ['Georgia', 'Times New Roman', 'Palatino', 'Helvetica', 'Courier New']

const loaded = new Set<string>()

export function loadGoogleFont(family: string): void {
  if (loaded.has(family) || SYSTEM_FONTS.includes(family)) return
  loaded.add(family)
  const link = document.createElement('link')
  link.rel = 'stylesheet'
  link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family).replace(/%20/g, '+')}:wght@400;700&display=swap`
  document.head.appendChild(link)
}

export async function loadEmbeddedFont(family: string, data: string): Promise<void> {
  const key = `embedded:${family}:${data.length}`
  if (loaded.has(key)) return
  loaded.add(key)
  const face = new FontFace(family, `url(${data})`)
  await face.load()
  document.fonts.add(face)
}

export function loadDeckFonts(fonts: FontSource[]): void {
  for (const f of fonts) {
    if (f.source === 'google') loadGoogleFont(f.family)
    else if (f.source === 'embedded') loadEmbeddedFont(f.family, f.data).catch(() => loaded.delete(`embedded:${f.family}:${f.data.length}`))
  }
}

/** CSS font-family value with sensible fallbacks. */
export function fontStack(family: string): string {
  return `'${family}', Georgia, 'Times New Roman', serif`
}
