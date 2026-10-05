import { useEffect, useState } from 'react'
import { tk } from '../i18n/tk'
import { supabase } from '../lib/supabase'
import type { PriceListing, Product } from '../lib/types'
import { PageSkeleton } from '../components/PageSkeleton'
import { PriceRow } from '../components/PriceRow'

export function ProductPage({ product }: { product: Product }) {
  const [priceListings, setPriceListings] = useState<PriceListing[]>([])
  const [pricesLoading, setPricesLoading] = useState(false)
  const [pricesError, setPricesError] = useState(false)

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
      .select('price_id, price, in_stock, video_path, updated_at, store_name, product_id, product_name, unit')
      .eq('product_id', product.id)
      .order('price', { ascending: true })
      .then(({ data, error: requestError }) => {
        if (!mounted) return
        setPriceListings((data ?? []) as PriceListing[])
        setPricesError(Boolean(requestError))
        setPricesLoading(false)
      })

    return () => { mounted = false }
  }, [product])

  return (
    <section aria-label={product.name_tk} className="mt-5 space-y-3">
      {pricesLoading ? <PageSkeleton /> : pricesError ? (
        <p role="alert" className="mt-8 text-sm text-red-700">{tk.buyer.loadError}</p>
      ) : priceListings.length === 0 ? (
        <p className="mt-8 text-center text-sm text-stone-500">{tk.buyer.empty}</p>
      ) : priceListings.map((listing) => <PriceRow key={listing.price_id} listing={listing} />)}
    </section>
  )
}
