/// <reference types="node" />
import { execFileSync } from 'node:child_process'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { crc32, dataUriBytes, zip } from './zip'

describe('zip writer', () => {
  it('computes the standard CRC-32', () => {
    expect(crc32(new TextEncoder().encode('123456789'))).toBe(0xcbf43926)
  })

  it('decodes base64 data URIs', () => {
    expect([...dataUriBytes('data:image/png;base64,iVBORw0KGgo=')].slice(0, 4)).toEqual([0x89, 0x50, 0x4e, 0x47])
  })

  it('writes an archive a standard zip reader accepts and reads back unchanged', () => {
    const png = dataUriBytes('data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==')
    const bytes = zip([
      { name: 'deck.json', data: new TextEncoder().encode('{"format":"open-playing-cards"}') },
      { name: 'cards/hearts-K.png', data: png },
    ])
    const dir = mkdtempSync(join(tmpdir(), 'atelier-zip-'))
    const path = join(dir, 'deck.zip')
    writeFileSync(path, bytes)
    // Read it back with Python's zipfile, an implementation that knows nothing about this writer.
    const script = `import json, zipfile
z = zipfile.ZipFile(${JSON.stringify(path)})
assert z.testzip() is None
print(json.dumps({"names": z.namelist(), "json": z.read("deck.json").decode(), "png": list(z.read("cards/hearts-K.png"))}))`
    const out = JSON.parse(execFileSync('python3', ['-c', script], { encoding: 'utf8' }))
    expect(out.names).toEqual(['deck.json', 'cards/hearts-K.png'])
    expect(out.json).toBe('{"format":"open-playing-cards"}')
    expect(out.png).toEqual([...png])
  })
})
