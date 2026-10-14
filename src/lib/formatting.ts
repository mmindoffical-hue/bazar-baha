import { tk } from '../i18n/tk'

export async function prepareStorePhoto(file: File) {
  const image = await createImageBitmap(file)
  const scale = Math.min(1, 1280 / Math.max(image.width, image.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(image.width * scale))
  canvas.height = Math.max(1, Math.round(image.height * scale))
  const context = canvas.getContext('2d')
  if (!context) throw new Error('canvas')
  context.drawImage(image, 0, 0, canvas.width, canvas.height)
  image.close()

  for (const quality of [0.8, 0.75, 0.7, 0.65, 0.6, 0.55, 0.5]) {
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality))
    if (blob && blob.size < 2 * 1024 * 1024) return blob
  }
  throw new Error('size')
}

export async function prepareStoreLogo(file: File) {
  const image = await createImageBitmap(file)
  const scale = Math.min(1, 256 / Math.max(image.width, image.height))
  const width = Math.max(1, Math.round(image.width * scale))
  const height = Math.max(1, Math.round(image.height * scale))
  const left = Math.floor((256 - width) / 2)
  const top = Math.floor((256 - height) / 2)
  const canvas = document.createElement('canvas')
  canvas.width = 256
  canvas.height = 256
  const context = canvas.getContext('2d')
  if (!context) {
    image.close()
    throw new Error('canvas')
  }
  context.clearRect(0, 0, canvas.width, canvas.height)
  context.drawImage(image, left, top, width, height)
  image.close()

  const sizeScales = [1, 0.75, 0.5, 0.375, 0.25]
  let supportsWebp = false
  for (const sizeScale of sizeScales) {
    const side = Math.max(1, Math.round(canvas.width * sizeScale))
    const output = document.createElement('canvas')
    output.width = side
    output.height = side
    const outputContext = output.getContext('2d')
    if (!outputContext) throw new Error('canvas')
    outputContext.clearRect(0, 0, side, side)
    outputContext.drawImage(canvas, 0, 0, side, side)

    for (const quality of [0.8, 0.7, 0.6, 0.5, 0.4]) {
      const webp = await new Promise<Blob | null>((resolve) => output.toBlob(resolve, 'image/webp', quality))
      if (webp?.type === 'image/webp') {
        supportsWebp = true
        if (webp.size <= 150 * 1024) return webp
      } else {
        break
      }
    }
  }

  if (!supportsWebp) {
    for (const sizeScale of sizeScales) {
      const side = Math.max(1, Math.round(canvas.width * sizeScale))
      const jpegCanvas = document.createElement('canvas')
      jpegCanvas.width = side
      jpegCanvas.height = side
      const jpegContext = jpegCanvas.getContext('2d')
      if (!jpegContext) throw new Error('canvas')
      jpegContext.fillStyle = '#fff'
      jpegContext.fillRect(0, 0, side, side)
      jpegContext.drawImage(canvas, 0, 0, side, side)
      for (const quality of [0.8, 0.7, 0.6, 0.5, 0.4]) {
        const jpeg = await new Promise<Blob | null>((resolve) => jpegCanvas.toBlob(resolve, 'image/jpeg', quality))
        if (jpeg && jpeg.size <= 150 * 1024) return jpeg
      }
    }
  }
  throw new Error('size')
}

export function normalizePrice(value: string) {
  return value.trim().replace(',', '.')
}

export function isValidPrice(normalizedPrice: string) {
  return /^\d+(?:\.\d{1,2})?$/.test(normalizedPrice)
    && Number(normalizedPrice) > 0
    && Number(normalizedPrice) < 1000000
}

export function relativeTime(updatedAt: string) {
  const elapsedMinutes = Math.max(0, Math.floor((Date.now() - new Date(updatedAt).getTime()) / 60000))
  if (elapsedMinutes < 1) return tk.buyer.relativeTime.justNow
  if (elapsedMinutes < 60) return tk.buyer.relativeTime.minutes(elapsedMinutes)
  const elapsedHours = Math.floor(elapsedMinutes / 60)
  if (elapsedHours < 24) return tk.buyer.relativeTime.hours(elapsedHours)
  return tk.buyer.relativeTime.days(Math.floor(elapsedHours / 24))
}
