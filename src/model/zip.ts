/**
 * A minimal zip writer, store-only (no compression). PNGs are already deflated and the JSON alongside them is
 * small, so compressing would cost time for almost nothing, and storing keeps this to one short file with no
 * dependency. Produces archives that any unzip tool reads.
 */
export interface ZipEntry {
  name: string
  data: Uint8Array
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let i = 0; i < 256; i++) {
    let c = i
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[i] = c >>> 0
  }
  return table
})()

export function crc32(data: Uint8Array): number {
  let c = 0xffffffff
  for (let i = 0; i < data.length; i++) c = CRC_TABLE[(c ^ data[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

export function zip(entries: ZipEntry[], date = new Date()): Uint8Array {
  const encoder = new TextEncoder()
  const time = dosTime(date)
  const files = entries.map((e) => ({ name: encoder.encode(e.name), data: e.data, crc: crc32(e.data) }))
  const localSize = files.reduce((n, f) => n + 30 + f.name.length + f.data.length, 0)
  const centralSize = files.reduce((n, f) => n + 46 + f.name.length, 0)
  const out = new Uint8Array(localSize + centralSize + 22)
  const view = new DataView(out.buffer)
  let at = 0
  const u16 = (v: number) => {
    view.setUint16(at, v, true)
    at += 2
  }
  const u32 = (v: number) => {
    view.setUint32(at, v, true)
    at += 4
  }
  const bytes = (v: Uint8Array) => {
    out.set(v, at)
    at += v.length
  }

  const offsets: number[] = []
  for (const f of files) {
    offsets.push(at)
    u32(0x04034b50)
    u16(20) // version needed
    u16(0x0800) // UTF-8 names
    u16(0) // stored
    u32(time)
    u32(f.crc)
    u32(f.data.length)
    u32(f.data.length)
    u16(f.name.length)
    u16(0)
    bytes(f.name)
    bytes(f.data)
  }

  const centralStart = at
  files.forEach((f, i) => {
    u32(0x02014b50)
    u16(20) // version made by
    u16(20) // version needed
    u16(0x0800)
    u16(0)
    u32(time)
    u32(f.crc)
    u32(f.data.length)
    u32(f.data.length)
    u16(f.name.length)
    u16(0) // extra
    u16(0) // comment
    u16(0) // disk
    u16(0) // internal attrs
    u32(0) // external attrs
    u32(offsets[i])
    bytes(f.name)
  })

  // Sizes are taken before the trailer is written, since writing it moves `at`.
  const writtenCentralSize = at - centralStart
  u32(0x06054b50)
  u16(0)
  u16(0)
  u16(files.length)
  u16(files.length)
  u32(writtenCentralSize)
  u32(centralStart)
  u16(0)
  return out
}

/** MS-DOS date and time, packed into one little-endian word pair as zip expects. */
function dosTime(d: Date): number {
  const time = (d.getHours() << 11) | (d.getMinutes() << 5) | Math.floor(d.getSeconds() / 2)
  const date = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate()
  return ((date << 16) | time) >>> 0
}

/**
 * Base64 for arbitrary bytes. The whole array cannot be spread into String.fromCharCode: a card carrying embedded
 * artwork runs to hundreds of thousands of bytes, and that many arguments overflows the call stack.
 */
export function toBase64(bytes: Uint8Array): string {
  let binary = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  return btoa(binary)
}

/** The bytes behind a `data:...;base64,...` URI. */
export function dataUriBytes(uri: string): Uint8Array {
  const base64 = uri.slice(uri.indexOf(',') + 1)
  const binary = atob(base64)
  const out = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i)
  return out
}
