import { useEffect, useState } from 'react'
import { ChevronRight, Search } from 'lucide-react'
import { tk } from '../i18n/tk'
import { supabase } from '../lib/supabase'
import type { Product } from '../lib/types'
import { PageSkeleton } from '../components/PageSkeleton'

export function SearchPage({ active, visible, searchTerm, onSearchChange, onSelectProduct }: {
  active: boolean
  visible: boolean
  searchTerm: string
  onSearchChange: (value: string) => void
  onSelectProduct: (product: Product) => void
}) {
  const [products, setProducts] = useState<Product[]>([])
  const [productsLoading, setProductsLoading] = useState(false)
  const [productsError, setProductsError] = useState(false)

  useEffect(() => {
    if (!active || !searchTerm.trim()) {
      setProducts([])
      setProductsError(false)
      setProductsLoading(false)
      return
    }
    if (!supabase) {
      setProductsError(true)
      setProductsLoading(false)
      return
    }

    let mounted = true
    setProductsLoading(true)
    setProductsError(false)
    void supabase.from('products').select('id, name_tk, unit')
      .ilike('name_tk', `%${searchTerm.trim()}%`)
      .order('name_tk')
      .then(({ data, error: requestError }) => {
        if (!mounted) return
        setProducts(data ?? [])
        setProductsError(Boolean(requestError))
        setProductsLoading(false)
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
      ) : productsLoading ? <PageSkeleton /> : productsError ? (
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
    </section>
  )
}
