export type CacheEntry<T> = {
  key: string
  data: T
  fetchedAt: number
}

const cachePrefix = 'bazar-baha:public-cache:'
const priceCachePrefix = 'price-list:'
const maximumPriceLists = 50
const requestTimeoutMs = 10_000

export function readPublicCache<T>(key: string): CacheEntry<T> | null {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(`${cachePrefix}${key}`) ?? 'null')
    if (
      value === null ||
      typeof value !== 'object' ||
      !('key' in value) ||
      value.key !== key ||
      !('fetchedAt' in value) ||
      typeof value.fetchedAt !== 'number' ||
      !Number.isFinite(value.fetchedAt) ||
      !('data' in value)
    ) return null
    return value as CacheEntry<T>
  } catch (error) {
    console.warn('Public cache read failed.', error)
    return null
  }
}

export function readPublicCaches<T>(keyPrefix: string): CacheEntry<T>[] {
  try {
    const entries: CacheEntry<T>[] = []
    for (let index = 0; index < localStorage.length; index += 1) {
      const storageKey = localStorage.key(index)
      if (!storageKey?.startsWith(cachePrefix)) continue
      const key = storageKey.slice(cachePrefix.length)
      if (!key.startsWith(keyPrefix)) continue
      const entry = readPublicCache<T>(key)
      if (entry) entries.push(entry)
    }
    return entries
  } catch (error) {
    console.warn('Public cache listing failed.', error)
    return []
  }
}

export function writePublicCache<T>(key: string, data: T) {
  try {
    if (key.startsWith(priceCachePrefix)) {
      const priceEntries: CacheEntry<unknown>[] = []
      for (let index = 0; index < localStorage.length; index += 1) {
        const storageKey = localStorage.key(index)
        if (!storageKey?.startsWith(cachePrefix)) continue
        const entryKey = storageKey.slice(cachePrefix.length)
        if (!entryKey.startsWith(priceCachePrefix)) continue
        const entry = readPublicCache<unknown>(entryKey)
        if (entry && entry.key !== key) priceEntries.push(entry)
      }
      priceEntries.sort((left, right) => left.fetchedAt - right.fetchedAt)
      while (priceEntries.length >= maximumPriceLists) {
        const oldest = priceEntries.shift()
        if (oldest) localStorage.removeItem(`${cachePrefix}${oldest.key}`)
      }
    }

    const entry: CacheEntry<T> = { key, data, fetchedAt: Date.now() }
    localStorage.setItem(`${cachePrefix}${key}`, JSON.stringify(entry))
  } catch (error) {
    console.warn('Public cache write failed.', error)
  }
}

export async function withRequestTimeout<T>(request: () => PromiseLike<T>): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      Promise.resolve().then(request),
      new Promise<never>((_resolve, reject) => {
        timeoutId = setTimeout(() => reject(new Error('Public data request timed out.')), requestTimeoutMs)
      }),
    ])
  } finally {
    if (timeoutId !== undefined) clearTimeout(timeoutId)
  }
}

export function cacheProducts<T extends { id: string }>(products: T[]) {
  for (const product of products) writePublicCache(`products:id:${product.id}`, product)
}
