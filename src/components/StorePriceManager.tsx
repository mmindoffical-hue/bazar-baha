import { useEffect, useState, type FormEvent } from 'react'
import { tk } from '../i18n/tk'
import { isValidPrice, normalizePrice } from '../lib/formatting'
import type { Category, StorePrice, StoreProduct } from '../lib/types'
import { supabase } from '../lib/supabase'
import { StoreVideoCapture } from './StoreVideoCapture'

export function StorePriceManager({ storeId }: { storeId: string }) {
  const [categories, setCategories] = useState<Category[]>([])
  const [products, setProducts] = useState<StoreProduct[]>([])
  const [prices, setPrices] = useState<StorePrice[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [editingId, setEditingId] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [productId, setProductId] = useState('')
  const [priceValue, setPriceValue] = useState('')
  const [inStock, setInStock] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [videoPriceId, setVideoPriceId] = useState('')

  const loadData = async () => {
    if (!supabase) {
      setError(tk.storePrices.loadError)
      setLoading(false)
      return
    }
    setLoading(true)
    const [categoryResult, productResult, priceResult] = await Promise.all([
      supabase.from('categories').select('id, name_tk').order('name_tk'),
      supabase.from('products').select('id, category_id, name_tk, unit').order('name_tk'),
      supabase.from('prices').select('id, product_id, price, in_stock, video_path, updated_at')
        .eq('store_id', storeId).order('updated_at', { ascending: false }),
    ])
    if (categoryResult.error || productResult.error || priceResult.error) {
      setError(tk.storePrices.loadError)
    } else {
      setCategories(categoryResult.data ?? [])
      setProducts((productResult.data ?? []) as StoreProduct[])
      setPrices((priceResult.data ?? []) as StorePrice[])
      setError('')
    }
    setLoading(false)
  }

  useEffect(() => {
    void loadData()
  }, [storeId])

  const resetForm = () => {
    setFormOpen(false)
    setEditingId('')
    setCategoryId('')
    setProductId('')
    setPriceValue('')
    setInStock(true)
    setError('')
  }

  const editPrice = (price: StorePrice) => {
    const product = products.find((item) => item.id === price.product_id)
    setEditingId(price.id)
    setCategoryId(product ? String(product.category_id) : '')
    setProductId(price.product_id)
    setPriceValue(String(price.price))
    setInStock(price.in_stock)
    setError('')
    setNotice('')
    setFormOpen(true)
  }

  const savePrice = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    setNotice('')
    const normalizedPrice = normalizePrice(priceValue)
    if (!isValidPrice(normalizedPrice)) {
      setError(tk.storePrices.invalidPrice)
      return
    }
    if (!supabase || !productId) {
      setError(tk.storePrices.saveError)
      return
    }

    setSaving(true)
    try {
      const { data: existingPrice, error: lookupError } = await supabase
        .from('prices')
        .select('id')
        .eq('store_id', storeId)
        .eq('product_id', productId)
        .maybeSingle()
      if (lookupError) throw lookupError

      const result = existingPrice
        ? await supabase.from('prices').update({ price: Number(normalizedPrice), in_stock: inStock }).eq('id', existingPrice.id)
        : await supabase.from('prices').insert({
          store_id: storeId,
          product_id: productId,
          price: Number(normalizedPrice),
          in_stock: inStock,
        })
      if (result.error) throw result.error

      setNotice(tk.storePrices.saved)
      resetForm()
      await loadData()
    } catch {
      setError(tk.storePrices.saveError)
    } finally {
      setSaving(false)
    }
  }

  const deletePrice = async (price: StorePrice) => {
    if (!window.confirm(tk.storePrices.deleteConfirm) || !supabase) return
    setError('')
    setNotice('')
    setDeletingId(price.id)
    const { error: deleteError } = await supabase.from('prices').delete().eq('id', price.id)
    setDeletingId('')
    if (deleteError) {
      setError(tk.storePrices.deleteError)
      return
    }
    if (price.video_path) {
      const { error: videoDeleteError } = await supabase.storage.from('store-videos').remove([price.video_path])
      if (videoDeleteError) console.warn('Deleted product video could not be removed.', videoDeleteError)
    }
    setPrices((current) => current.filter((item) => item.id !== price.id))
    setNotice(tk.storePrices.deleted)
    if (editingId === price.id) resetForm()
  }

  const visibleProducts = products.filter((product) => !categoryId || String(product.category_id) === categoryId)

  return (
    <section className="space-y-4 border-t border-stone-200 pt-5">
      <h3 className="text-lg font-semibold text-stone-900">{tk.storePrices.title}</h3>
      {loading ? <p className="text-sm text-stone-500">{tk.storePrices.loading}</p> : (
        <>
          {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
          {prices.length === 0 ? <p className="text-sm text-stone-500">{tk.storePrices.empty}</p> : (
            <div className="divide-y divide-stone-200">
              {prices.map((price) => {
                const product = products.find((item) => item.id === price.product_id)
                return (
                  <article key={price.id} className="py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h4 className="wrap-break-word font-semibold text-stone-900">{product?.name_tk ?? price.product_id}</h4>
                        <p className="mt-1 text-sm text-stone-700">
                          {Number(price.price).toFixed(2)} {tk.buyer.currency} / {product?.unit ?? ''}
                        </p>
                        <p className="mt-1 text-sm text-stone-600">
                          {price.in_stock ? tk.storePrices.inStock : tk.storePrices.outOfStock}
                        </p>
                        <p className="mt-1 text-xs text-stone-500">
                          {tk.buyer.updated}: {new Date(price.updated_at).toLocaleString('tk-TM')}
                        </p>
                        <button
                          type="button"
                          onClick={() => setVideoPriceId((current) => current === price.id ? '' : price.id)}
                          className="mt-2 min-h-10 rounded-md border border-emerald-800 px-3 text-sm font-semibold text-emerald-900"
                        >
                          {tk.storePrices.recordVideo}
                        </button>
                        {videoPriceId === price.id && (
                          <StoreVideoCapture
                            storeId={storeId}
                            productId={price.product_id}
                            currentVideoPath={price.video_path}
                            onUploaded={(videoPath) => setPrices((current) => current.map((item) => (
                              item.id === price.id ? { ...item, video_path: videoPath } : item
                            )))}
                            onClose={() => setVideoPriceId('')}
                          />
                        )}
                      </div>
                      <div className="flex shrink-0 gap-2">
                        <button type="button" onClick={() => editPrice(price)} className="min-h-9 rounded-md border border-stone-300 px-2 text-xs font-semibold text-emerald-900">
                          {tk.storePrices.refresh}
                        </button>
                        <button type="button" disabled={deletingId === price.id} onClick={() => void deletePrice(price)} className="min-h-9 rounded-md border border-stone-300 px-2 text-xs font-semibold text-stone-700 disabled:opacity-60">
                          {tk.storePrices.delete}
                        </button>
                      </div>
                    </div>
                  </article>
                )
              })}
            </div>
          )}
          {notice && <p role="status" className="text-sm text-emerald-800">{notice}</p>}
          <button
            type="button"
            onClick={() => {
              if (formOpen && !editingId) resetForm()
              else {
                resetForm()
                setFormOpen(true)
              }
            }}
            className="min-h-11 rounded-md bg-emerald-800 px-4 text-sm font-semibold text-white disabled:opacity-60"
          >
            {tk.storePrices.add}
          </button>
          {formOpen && (
            <form onSubmit={(event) => void savePrice(event)} className="space-y-4 border-l-2 border-emerald-800 pl-4">
              <label className="block space-y-2 text-sm font-medium text-stone-700">
                <span>{tk.storePrices.category}</span>
                <select value={categoryId} disabled={Boolean(editingId)} onChange={(event) => {
                  setCategoryId(event.target.value)
                  setProductId('')
                }} className="min-h-11 w-full rounded-md border border-stone-300 bg-white px-3 text-base text-stone-900">
                  <option value="">{tk.storePrices.allCategories}</option>
                  {categories.map((category) => <option key={category.id} value={category.id}>{category.name_tk}</option>)}
                </select>
              </label>
              <label className="block space-y-2 text-sm font-medium text-stone-700">
                <span>{tk.storePrices.product}</span>
                <select required value={productId} disabled={Boolean(editingId)} onChange={(event) => setProductId(event.target.value)} className="min-h-11 w-full rounded-md border border-stone-300 bg-white px-3 text-base text-stone-900">
                  <option value="">{tk.storePrices.selectProduct}</option>
                  {visibleProducts.map((product) => {
                    const added = prices.some((price) => price.product_id === product.id)
                    return <option key={product.id} value={product.id} disabled={added}>{product.name_tk} · {product.unit}{added ? ` (${tk.storePrices.added})` : ''}</option>
                  })}
                </select>
              </label>
              <label className="block space-y-2 text-sm font-medium text-stone-700">
                <span>{tk.storePrices.price}</span>
                <input inputMode="decimal" required value={priceValue} onChange={(event) => setPriceValue(event.target.value)} className="min-h-11 w-full rounded-md border border-stone-300 bg-white px-3 text-base text-stone-900" />
              </label>
              <label className="block space-y-2 text-sm font-medium text-stone-700">
                <span>{tk.storePrices.stock}</span>
                <select value={inStock ? 'yes' : 'no'} onChange={(event) => setInStock(event.target.value === 'yes')} className="min-h-11 w-full rounded-md border border-stone-300 bg-white px-3 text-base text-stone-900">
                  <option value="yes">{tk.storePrices.inStock}</option>
                  <option value="no">{tk.storePrices.outOfStock}</option>
                </select>
              </label>
              {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
              <div className="flex gap-3">
                <button type="submit" disabled={saving} className="min-h-11 rounded-md bg-emerald-800 px-4 text-sm font-semibold text-white disabled:cursor-wait disabled:opacity-60">
                  {saving ? tk.storePrices.saving : tk.storePrices.save}
                </button>
                <button type="button" disabled={saving} onClick={resetForm} className="min-h-11 px-3 text-sm font-semibold text-stone-700 disabled:opacity-60">
                  {tk.storePrices.cancel}
                </button>
              </div>
            </form>
          )}
        </>
      )}
    </section>
  )
}
