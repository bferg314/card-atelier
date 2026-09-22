/** Read an image file, downscale it on a canvas and return a compact data URI. */
export async function importImage(file: File, maxEdge = 1024): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error(`${file.name} is not an image.`)
  if (file.type === 'image/svg+xml') return readAsDataUrl(file)
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height))
  const w = Math.max(1, Math.round(bitmap.width * scale))
  const h = Math.max(1, Math.round(bitmap.height * scale))
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')!
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(bitmap, 0, 0, w, h)
  bitmap.close()
  const webp = canvas.toDataURL('image/webp', 0.88)
  return webp.startsWith('data:image/webp') ? webp : canvas.toDataURL('image/png')
}

export function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(r.result as string)
    r.onerror = () => reject(r.error)
    r.readAsDataURL(file)
  })
}
