import { supabase } from './supabase'

const fullPhotoQualities = [0.8, 0.7, 0.6]

export type CompressedProductPhoto = {
  full: Blob
  thumbnail: Blob
}

function canvasBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob)
      else reject(new Error('Image conversion failed'))
    }, 'image/jpeg', quality)
  })
}

export async function compressProductPhoto(file: File): Promise<CompressedProductPhoto> {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  try {
    const scale = Math.min(1, 1280 / Math.max(bitmap.width, bitmap.height))
    const width = Math.round(bitmap.width * scale)
    const height = Math.round(bitmap.height * scale)
    const fullCanvas = document.createElement('canvas')
    fullCanvas.width = width
    fullCanvas.height = height
    const fullContext = fullCanvas.getContext('2d')
    if (!fullContext) throw new Error('Canvas is unavailable')
    fullContext.drawImage(bitmap, 0, 0, width, height)

    let full = await canvasBlob(fullCanvas, fullPhotoQualities[0])
    for (const quality of fullPhotoQualities.slice(1)) {
      if (full.size <= 400 * 1024) break
      full = await canvasBlob(fullCanvas, quality)
    }

    const thumbnailWidth = 320
    const thumbnailHeight = Math.round(bitmap.height * thumbnailWidth / bitmap.width)
    const thumbnailCanvas = document.createElement('canvas')
    thumbnailCanvas.width = thumbnailWidth
    thumbnailCanvas.height = thumbnailHeight
    const thumbnailContext = thumbnailCanvas.getContext('2d')
    if (!thumbnailContext) throw new Error('Canvas is unavailable')
    thumbnailContext.drawImage(bitmap, 0, 0, thumbnailWidth, thumbnailHeight)

    return { full, thumbnail: await canvasBlob(thumbnailCanvas, 0.7) }
  } finally {
    bitmap.close()
  }
}

export function thumbnailPathFor(fullPath: string): string {
  return fullPath.replace(/\.jpg$/, '-t.jpg')
}

export async function removeProductPhotos(paths: string[]): Promise<void> {
  if (!paths.length) return
  if (!supabase) return
  const allPaths = paths.flatMap((path) => [path, thumbnailPathFor(path)])
  try {
    const { error } = await supabase.storage.from('product-photos').remove(allPaths)
    if (error) console.warn('Product photos could not be removed.', error)
  } catch (error) {
    console.warn('Product photos could not be removed.', error)
  }
}