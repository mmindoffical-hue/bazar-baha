import { useEffect, useState } from 'react'
import { tk } from '../i18n/tk'
import { supabase } from '../lib/supabase'
import type { PriceListing, Product } from '../lib/types'
import { PageSkeleton } from '../components/PageSkeleton'
import { PriceRow } from '../components/PriceRow'
import type { BasketItem } from '../lib/basket'

export function ProductPage({ product, basket, onAddToBasket, onOpenProfile }: {
  product: Product
  basket: BasketItem[]
  onAddToBasket: (productId: string) => void
  onOpenProfile: () => void
}) {
  const [priceListings, setPriceListings] = useState<PriceListing[]>([])
  const [pricesLoading, setPricesLoading] = useState(false)
  const [pricesError, setPricesError] = useState(false)
  const [refreshCount, setRefreshCount] = useState(0)

  useEffect(() => {
    if (!supabase) {
      setPricesError(true)
      setPricesLoading(false)
      return
    }

    let mounted = true
    setPricesLoading(true)
    setPricesError(false)
    void supabase
      .from('price_list')
      .select('price_id, store_id, price, in_stock, photo_paths, updated_at, store_name, product_id, product_name, unit')
      .eq('product_id', product.id)
      .order('price', { ascending: true })
      .then(({ data, error: requestError }) => {
        if (!mounted) return
        setPriceListings((data ?? []) as PriceListing[])
        setPricesError(Boolean(requestError))
        setPricesLoading(false)
      })

    return () => { mounted = false }
  }, [product.id, refreshCount])

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
      {pricesLoading ? <PageSkeleton /> : pricesError ? (
        <p role="alert" className="mt-8 text-sm text-red-700">{tk.buyer.loadError}</p>
      ) : priceListings.length === 0 ? (
        <p className="mt-8 text-center text-sm text-stone-500">{tk.buyer.empty}</p>
      ) : priceListings.map((listing) => <PriceRow key={listing.price_id} listing={listing} onOpenProfile={onOpenProfile} />)}
    </section>
  )
}
