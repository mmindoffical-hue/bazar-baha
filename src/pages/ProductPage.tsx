import { useEffect, useMemo, useState } from 'react'
import { tk } from '../i18n/tk'
import { supabase } from '../lib/supabase'
import type { PriceListing, Product } from '../lib/types'
import { PageSkeleton } from '../components/PageSkeleton'
import { PriceRow } from '../components/PriceRow'
import type { BasketItem } from '../lib/basket'
import { OfflineDataNotice } from '../components/OfflineDataNotice'
import { readPublicCache, withRequestTimeout, writePublicCache } from '../lib/publicCache'

export function ProductPage({ product, basket, onAddToBasket, onOpenProfile, onShowOnMap }: {
  product: Product
  basket: BasketItem[]
  onAddToBasket: (productId: string) => void
  onOpenProfile: () => void
  onShowOnMap: () => void
}) {
  const [priceListings, setPriceListings] = useState<PriceListing[]>([])
  const [pricesLoading, setPricesLoading] = useState(true)
  const [pricesRefreshing, setPricesRefreshing] = useState(false)
  const [pricesError, setPricesError] = useState(false)
  const [refreshCount, setRefreshCount] = useState(0)
  const [pricesFetchedAt, setPricesFetchedAt] = useState<number | null>(null)

  useEffect(() => {
    const cacheKey = `price-list:product:${product.id}`
    const cached = readPublicCache<PriceListing[]>(cacheKey)
    if (cached) {
      setPriceListings(cached.data)
      setPricesFetchedAt(null)
      setPricesLoading(false)
      setPricesError(false)
    } else {
      setPricesLoading(true)
    }
    if (!supabase) {
      setPricesError(!cached)
      setPricesFetchedAt(cached?.fetchedAt ?? null)
      setPricesLoading(false)
      setPricesRefreshing(false)
      return
    }

    const client = supabase
    let mounted = true
    const startedAt = Date.now()
    setPricesError(false)
    setPricesFetchedAt(null)
    setPricesRefreshing(true)
    void withRequestTimeout(async () => {
      const { data, error: requestError } = await client
        .from('price_list')
        .select('price_id, store_id, price, in_stock, photo_paths, updated_at, store_name, store_logo_path, store_serial_no, product_id, product_name, unit')
        .eq('product_id', product.id)
        .order('price', { ascending: true })
      if (requestError) throw requestError
      return (data ?? []) as PriceListing[]
    }).then((data) => {
        if (!mounted) return
        writePublicCache(cacheKey, data)
        setPriceListings(data)
        setPricesFetchedAt(null)
        setPricesError(false)
        setPricesLoading(false)
        setPricesRefreshing(false)
      }).catch(() => {
        if (!mounted) return
        setPricesFetchedAt(cached && Date.now() - startedAt <= 3000 ? cached.fetchedAt : null)
        setPricesError(!cached)
        setPricesLoading(false)
        setPricesRefreshing(false)
      })

    return () => { mounted = false }
  }, [product.id, refreshCount])

  const cheapestIds = useMemo(() => {
    const currentListings = priceListings.filter((listing) =>
      listing.in_stock && Date.now() - new Date(listing.updated_at).getTime() <= 86400000)
    if (currentListings.length < 2) return new Set<string>()
    const cheapestPrice = Math.min(...currentListings.map((listing) => Number(listing.price)))
    return new Set(currentListings
      .filter((listing) => Number(listing.price) === cheapestPrice)
      .map((listing) => listing.price_id))
  }, [priceListings])

  return (
    <section aria-label={product.name_tk} className="mt-5 space-y-3">
      <button
        type="button"
        onClick={() => onAddToBasket(product.id)}
        disabled={basket.some((item) => item.productId === product.id)}
        className="min-h-11 w-full rounded-md bg-emerald-800 px-4 text-sm font-semibold text-white disabled:bg-stone-200 disabled:text-stone-600"
      >
        {basket.some((item) => item.productId === product.id) ? tk.basket.inBasket : tk.basket.add}
      </button>
      <button
        type="button"
        onClick={() => setRefreshCount((current) => current + 1)}
        disabled={pricesLoading}
        className="min-h-8 text-xs font-semibold text-emerald-900 disabled:opacity-50"
      >
        {tk.buyer.refresh}
      </button>
      <button type="button" onClick={onShowOnMap} className="min-h-10 text-xs font-semibold text-emerald-900 underline underline-offset-2">
        {tk.buyer.showOnMap}
      </button>
      <OfflineDataNotice fetchedAt={pricesFetchedAt} refreshing={pricesRefreshing} />
      {pricesLoading && priceListings.length === 0 ? <PageSkeleton /> : pricesError ? (
        <p role="alert" className="mt-8 text-sm text-red-700">{tk.buyer.loadError}</p>
      ) : priceListings.length === 0 ? (
        <p className="mt-8 text-center text-sm text-stone-500">{tk.buyer.empty}</p>
      ) : priceListings.map((listing) => <PriceRow key={listing.price_id} listing={listing} cheapest={cheapestIds.has(listing.price_id)} onOpenProfile={onOpenProfile} />)}
    </section>
  )
}
