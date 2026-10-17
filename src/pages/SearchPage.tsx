import { useEffect, useState } from 'react'
import { ChevronRight, Search } from 'lucide-react'
import { tk } from '../i18n/tk'
import { supabase } from '../lib/supabase'
import type { Product } from '../lib/types'
import { PageSkeleton } from '../components/PageSkeleton'
import { OfflineDataNotice } from '../components/OfflineDataNotice'
import { cacheProducts, readPublicCache, withRequestTimeout, writePublicCache } from '../lib/publicCache'

export function SearchPage({ active, visible, searchTerm, onSearchChange, onSelectProduct }: {
  active: boolean
  visible: boolean
  searchTerm: string
  onSearchChange: (value: string) => void
  onSelectProduct: (product: Product) => void
}) {
  const [products, setProducts] = useState<Product[]>([])
  const [productsLoading, setProductsLoading] = useState(false)
  const [productsRefreshing, setProductsRefreshing] = useState(false)
  const [productsError, setProductsError] = useState(false)
  const [productsFetchedAt, setProductsFetchedAt] = useState<number | null>(null)

  useEffect(() => {
    if (!active || !searchTerm.trim()) {
      setProducts([])
      setProductsError(false)
      setProductsLoading(false)
      setProductsFetchedAt(null)
      setProductsRefreshing(false)
      return
    }
    const normalizedTerm = searchTerm.trim().toLocaleLowerCase()
    const cacheKey = `products:search:${normalizedTerm}`
    const cached = readPublicCache<Product[]>(cacheKey)
    if (cached) {
      setProducts(cached.data)
      setProductsFetchedAt(null)
      setProductsLoading(false)
      setProductsError(false)
    } else {
      setProductsLoading(true)
    }
    if (!supabase) {
      setProductsError(!cached)
      setProductsLoading(false)
      setProductsRefreshing(false)
      return
    }

    const client = supabase
    let mounted = true
    const startedAt = Date.now()
    setProductsFetchedAt(null)
    setProductsRefreshing(true)
    setProductsError(false)
    void withRequestTimeout(async () => {
      const { data, error: requestError } = await client
        .from('products')
        .select('id, name_tk, unit')
        .ilike('name_tk', `%${searchTerm.trim()}%`)
        .order('name_tk')
      if (requestError) throw requestError
      return data ?? []
    }).then((data) => {
        if (!mounted) return
        writePublicCache(cacheKey, data)
        cacheProducts(data)
        setProducts(data)
        setProductsFetchedAt(null)
        setProductsError(false)
        setProductsLoading(false)
        setProductsRefreshing(false)
      }).catch(() => {
        if (!mounted) return
        setProductsFetchedAt(cached && Date.now() - startedAt <= 3000 ? cached.fetchedAt : null)
        setProductsError(!cached)
        setProductsLoading(false)
        setProductsRefreshing(false)
      })

    return () => { mounted = false }
  }, [active, searchTerm])

  return (
    <section hidden={!visible} className="mt-6">
      <label className="relative block">
        <Search aria-hidden="true" size={19} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-500" />
        <input
          type="search"
          value={searchTerm}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder={tk.buyer.searchPlaceholder}
          aria-label={tk.buyer.searchLabel}
          className="min-h-12 w-full rounded-md border border-stone-300 bg-white pl-10 pr-3 text-base text-stone-900 outline-none focus:border-emerald-800 focus:ring-2 focus:ring-emerald-800/15"
        />
      </label>
      {!searchTerm.trim() ? (
        <p className="mt-8 text-center text-sm text-stone-500">{tk.buyer.searchPrompt}</p>
      ) : (
        <>
          <OfflineDataNotice fetchedAt={productsFetchedAt} refreshing={productsRefreshing} active={active && visible} />
          {productsLoading && products.length === 0 ? <PageSkeleton /> : productsError ? (
            <p role="alert" className="mt-8 text-sm text-red-700">{tk.buyer.loadError}</p>
          ) : products.length === 0 ? (
            <p className="mt-8 text-center text-sm text-stone-500">{tk.buyer.empty}</p>
          ) : (
            <div className="mt-4 divide-y divide-stone-200">
              {products.map((product) => (
                <button
                  key={product.id}
                  type="button"
                  onClick={() => onSelectProduct(product)}
                  className="flex min-h-16 w-full items-center justify-between gap-3 py-3 text-left font-medium text-stone-800"
                >
                  <span>{product.name_tk}</span>
                  <span className="flex items-center gap-2 text-sm text-stone-500">
                    {product.unit}<ChevronRight aria-hidden="true" size={18} />
                  </span>
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </section>
  )
}
