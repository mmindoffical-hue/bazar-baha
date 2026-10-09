import { useEffect, useMemo, useState } from 'react'
import { Minus, Plus, Trash2 } from 'lucide-react'
import { tk } from '../i18n/tk'
import { supabase } from '../lib/supabase'
import type { BasketItem } from '../lib/basket'
import type { PriceListing, Product } from '../lib/types'
import { PageSkeleton } from '../components/PageSkeleton'

type BasketProduct = Product & { listings: PriceListing[] }

export function BasketPage({ basket, onBasketChange }: {
  basket: BasketItem[]
  onBasketChange: (basket: BasketItem[]) => void
}) {
  const [products, setProducts] = useState<BasketProduct[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)
  const basketIds = basket.map((item) => item.productId).join(',')

  useEffect(() => {
    if (!basketIds) {
      setProducts([])
      setLoading(false)
      setError(false)
      return
    }
    if (!supabase) {
      setError(true)
      setLoading(false)
      return
    }

    const client = supabase
    let active = true
    const loadBasketProducts = async () => {
      setLoading(true)
      setError(false)
      const ids = basketIds.split(',')
      const [productResult, priceResult] = await Promise.all([
        client.from('products').select('id, name_tk, unit').in('id', ids),
        client.from('price_list')
          .select('price_id, store_id, price, in_stock, photo_paths, updated_at, store_name, product_id, product_name, unit')
          .in('product_id', ids)
          .eq('in_stock', true)
          .order('price', { ascending: true }),
      ])
      if (!active) return
      if (productResult.error || priceResult.error) {
        setError(true)
        setLoading(false)
        return
      }
      const listings = (priceResult.data ?? []) as PriceListing[]
      setProducts(((productResult.data ?? []) as Product[]).map((product) => ({
        ...product,
        listings: listings.filter((listing) => listing.product_id === product.id),
      })))
      setLoading(false)
    }
    void loadBasketProducts()
    return () => { active = false }
  }, [basketIds])

  const basketRows = useMemo(() => basket.flatMap((item) => {
    const product = products.find((entry) => entry.id === item.productId)
    if (!product) return []
    const cheapest = product.listings[0]
    return [{
      ...item,
      product,
      cheapest,
      old: cheapest ? Date.now() - new Date(cheapest.updated_at).getTime() > 86400000 : false,
    }]
  }), [basket, products])

  const storeTotals = useMemo(() => {
    const totals = new Map<string, { name: string; count: number; total: number; old: boolean }>()
    for (const row of basketRows) {
      const cheapest = row.cheapest
      if (!cheapest) continue
      const total = totals.get(cheapest.store_id) ?? { name: cheapest.store_name, count: 0, total: 0, old: false }
      total.count += 1
      total.total += Number(cheapest.price) * row.qty
      total.old ||= row.old
      totals.set(cheapest.store_id, total)
    }
    return [...totals.entries()].map(([id, value]) => ({ id, ...value }))
      .sort((a, b) => Number(b.count === basketRows.length) - Number(a.count === basketRows.length) || a.total - b.total)
  }, [basketRows])

  const cheapestTotal = basketRows.reduce((total, row) => {
    const cheapest = row.cheapest
    return total + (cheapest ? Number(cheapest.price) * row.qty : 0)
  }, 0)

  const setQuantity = (productId: string, qty: number) => {
    onBasketChange(basket.map((item) => item.productId === productId ? { ...item, qty } : item))
  }

  if (basket.length === 0) return <p className="mt-8 text-center text-sm text-stone-500">{tk.basket.empty}</p>
  if (loading) return <PageSkeleton />
  if (error) return <p role="alert" className="mt-8 text-sm text-red-700">{tk.buyer.loadError}</p>

  return (
    <section className="mt-5 space-y-6">
      <div className="flex justify-end">
        <button type="button" onClick={() => onBasketChange([])} className="min-h-11 text-sm font-semibold text-red-700">{tk.basket.clear}</button>
      </div>
      <div className="divide-y divide-stone-200">
        {basketRows.map((row) => {
          const { product, cheapest, old, qty } = row
          return (
            <article key={product.id} className="space-y-3 py-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="font-semibold text-stone-900">{product.name_tk}</h2>
                  <p className="text-sm text-stone-500">{tk.buyer.unit}: {product.unit}</p>
                </div>
                <button type="button" onClick={() => onBasketChange(basket.filter((entry) => entry.productId !== product.id))} aria-label={tk.basket.remove} className="flex h-11 w-11 shrink-0 items-center justify-center text-red-700">
                  <Trash2 aria-hidden="true" size={19} />
                </button>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <button type="button" aria-label={tk.basket.decrease} disabled={qty <= 0.5} onClick={() => setQuantity(product.id, Math.max(0.5, qty - 0.5))} className="flex h-11 w-11 items-center justify-center rounded border border-stone-300 disabled:opacity-40"><Minus aria-hidden="true" size={17} /></button>
                  <span className="min-w-12 text-center font-semibold tabular-nums">{qty}</span>
                  <button type="button" aria-label={tk.basket.increase} disabled={qty >= 99} onClick={() => setQuantity(product.id, Math.min(99, qty + 0.5))} className="flex h-11 w-11 items-center justify-center rounded border border-stone-300 disabled:opacity-40"><Plus aria-hidden="true" size={17} /></button>
                </div>
                {cheapest ? (
                  <div className="text-right">
                    <p className="text-sm text-stone-600">{cheapest.store_name}: {Number(cheapest.price).toFixed(2)} {tk.buyer.currency}</p>
                    <p className="font-semibold tabular-nums">{(Number(cheapest.price) * qty).toFixed(2)} {tk.buyer.currency}</p>
                    {old && <p className="text-xs text-stone-500">{tk.buyer.oldData}</p>}
                  </div>
                ) : <p className="text-sm font-semibold text-stone-500">{tk.basket.noPrice}</p>}
              </div>
            </article>
          )
        })}
      </div>
      <div className="border-t-2 border-stone-900 pt-4">
        <div className="flex justify-between gap-3 font-semibold text-stone-900">
          <span>{tk.basket.cheapestTotal}</span><span className="shrink-0 tabular-nums">{cheapestTotal.toFixed(2)} {tk.buyer.currency}</span>
        </div>
      </div>
      <div>
        <h2 className="mb-2 font-semibold text-stone-900">{tk.basket.byStore}</h2>
        {storeTotals.map((store) => (
          <div key={store.id} className="flex justify-between gap-3 border-b border-stone-200 py-3 text-sm">
            <span className="min-w-0"><span className="font-medium">{store.name}</span><span className="ml-2 text-stone-500">{store.count}/{products.length}</span>{store.old && <span className="ml-2 text-xs text-stone-500">{tk.buyer.oldData}</span>}</span>
            <span className="shrink-0 font-semibold tabular-nums">{store.total.toFixed(2)} {tk.buyer.currency}</span>
          </div>
        ))}
      </div>
    </section>
  )
}
