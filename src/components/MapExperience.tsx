import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown, ChevronUp, LocateFixed, Search } from 'lucide-react'
import { tk } from '../i18n/tk'
import { relativeTime } from '../lib/formatting'
import type { BasketItem } from '../lib/basket'
import { supabase } from '../lib/supabase'
import type { Product, StoreMapRecord } from '../lib/types'
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
  photo_paths: string[] | null
  updated_at: string
  store_name: string
  store_logo_path: string | null
  store_serial_no: number | null
  product_id: string
  product_name: string
  unit: string
}
type MapData = { pins: MapPin[]; prices: StorePriceRow[]; missingLocationCount: number }
type NewsPrice = Pick<StorePriceRow, 'price_id' | 'store_id' | 'price' | 'photo_paths' | 'updated_at' | 'store_name' | 'product_id' | 'product_name' | 'unit'>
type MapNews = { newStores: StoreMapRecord[]; latestPrices: NewsPrice[] }

function hasLocation(store: StoreMapRecord): store is StoreMapRecord & { lat: number; lng: number } {
  return typeof store.lat === 'number' && Number.isFinite(store.lat)
    && typeof store.lng === 'number' && Number.isFinite(store.lng)
}

function mapProductPrices(listings: StorePriceRow[], stores: StoreMapRecord[]): MapData {
  const storesById = new Map(stores.map((store) => [store.id, store]))
  const prices = listings.filter((item) => storesById.has(item.store_id))
  const missingLocationCount = new Set(prices.flatMap((item) => {
    const store = storesById.get(item.store_id)
    return store && !hasLocation(store) ? [item.store_id] : []
  })).size
  const pins = prices.flatMap((item) => {
    const store = storesById.get(item.store_id)
    if (!store || !hasLocation(store)) return []
    return [{ ...store, lat: store.lat, lng: store.lng, price: Number(item.price) }]
  })
  return { prices, pins, missingLocationCount }
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

  const approvalAge = pin.approved_at ? Date.now() - new Date(pin.approved_at).getTime() : Number.POSITIVE_INFINITY
  if (approvalAge >= 0 && approvalAge <= 7 * 24 * 60 * 60 * 1000) {
    const badge = document.createElement('span')
    badge.textContent = tk.buyer.newBadge
    badge.className = 'store-map-new-badge'
    root.append(badge)
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

export function MapExperience({ productId, onOpenStore, onOpenSearch, onOpenProduct }: {
  productId: string | null
  onOpenStore: (store: StoreMapRecord) => void
  onOpenSearch: () => void
  onOpenProduct: (product: Product) => void
}) {
  const mapElementRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const [pins, setPins] = useState<MapPin[]>([])
  const [prices, setPrices] = useState<StorePriceRow[]>([])
  const [missingLocationCount, setMissingLocationCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState(false)
  const [selectedPin, setSelectedPin] = useState<MapPin | null>(null)
  const [offline, setOffline] = useState(!navigator.onLine)
  const [tilesFailed, setTilesFailed] = useState(false)
  const [fetchedAt, setFetchedAt] = useState<number | null>(null)
  const [news, setNews] = useState<MapNews>({ newStores: [], latestPrices: [] })
  const [newsLoading, setNewsLoading] = useState(true)
  const [newsError, setNewsError] = useState(false)
  const [newsExpanded, setNewsExpanded] = useState(false)
  const [locationLoading, setLocationLoading] = useState(false)
  const [locationError, setLocationError] = useState(false)
  const [focusedNewsPrice, setFocusedNewsPrice] = useState<NewsPrice | null>(null)

  useEffect(() => {
    const cacheKey = 'map:news'
    const cached = readPublicCache<MapNews>(cacheKey)
    if (cached) {
      setNews(cached.data)
      setNewsLoading(false)
      setNewsError(false)
    }
    if (!supabase) {
      setNewsLoading(false)
      setNewsError(!cached)
      return
    }
    const client = supabase
    let active = true
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
    void withRequestTimeout(async () => {
      const [storesResult, pricesResult] = await Promise.all([
        client.from('stores')
          .select('id, name, city, address, lat, lng, logo_path, serial_no, approved_at')
          .eq('status', 'approved')
          .gte('approved_at', since)
          .order('approved_at', { ascending: false }),
        client.from('price_list')
          .select('price_id, store_id, price, photo_paths, updated_at, store_name, product_id, product_name, unit')
          .order('updated_at', { ascending: false })
          .limit(10),
      ])
      if (storesResult.error) throw storesResult.error
      if (pricesResult.error) throw pricesResult.error
      return {
        newStores: (storesResult.data ?? []) as StoreMapRecord[],
        latestPrices: (pricesResult.data ?? []) as NewsPrice[],
      }
    }).then((data) => {
      if (!active) return
      writePublicCache(cacheKey, data)
      setNews(data)
      setNewsLoading(false)
      setNewsError(false)
    }).catch((error: unknown) => {
      console.error('Map news could not be loaded.', error)
      if (!active) return
      setNewsLoading(false)
      setNewsError(!cached)
    })
    return () => { active = false }
  }, [])

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
      setMissingLocationCount(cached.data.missingLocationCount ?? 0)
      setFetchedAt(null)
      setLoading(false)
      setError(false)
    } else {
      setLoading(true)
      setPins([])
      setPrices([])
      setMissingLocationCount(0)
    }
    if (!supabase) {
      setError(!cached)
      setLoading(false)
      setRefreshing(false)
      return
    }
    const client = supabase
    let active = true
    const startedAt = Date.now()
    setSelectedPin(null)
    setFetchedAt(null)
    setRefreshing(true)

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
        if (storeIds.length === 0) return { prices: [], pins: [], missingLocationCount: 0 }
        const { data: storeData, error: storeError } = await client
          .from('stores')
          .select('id, name, city, address, lat, lng, logo_path, serial_no, approved_at')
          .in('id', storeIds)
          .eq('status', 'approved')
        if (storeError) throw storeError
        return mapProductPrices(listings, (storeData ?? []) as StoreMapRecord[])
      }

      {
        const { data, error: requestError } = await client
          .from('stores')
          .select('id, name, city, address, lat, lng, logo_path, serial_no, approved_at')
          .eq('status', 'approved')
        if (requestError) throw requestError
        const storeRows = (data ?? []) as StoreMapRecord[]
        const missingLocationCount = storeRows.filter((store) => !hasLocation(store)).length
        const pins = storeRows
          .filter(hasLocation)
          .map((store) => ({ ...store, lat: store.lat, lng: store.lng }))
        return { prices: [], pins, missingLocationCount }
      }
    }
    void withRequestTimeout(loadPins).then((data) => {
      if (!active) return
      writePublicCache(cacheKey, data)
      setPins(data.pins)
      setPrices(data.prices)
      setMissingLocationCount(data.missingLocationCount)
      setFetchedAt(null)
      setError(false)
      setLoading(false)
      setRefreshing(false)
    }).catch(() => {
      if (!active) return
      setFetchedAt(cached && Date.now() - startedAt <= 3000 ? cached.fetchedAt : null)
      setError(!cached)
      setLoading(false)
      setRefreshing(false)
    })
    return () => { active = false }
  }, [productId])

  useEffect(() => {
    const element = mapElementRef.current
    if (!element) return
    const map = L.map(element, {
      zoomControl: false,
      markerZoomAnimation: false,
      fadeAnimation: false,
      attributionControl: false,
    }).setView([37.95, 58.38], 12)
    L.control.zoom({ zoomInTitle: tk.buyer.zoomIn, zoomOutTitle: tk.buyer.zoomOut }).addTo(map)
    L.control.attribution({ prefix: false }).addTo(map)
    mapRef.current = map
    const tiles = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: tk.buyer.osmAttribution,
      updateWhenIdle: true,
      keepBuffer: 1,
      updateWhenZooming: false,
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

  const markers = useMemo(() => pins.flatMap((pin) => {
    if (!Number.isFinite(pin.lat) || !Number.isFinite(pin.lng)) return []
    const marker = L.marker([pin.lat, pin.lng], {
      icon: pinIcon(pin, pin.price !== undefined && pin.price === cheapestPrice),
      title: pin.name,
    })
    marker.on('click', () => {
      setFocusedNewsPrice(null)
      setSelectedPin(pin)
      mapRef.current?.panTo([pin.lat, pin.lng])
    })
    return [marker]
  }), [pins, cheapestPrice])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const group = L.markerClusterGroup({
      chunkedLoading: true,
      chunkInterval: 100,
      chunkDelay: 50,
      maxClusterRadius: 48,
    })
    for (const marker of markers) group.addLayer(marker)

    map.addLayer(group)
    if (markers.length > 0) {
      const bounds = group.getBounds()
      if (bounds.isValid()) map.fitBounds(bounds, { padding: [28, 28], maxZoom: 15 })
    } else {
      map.setView([37.95, 58.38], 12)
    }
    return () => {
      map.removeLayer(group)
    }
  }, [markers])

  useEffect(() => {
    if (!focusedNewsPrice) return
    const pin = pins.find((item) => item.id === focusedNewsPrice.store_id)
    if (!pin) return
    setSelectedPin(pin)
    const map = mapRef.current
    map?.setView([pin.lat, pin.lng], Math.max(map?.getZoom() ?? 0, 15))
  }, [focusedNewsPrice, pins])

  const selectedPrice = selectedPin
    ? (focusedNewsPrice?.store_id === selectedPin.id ? focusedNewsPrice : prices.find((item) => item.store_id === selectedPin.id))
    : undefined
  const selectedLogo = selectedPin?.logo_path && supabase
    ? supabase.storage.from('store-logos').getPublicUrl(selectedPin.logo_path).data.publicUrl
    : ''

  const goToMyLocation = () => {
    if (!navigator.geolocation) {
      setLocationError(true)
      return
    }
    setLocationLoading(true)
    setLocationError(false)
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        mapRef.current?.setView([coords.latitude, coords.longitude], 15)
        setLocationLoading(false)
      },
      () => {
        setLocationLoading(false)
        setLocationError(true)
      },
      { enableHighAccuracy: false, timeout: 12_000 },
    )
  }

  const focusStore = (store: StoreMapRecord) => {
    if (!hasLocation(store)) {
      onOpenStore(store)
      return
    }
    const pin: MapPin = { ...store, lat: store.lat, lng: store.lng }
    setFocusedNewsPrice(null)
    setSelectedPin(pin)
    const map = mapRef.current
    map?.setView([pin.lat, pin.lng], Math.max(map?.getZoom() ?? 0, 15))
  }

  const focusPrice = (price: NewsPrice) => {
    setFocusedNewsPrice(price)
    const pin = pins.find((item) => item.id === price.store_id)
    if (pin) {
      setSelectedPin(pin)
      const map = mapRef.current
      map?.setView([pin.lat, pin.lng], Math.max(map?.getZoom() ?? 0, 15))
    }
  }

  return (
    <section className={`map-experience${newsExpanded ? ' map-news-open' : ''}`}>
      <div ref={mapElementRef} className="store-main-map map-loading-skeleton" />
      <div className="map-top-controls">
        <button type="button" onClick={onOpenSearch} className="map-search-button">
          <Search aria-hidden="true" size={19} />
          <span>{tk.buyer.mapSearch}</span>
        </button>
        <button type="button" onClick={goToMyLocation} disabled={locationLoading} className="map-location-button" aria-label={locationLoading ? tk.buyer.locationLoading : tk.buyer.myLocation}>
          <LocateFixed aria-hidden="true" size={20} />
          <span>{locationLoading ? tk.buyer.locationLoading : tk.buyer.myLocation}</span>
        </button>
      </div>
      {(offline || tilesFailed) && <p role="status" className="map-status">{tk.buyer.mapOffline}</p>}
      {locationError && <p role="alert" className="map-status map-error">{tk.buyer.locationError}</p>}
      {error && <p role="alert" className="map-status map-error">{tk.buyer.mapLoadError}</p>}
      {!loading && !error && pins.length === 0 && <p className="map-status">{tk.buyer.mapNoStores}</p>}
      {!loading && !error && missingLocationCount > 0 && <p className="map-status map-location-count">{tk.buyer.locationMissing(missingLocationCount)}</p>}
      {selectedPin && (
        <article className={`map-store-card${newsExpanded ? ' map-store-card-above-news' : ''}`}>
          <div className="flex items-center gap-3">
            {selectedLogo && <img src={selectedLogo} alt="" loading="lazy" decoding="async" className="h-12 w-12 rounded-full border border-stone-200 object-cover" />}
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
              {selectedPrice.photo_paths?.[0] && supabase && (
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
          {selectedPrice && (
            <button
              type="button"
              onClick={() => onOpenProduct({ id: selectedPrice.product_id, name_tk: selectedPrice.product_name, unit: selectedPrice.unit })}
              className="min-h-10 w-full rounded-md border border-emerald-800 px-3 text-sm font-semibold text-emerald-900"
            >
              {tk.buyer.openProduct}
            </button>
          )}
        </article>
      )}
      <section className={`map-news-panel${newsExpanded ? ' map-news-panel-expanded' : ''}`}>
        <button
          type="button"
          className="map-news-heading"
          aria-expanded={newsExpanded}
          onClick={() => setNewsExpanded((expanded) => !expanded)}
        >
          <span>{tk.buyer.newsTitle}</span>
          {newsExpanded ? <ChevronDown aria-hidden="true" size={20} /> : <ChevronUp aria-hidden="true" size={20} />}
        </button>
        {newsExpanded && (
          <div className="map-news-content">
            <OfflineDataNotice fetchedAt={fetchedAt} refreshing={refreshing} />
            {newsError && <p role="alert" className="px-4 py-2 text-sm text-red-700">{tk.buyer.newsUnavailable}</p>}
            {newsLoading && news.newStores.length === 0 && news.latestPrices.length === 0 ? (
              <p className="px-4 py-3 text-sm text-stone-500">{tk.buyer.mapLoading}</p>
            ) : (
              <>
                <h2 className="map-news-subtitle">{tk.buyer.newStore}</h2>
                {news.newStores.length === 0 ? (
                  <p className="map-news-empty">{tk.buyer.empty}</p>
                ) : news.newStores.map((store) => (
                  <button key={store.id} type="button" className="map-news-row" onClick={() => focusStore(store)}>
                    <span className="map-news-badge">{tk.buyer.newBadge}</span>
                    <span className="map-news-row-main">{store.name}</span>
                    <span className="map-news-time">{store.approved_at ? relativeTime(store.approved_at) : ''}</span>
                  </button>
                ))}
                <h2 className="map-news-subtitle">{tk.buyer.latestPrices}</h2>
                {news.latestPrices.length === 0 ? (
                  <p className="map-news-empty">{tk.buyer.empty}</p>
                ) : news.latestPrices.map((price) => (
                  <button key={price.price_id} type="button" className="map-news-row map-news-price-row" onClick={() => focusPrice(price)}>
                    <span className="map-news-row-main">
                      <strong>{price.store_name}</strong>
                      <span>{price.product_name} · {Number(price.price).toFixed(2)} {tk.buyer.currency}</span>
                    </span>
                    <span className="map-news-time">{relativeTime(price.updated_at)}</span>
                  </button>
                ))}
              </>
            )}
          </div>
        )}
      </section>
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
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState(false)
  const [fetchedAt, setFetchedAt] = useState<number | null>(null)

  useEffect(() => {
    const cacheKey = `price-list:store:${store.id}`
    const cached = readPublicCache<StorePriceRow[]>(cacheKey)
    if (cached) {
      setListings(cached.data)
      setFetchedAt(null)
      setLoading(false)
      setError(false)
    } else {
      setLoading(true)
    }
    if (!supabase) {
      setError(!cached)
      setLoading(false)
      setRefreshing(false)
      return
    }
    const client = supabase
    let active = true
    const startedAt = Date.now()
    setFetchedAt(null)
    setRefreshing(true)
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
        setRefreshing(false)
        }).catch(() => {
          if (!active) return
          setFetchedAt(cached && Date.now() - startedAt <= 3000 ? cached.fetchedAt : null)
          setError(!cached)
          setLoading(false)
          setRefreshing(false)
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
      <OfflineDataNotice fetchedAt={fetchedAt} refreshing={refreshing} />
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
