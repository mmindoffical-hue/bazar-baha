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
