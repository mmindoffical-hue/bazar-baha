import { useEffect, useMemo, useRef, useState } from 'react'
import { tk } from '../i18n/tk'
import { relativeTime } from '../lib/formatting'
import type { BasketItem } from '../lib/basket'
import { supabase } from '../lib/supabase'
import type { StoreMapRecord } from '../lib/types'
import { thumbnailPathFor } from '../lib/productPhotos'
import { OfflineDataNotice } from './OfflineDataNotice'
import { cacheProducts, readPublicCache, withRequestTimeout, writePublicCache } from '../lib/publicCache'
import { L } from './leafletSetup'
import 'leaflet/dist/leaflet.css'
import 'leaflet.markercluster/dist/MarkerCluster.css'
import 'leaflet.markercluster/dist/MarkerCluster.Default.css'
import 'leaflet.markercluster'

type MapPin = Omit<StoreMapRecord, 'lat' | 'lng'> & { lat: number; lng: number; price?: number }
type StorePriceRow = {
  price_id: string
  store_id: string
  price: number
  in_stock: boolean
  photo_paths: string[]
  updated_at: string
  store_name: string
  store_logo_path: string | null
  store_serial_no: number | null
  product_id: string
  product_name: string
  unit: string
}
type MapData = { pins: MapPin[]; prices: StorePriceRow[] }

function mapProductPrices(listings: StorePriceRow[], stores: StoreMapRecord[]): MapData {
  const storesById = new Map(stores.map((store) => [store.id, store]))
  const prices = listings.filter((item) => storesById.has(item.store_id))
  const pins = prices.flatMap((item) => {
    const store = storesById.get(item.store_id)
    if (!store || store.lat === null || store.lng === null) return []
    return [{ ...store, lat: store.lat, lng: store.lng, price: Number(item.price) }]
  })
  return { prices, pins }
}

function pinIcon(pin: MapPin, cheapest: boolean) {
  const root = document.createElement('div')
  root.className = `store-map-marker${pin.price !== undefined ? ' store-map-marker-with-price' : ''}${cheapest ? ' store-map-marker-cheapest' : ''}`

  if (pin.logo_path) {
    const image = document.createElement('img')
    image.src = supabase?.storage.from('store-logos').getPublicUrl(pin.logo_path).data.publicUrl ?? ''
    image.alt = ''
    image.loading = 'lazy'
    image.decoding = 'async'
    image.className = 'store-map-logo'
    root.append(image)
  } else {
    const name = document.createElement('span')
    const characters = Array.from(pin.name)
    name.textContent = characters.length > 14 ? `${characters.slice(0, 13).join('')}…` : pin.name
    name.className = 'store-map-name'
    root.append(name)
  }

  if (pin.price !== undefined) {
    const price = document.createElement('span')
    price.textContent = `${Number(pin.price).toFixed(2)} ${tk.buyer.currency}`
    price.className = 'store-map-price'
    root.append(price)
  }

  return L.divIcon({
    html: root,
    className: 'store-map-icon',
    iconSize: pin.price === undefined ? [48, 48] : [92, 64],
    iconAnchor: pin.price === undefined ? [24, 24] : [46, 30],
  })
}

function getDirectionsUrl(pin: MapPin) {
  return `https://www.google.com/maps/dir/?api=1&destination=${pin.lat},${pin.lng}`
}

export function MapExperience({ productId, onOpenStore }: {
  productId: string | null
  onOpenStore: (store: StoreMapRecord) => void
}) {
  const mapElementRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const [pins, setPins] = useState<MapPin[]>([])
  const [prices, setPrices] = useState<StorePriceRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [selectedPin, setSelectedPin] = useState<MapPin | null>(null)
  const [offline, setOffline] = useState(!navigator.onLine)
  const [tilesFailed, setTilesFailed] = useState(false)
  const [fetchedAt, setFetchedAt] = useState<number | null>(null)

  useEffect(() => {
    const cacheKey = productId ? `price-list:map-product:${productId}` : 'stores:map'
    const cachedMap = readPublicCache<MapData>(cacheKey)
    const cachedProductPrices = productId
      ? readPublicCache<StorePriceRow[]>(`price-list:product:${productId}`)
      : null
    const cachedStores = productId ? readPublicCache<StoreMapRecord[]>('stores:map') : null
    const cached = cachedMap ?? (
      cachedProductPrices && cachedStores
        ? {
            key: cacheKey,
            data: mapProductPrices(cachedProductPrices.data, cachedStores.data),
            fetchedAt: Math.min(cachedProductPrices.fetchedAt, cachedStores.fetchedAt),
          }
        : null
    )
    if (cached) {
      setPins(cached.data.pins)
      setPrices(cached.data.prices)
      setFetchedAt(cached.fetchedAt)
      setLoading(false)
      setError(false)
    } else {
      setLoading(true)
      setPins([])
      setPrices([])
    }
    if (!supabase) {
      setError(!cached)
      setLoading(false)
      return
    }
    const client = supabase
    let active = true
    setSelectedPin(null)

    const loadPins = async (): Promise<MapData> => {
      if (productId) {
        const { data, error: requestError } = await client
          .from('price_list')
          .select('price_id, store_id, price, in_stock, photo_paths, updated_at, store_name, store_logo_path, store_serial_no, product_id, product_name, unit')
          .eq('product_id', productId)
          .order('price', { ascending: true })
        if (requestError) throw requestError
        const listings = (data ?? []) as StorePriceRow[]
        const storeIds = [...new Set(listings.map((item) => item.store_id))]
        if (storeIds.length === 0) return { prices: [], pins: [] }
        const { data: storeData, error: storeError } = await client
          .from('stores')
          .select('id, name, city, address, lat, lng, logo_path, serial_no')
          .in('id', storeIds)
          .eq('status', 'approved')
          .not('lat', 'is', null)
          .not('lng', 'is', null)
        if (storeError) throw storeError
        return mapProductPrices(listings, (storeData ?? []) as StoreMapRecord[])
      }

      {
        const { data, error: requestError } = await client
          .from('stores')
          .select('id, name, city, address, lat, lng, logo_path, serial_no')
          .eq('status', 'approved')
          .not('lat', 'is', null)
          .not('lng', 'is', null)
        if (requestError) throw requestError
        const storeRows = (data ?? []) as StoreMapRecord[]
        const pins = storeRows
          .filter((store): store is StoreMapRecord & { lat: number; lng: number } => store.lat !== null && store.lng !== null)
          .map((store) => ({ ...store, lat: store.lat, lng: store.lng }))
        return { prices: [], pins }
      }
    }
    void withRequestTimeout(loadPins).then((data) => {
      if (!active) return
      writePublicCache(cacheKey, data)
      setPins(data.pins)
      setPrices(data.prices)
      setFetchedAt(null)
      setError(false)
      setLoading(false)
    }).catch(() => {
      if (!active) return
      setError(!cached)
      setLoading(false)
    })
    return () => { active = false }
  }, [productId])

  useEffect(() => {
    const element = mapElementRef.current
    if (!element) return
    const map = L.map(element, { zoomControl: false }).setView([37.95, 58.38], 12)
    L.control.zoom({ zoomInTitle: tk.buyer.zoomIn, zoomOutTitle: tk.buyer.zoomOut }).addTo(map)
    mapRef.current = map
    const tiles = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map)
    tiles.on('tileerror', () => setTilesFailed(true))
    const handleOnline = () => {
      setOffline(false)
      setTilesFailed(false)
    }
    const handleOffline = () => setOffline(true)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    const resizeObserver = new ResizeObserver(() => map.invalidateSize())
    resizeObserver.observe(element)
    requestAnimationFrame(() => map.invalidateSize())

    return () => {
      resizeObserver.disconnect()
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      map.remove()
      mapRef.current = null
    }
  }, [])

  const cheapestPrice = useMemo(() => pins.reduce<number | null>((value, pin) => {
    if (pin.price === undefined) return value
    return value === null ? pin.price : Math.min(value, pin.price)
  }, null), [pins])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const group = L.markerClusterGroup({
      chunkedLoading: true,
      chunkInterval: 100,
      chunkDelay: 50,
      maxClusterRadius: 48,
    })
    for (const pin of pins) {
      if (pin.lat === null || pin.lng === null) continue
      const marker = L.marker([pin.lat, pin.lng], {
        icon: pinIcon(pin, pin.price !== undefined && pin.price === cheapestPrice),
        title: pin.name,
      })
      marker.on('click', () => {
        setSelectedPin(pin)
        map.panTo([pin.lat, pin.lng])
      })
      group.addLayer(marker)
    }

    map.addLayer(group)
    if (pins.length > 0) {
      const bounds = group.getBounds()
      if (bounds.isValid()) map.fitBounds(bounds, { padding: [28, 28], maxZoom: 15 })
    } else {
      map.setView([37.95, 58.38], 12)
    }
    return () => {
      map.removeLayer(group)
    }
  }, [pins, cheapestPrice])

  const selectedPrice = selectedPin ? prices.find((item) => item.store_id === selectedPin.id) : undefined
  const selectedLogo = selectedPin?.logo_path && supabase
    ? supabase.storage.from('store-logos').getPublicUrl(selectedPin.logo_path).data.publicUrl
    : ''

  return (
    <section className="mt-5 space-y-3">
      {(offline || tilesFailed) && <p role="status" className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900">{tk.buyer.mapOffline}</p>}
      <OfflineDataNotice fetchedAt={fetchedAt} />
      <div ref={mapElementRef} className="store-main-map h-[55vh] min-h-80 max-h-[560px] w-full overflow-hidden rounded-md border border-stone-300" />
      {loading && <p className="text-sm text-stone-500">{tk.buyer.mapLoading}</p>}
      {error && <p role="alert" className="text-sm text-red-700">{tk.buyer.mapLoadError}</p>}
      {!loading && !error && pins.length === 0 && <p className="text-sm text-stone-500">{tk.buyer.mapNoStores}</p>}
      {selectedPin && (
        <article className="space-y-3 rounded-lg border border-stone-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-3">
            {selectedLogo && <img src={selectedLogo} alt="" loading="lazy" className="h-12 w-12 rounded-full border border-white object-cover shadow-sm" />}
            <div className="min-w-0">
              <h2 className="font-semibold text-stone-900">{selectedPin.name}</h2>
              <p className="text-sm text-stone-600">{selectedPin.serial_no !== null ? tk.buyer.serialNo(selectedPin.serial_no) : tk.buyer.noSerialNo}</p>
            </div>
            {selectedPrice && <p className="ml-auto shrink-0 font-bold tabular-nums">{Number(selectedPrice.price).toFixed(2)} {tk.buyer.currency}</p>}
          </div>
          {selectedPin.city && <p className="text-sm text-stone-700">{selectedPin.city}</p>}
          <p className="text-sm text-stone-700">{selectedPin.address}</p>
          {selectedPrice && (
            <div className="flex flex-wrap items-center gap-2 text-xs text-stone-600">
              <span>{tk.buyer.updated}: {relativeTime(selectedPrice.updated_at)}</span>
              {Date.now() - new Date(selectedPrice.updated_at).getTime() > 86400000 && <span className="font-semibold">{tk.buyer.oldData}</span>}
              {selectedPrice.photo_paths[0] && supabase && (
                <img
                  src={supabase.storage.from('product-photos').getPublicUrl(thumbnailPathFor(selectedPrice.photo_paths[0])).data.publicUrl}
                  alt={tk.buyer.productPhoto}
                  loading="lazy"
                  className="h-10 w-10 rounded object-cover"
                />
              )}
            </div>
          )}
          <div className="grid grid-cols-2 gap-2">
            <a href={getDirectionsUrl(selectedPin)} target="_blank" rel="noopener" className="flex min-h-11 items-center justify-center rounded-md border border-stone-300 px-3 text-center text-sm font-semibold text-stone-800">
              {tk.buyer.directions}
            </a>
            <button type="button" onClick={() => onOpenStore(selectedPin)} className="min-h-11 rounded-md bg-emerald-800 px-3 text-sm font-semibold text-white">
              {tk.buyer.storeProducts}
            </button>
          </div>
        </article>
      )}
    </section>
  )
}

export function StoreProductsPage({ store, basket, onAddToBasket }: {
  store: StoreMapRecord
  basket: BasketItem[]
  onAddToBasket: (productId: string) => void
}) {
  const [listings, setListings] = useState<StorePriceRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [fetchedAt, setFetchedAt] = useState<number | null>(null)

  useEffect(() => {
    const cacheKey = `price-list:store:${store.id}`
    const cached = readPublicCache<StorePriceRow[]>(cacheKey)
    if (cached) {
      setListings(cached.data)
      setFetchedAt(cached.fetchedAt)
      setLoading(false)
      setError(false)
    } else {
      setLoading(true)
    }
    if (!supabase) {
      setError(!cached)
      setLoading(false)
      return
    }
    const client = supabase
    let active = true
    void withRequestTimeout(async () => {
      const { data, error: requestError } = await client
        .from('price_list')
        .select('price_id, store_id, price, in_stock, photo_paths, updated_at, store_name, store_logo_path, store_serial_no, product_id, product_name, unit')
        .eq('store_id', store.id)
        .order('product_name')
      if (requestError) throw requestError
      return (data ?? []) as StorePriceRow[]
    }).then((data) => {
        if (!active) return
        writePublicCache(cacheKey, data)
      cacheProducts(data.map((listing) => ({
        id: listing.product_id,
        name_tk: listing.product_name,
        unit: listing.unit,
      })))
      setError(false)
        setListings(data)
        setFetchedAt(null)
        setLoading(false)
      }).catch(() => {
        if (!active) return
        setError(!cached)
        setLoading(false)
      })
    return () => { active = false }
  }, [store.id])

  return (
    <section className="mt-5">
      <div className="mb-4 flex items-center gap-3 border-b border-stone-200 pb-4">
        {store.logo_path && supabase && (
          <img
            src={supabase.storage.from('store-logos').getPublicUrl(store.logo_path).data.publicUrl}
            alt=""
            loading="lazy"
            className="h-12 w-12 rounded-full border border-white object-cover shadow-sm"
          />
        )}
        <div className="min-w-0">
          {store.serial_no !== null && <p className="text-sm text-stone-600">{tk.buyer.serialNo(store.serial_no)}</p>}
          {store.city && <p className="text-sm text-stone-700">{store.city}</p>}
          <p className="text-sm text-stone-700">{store.address}</p>
        </div>
      </div>
      <OfflineDataNotice fetchedAt={fetchedAt} />
      {loading ? <p className="text-sm text-stone-500">{tk.buyer.mapLoading}</p> : error ? (
        <p role="alert" className="text-sm text-red-700">{tk.buyer.loadError}</p>
      ) : listings.length === 0 ? (
        <p className="mt-8 text-center text-sm text-stone-500">{tk.buyer.noStoreProducts}</p>
      ) : (
        <div className="divide-y divide-stone-200">
          {listings.map((listing) => {
            const photoPath = listing.photo_paths?.[0]
            const photoUrl = photoPath && supabase
              ? supabase.storage.from('product-photos').getPublicUrl(thumbnailPathFor(photoPath)).data.publicUrl
              : ''
            const isOld = Date.now() - new Date(listing.updated_at).getTime() > 86400000
            const inBasket = basket.some((item) => item.productId === listing.product_id)
            return (
              <article key={listing.price_id} className={`flex gap-3 py-4 ${isOld ? 'text-stone-500' : 'text-stone-800'}`}>
                {photoUrl ? (
                  <img src={photoUrl} alt={tk.buyer.productPhoto} loading="lazy" className="h-16 w-16 shrink-0 rounded object-cover" />
                ) : <div aria-hidden="true" className="h-16 w-16 shrink-0 rounded bg-stone-100" />}
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <h2 className="font-semibold">{listing.product_name}</h2>
                    <p className="shrink-0 text-right font-bold tabular-nums">{Number(listing.price).toFixed(2)} {tk.buyer.currency}</p>
                  </div>
                  <p className="mt-1 text-xs">{tk.buyer.updated}: {relativeTime(listing.updated_at)}</p>
                  {isOld && <p className="text-xs font-semibold">{tk.buyer.oldData}</p>}
                  <button
                    type="button"
                    onClick={() => onAddToBasket(listing.product_id)}
                    disabled={inBasket}
                    className="mt-2 min-h-10 rounded-md bg-emerald-800 px-3 text-sm font-semibold text-white disabled:bg-stone-200 disabled:text-stone-600"
                  >
                    {inBasket ? tk.basket.inBasket : tk.basket.add}
                  </button>
                </div>
              </article>
            )
          })}
        </div>
      )}
    </section>
  )
}
