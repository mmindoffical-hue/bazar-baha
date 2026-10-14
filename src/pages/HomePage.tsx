import { useEffect, useState } from 'react'
import { ChevronRight } from 'lucide-react'
import { tk } from '../i18n/tk'
import { supabase } from '../lib/supabase'
import type { Category, Product } from '../lib/types'
import { PageSkeleton } from '../components/PageSkeleton'
import { OfflineDataNotice } from '../components/OfflineDataNotice'
import { cacheProducts, readPublicCache, withRequestTimeout, writePublicCache } from '../lib/publicCache'

const categoriesCacheKey = 'categories'

export function HomePage({ active, visible, selectedCategory, onSelectCategory, onSelectProduct }: {
  active: boolean
  visible: boolean
  selectedCategory: Category | null
  onSelectCategory: (category: Category) => void
  onSelectProduct: (product: Product) => void
}) {
  const [categories, setCategories] = useState<Category[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [categoriesLoading, setCategoriesLoading] = useState(true)
  const [productsLoading, setProductsLoading] = useState(false)
  const [categoriesError, setCategoriesError] = useState(false)
  const [productsError, setProductsError] = useState(false)
  const [categoriesFetchedAt, setCategoriesFetchedAt] = useState<number | null>(null)
  const [productsFetchedAt, setProductsFetchedAt] = useState<number | null>(null)

  useEffect(() => {
    const cached = readPublicCache<Category[]>(categoriesCacheKey)
    if (cached) {
      setCategories(cached.data)
      setCategoriesFetchedAt(cached.fetchedAt)
      setCategoriesLoading(false)
      setCategoriesError(false)
    } else {
      setCategoriesLoading(true)
    }
    if (!supabase) {
      setCategoriesError(!cached)
      setCategoriesLoading(false)
      return
    }

    const client = supabase
    let mounted = true
    void withRequestTimeout(async () => {
      const { data, error: requestError } = await client
        .from('categories')
        .select('id, name_tk')
        .order('name_tk')
      if (requestError) throw requestError
      return data ?? []
    }).then((data) => {
        if (!mounted) return
        writePublicCache(categoriesCacheKey, data)
        setCategories(data)
        setCategoriesFetchedAt(null)
        setCategoriesError(false)
        setCategoriesLoading(false)
      }).catch(() => {
        if (!mounted) return
        setCategoriesError(!cached)
        setCategoriesLoading(false)
      })

    return () => { mounted = false }
  }, [])

  useEffect(() => {
    if (!active || !selectedCategory) {
      setProducts([])
      setProductsError(false)
      setProductsLoading(false)
      setProductsFetchedAt(null)
      return
    }
    const cacheKey = `products:category:${selectedCategory.id}`
    const cached = readPublicCache<Product[]>(cacheKey)
    if (cached) {
      setProducts(cached.data)
      setProductsFetchedAt(cached.fetchedAt)
      setProductsLoading(false)
      setProductsError(false)
    } else {
      setProductsLoading(true)
    }
    if (!supabase) {
      setProductsError(!cached)
      setProductsLoading(false)
      return
    }

    const client = supabase
    let mounted = true
    setProductsError(false)
    void withRequestTimeout(async () => {
      const { data, error: requestError } = await client
        .from('products')
        .select('id, name_tk, unit')
        .eq('category_id', selectedCategory.id)
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
      }).catch(() => {
        if (!mounted) return
        setProductsError(!cached)
        setProductsLoading(false)
      })

    return () => { mounted = false }
  }, [active, selectedCategory])

  return (
    <section hidden={!visible} className="mt-6">
      {selectedCategory ? (
        <>
        <OfflineDataNotice fetchedAt={productsFetchedAt} />
        {productsLoading && products.length === 0 ? <PageSkeleton /> : productsError ? (
          <p role="alert" className="mt-8 text-sm text-red-700">{tk.buyer.loadError}</p>
        ) : products.length === 0 ? (
          <p className="mt-8 text-center text-sm text-stone-500">{tk.buyer.empty}</p>
        ) : (
          <div className="divide-y divide-stone-200">
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
        )
        }
        </>
      ) : categoriesLoading ? <PageSkeleton rows={6} /> : categoriesError ? (
        <p role="alert" className="mt-8 text-sm text-red-700">{tk.buyer.loadError}</p>
      ) : categories.length === 0 ? (
        <p className="mt-8 text-center text-sm text-stone-500">{tk.buyer.empty}</p>
      ) : (
        <>
          <OfflineDataNotice fetchedAt={categoriesFetchedAt} />
          <h2 className="mb-2 text-sm font-semibold text-stone-500">{tk.buyer.categories}</h2>
          <div className="divide-y divide-stone-200">
            {categories.map((category) => (
              <button
                key={category.id}
                type="button"
                onClick={() => onSelectCategory(category)}
                className="flex min-h-16 w-full items-center justify-between gap-3 py-3 text-left font-semibold text-stone-800"
              >
                {category.name_tk}<ChevronRight aria-hidden="true" size={19} className="text-stone-500" />
              </button>
            ))}
          </div>
        </>
      )}
    </section>
  )
}
