import { useEffect, useState } from 'react'
import { ChevronRight } from 'lucide-react'
import { tk } from '../i18n/tk'
import { supabase } from '../lib/supabase'
import type { Category, Product } from '../lib/types'
import { PageSkeleton } from '../components/PageSkeleton'

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

  useEffect(() => {
    if (!supabase) {
      setCategoriesError(true)
      setCategoriesLoading(false)
      return
    }

    let mounted = true
    void supabase
      .from('categories')
      .select('id, name_tk')
      .order('name_tk')
      .then(({ data, error: requestError }) => {
        if (!mounted) return
        setCategories(data ?? [])
        setCategoriesError(Boolean(requestError))
        setCategoriesLoading(false)
      })

    return () => { mounted = false }
  }, [])

  useEffect(() => {
    if (!active || !selectedCategory) {
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
      .eq('category_id', selectedCategory.id)
      .order('name_tk')
      .then(({ data, error: requestError }) => {
        if (!mounted) return
        setProducts(data ?? [])
        setProductsError(Boolean(requestError))
        setProductsLoading(false)
      })

    return () => { mounted = false }
  }, [active, selectedCategory])

  return (
    <section hidden={!visible} className="mt-6">
      {selectedCategory ? (
        productsLoading ? <PageSkeleton /> : productsError ? (
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
      ) : categoriesLoading ? <PageSkeleton rows={6} /> : categoriesError ? (
        <p role="alert" className="mt-8 text-sm text-red-700">{tk.buyer.loadError}</p>
      ) : categories.length === 0 ? (
        <p className="mt-8 text-center text-sm text-stone-500">{tk.buyer.empty}</p>
      ) : (
        <>
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
