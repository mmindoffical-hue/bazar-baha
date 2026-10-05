import { useEffect, useRef, useState, type FormEvent } from 'react'
import { tk } from '../i18n/tk'
import { isValidPrice, normalizePrice } from '../lib/formatting'
import type { Category, StorePrice, StoreProduct } from '../lib/types'
import { supabase } from '../lib/supabase'
import { compressProductPhoto, removeProductPhotos, thumbnailPathFor } from '../lib/productPhotos'

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
  const [selectedPhotos, setSelectedPhotos] = useState<File[]>([])
  const [photoBusyId, setPhotoBusyId] = useState('')
  const savingRef = useRef(false)
  const photoActionRef = useRef(false)

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
      supabase.from('prices').select('id, product_id, price, in_stock, photo_paths, updated_at')
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
    setSelectedPhotos([])
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
    if (savingRef.current) return
    setError('')
    setNotice('')
    const normalizedPrice = normalizePrice(priceValue)
    if (!isValidPrice(normalizedPrice)) {
      setError(tk.storePrices.invalidPrice)
      return
    }
    if (!editingId && selectedPhotos.length === 0) {
      setError(tk.storePrices.photoRequired)
      return
    }
    if (!supabase || !productId) {
      setError(tk.storePrices.saveError)
      return
    }

    savingRef.current = true
    setSaving(true)
    const uploadedPaths: string[] = []
    let saved = false
    let uploadingPhotos = false
    try {
      const { data: existingPrice, error: lookupError } = await supabase
        .from('prices')
        .select('id, photo_paths')
        .eq('store_id', storeId)
        .eq('product_id', productId)
        .maybeSingle()
      if (lookupError) throw lookupError

      if (existingPrice) {
        const currentPaths = existingPrice.photo_paths ?? []
        if (currentPaths.length + selectedPhotos.length > 2) throw new Error('Too many product photos')
        const result = await supabase.from('prices').update({ price: Number(normalizedPrice), in_stock: inStock }).eq('id', existingPrice.id)
        if (result.error) throw result.error
        uploadingPhotos = selectedPhotos.length > 0
        for (const [index, file] of selectedPhotos.entries()) {
          uploadedPaths.push(await uploadPhoto(file, productId, currentPaths.length + index + 1))
        }
        uploadingPhotos = false
        if (uploadedPaths.length) {
          const { error: photoUpdateError } = await supabase.from('prices')
            .update({ photo_paths: [...currentPaths, ...uploadedPaths] }).eq('id', existingPrice.id)
          if (photoUpdateError) throw photoUpdateError
        }
      } else {
        uploadingPhotos = true
        for (const [index, file] of selectedPhotos.entries()) {
          uploadedPaths.push(await uploadPhoto(file, productId, index + 1))
        }
        uploadingPhotos = false
        const result = await supabase.from('prices').insert({
          store_id: storeId,
          product_id: productId,
          price: Number(normalizedPrice),
          in_stock: inStock,
          photo_paths: uploadedPaths,
        })
        if (result.error) throw result.error
      }

      saved = true
      setNotice(tk.storePrices.saved)
      resetForm()
      await loadData()
    } catch {
      if (!saved) await removeProductPhotos(uploadedPaths)
      setError(uploadingPhotos ? tk.storePrices.photoUploadError : tk.storePrices.saveError)
    } finally {
      savingRef.current = false
      setSaving(false)
    }
  }

  const uploadPhoto = async (file: File, productId: string, index: number): Promise<string> => {
    if (!supabase) throw new Error('Supabase is unavailable')
    const compressed = await compressProductPhoto(file)
    const path = `${storeId}/${productId}-${Date.now()}-${index}.jpg`
    const { error: fullError } = await supabase.storage.from('product-photos').upload(path, compressed.full, {
      contentType: 'image/jpeg',
      upsert: false,
    })
    if (fullError) throw fullError
    const { error: thumbnailError } = await supabase.storage.from('product-photos').upload(
      thumbnailPathFor(path), compressed.thumbnail, { contentType: 'image/jpeg', upsert: false },
    )
    if (thumbnailError) {
      await removeProductPhotos([path])
      throw thumbnailError
    }
    return path
  }

  const addPhoto = async (price: StorePrice, file: File) => {
    if (!supabase || photoActionRef.current) return
    const currentPaths = price.photo_paths ?? []
    if (currentPaths.length >= 2) return
    photoActionRef.current = true
    setPhotoBusyId(price.id)
    setError('')
    let uploadedPath = ''
    try {
      uploadedPath = await uploadPhoto(file, price.product_id, currentPaths.length + 1)
      const nextPaths = [...currentPaths, uploadedPath]
      const { error: updateError } = await supabase.from('prices')
        .update({ photo_paths: nextPaths }).eq('id', price.id)
      if (updateError) throw updateError
      setPrices((current) => current.map((item) => item.id === price.id ? { ...item, photo_paths: nextPaths } : item))
    } catch {
      if (uploadedPath) await removeProductPhotos([uploadedPath])
      setError(tk.storePrices.photoUploadError)
    } finally {
      photoActionRef.current = false
      setPhotoBusyId('')
    }
  }

  const deletePhoto = async (price: StorePrice, photoIndex: number) => {
    if (!supabase || photoActionRef.current) return
    const currentPaths = price.photo_paths ?? []
    if (currentPaths.length <= 1) return
    photoActionRef.current = true
    setPhotoBusyId(price.id)
    setError('')
    const nextPaths = currentPaths.filter((_, index) => index !== photoIndex)
    try {
      const { error: updateError } = await supabase.from('prices')
        .update({ photo_paths: nextPaths }).eq('id', price.id)
      if (updateError) throw updateError
      setPrices((current) => current.map((item) => item.id === price.id ? { ...item, photo_paths: nextPaths } : item))
      await removeProductPhotos([currentPaths[photoIndex]])
    } catch {
      setError(tk.storePrices.photoDeleteError)
    } finally {
      photoActionRef.current = false
      setPhotoBusyId('')
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
    await removeProductPhotos(price.photo_paths ?? [])
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
                        <div className="mt-3 flex flex-wrap items-start gap-2">
                          {(price.photo_paths ?? []).map((path, index) => {
                            const thumbnail = supabase?.storage.from('product-photos').getPublicUrl(thumbnailPathFor(path)).data.publicUrl
                            return (
                              <div key={path} className="relative h-14 w-14 overflow-hidden rounded bg-stone-200">
                                {thumbnail && <img src={thumbnail} alt={tk.storePrices.productPhoto} className="h-full w-full object-cover" />}
                                <button
                                  type="button"
                                  disabled={(price.photo_paths ?? []).length <= 1 || photoBusyId !== ''}
                                  onClick={() => void deletePhoto(price, index)}
                                  aria-label={tk.storePrices.deletePhoto}
                                  className="absolute inset-x-0 bottom-0 bg-black/65 py-1 text-[10px] font-semibold text-white disabled:opacity-45"
                                >
                                  {tk.storePrices.deletePhoto}
                                </button>
                              </div>
                            )
                          })}
                          {(price.photo_paths ?? []).length < 2 && (
                            <label className="flex min-h-14 cursor-pointer items-center rounded border border-dashed border-stone-400 px-2 text-xs font-semibold text-emerald-900">
                              {photoBusyId === price.id ? tk.storePrices.uploadingPhoto : tk.storePrices.addPhoto}
                              <input
                                type="file"
                                accept="image/*"
                                capture="environment"
                                disabled={photoBusyId !== '' || saving}
                                onChange={(event) => {
                                  const file = event.currentTarget.files?.[0]
                                  event.currentTarget.value = ''
                                  if (file) void addPhoto(price, file)
                                }}
                                className="sr-only"
                              />
                            </label>
                          )}
                        </div>
                        {photoBusyId === price.id && (
                          <progress aria-label={tk.storePrices.uploadingPhoto} className="mt-2 h-2 w-full" />
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
              {!editingId && (
                <div className="space-y-2 text-sm font-medium text-stone-700">
                  <span className="block">{tk.storePrices.photos} ({selectedPhotos.length}/2)</span>
                  <label className="inline-flex min-h-11 cursor-pointer items-center rounded-md border border-emerald-800 px-3 text-sm font-semibold text-emerald-900">
                    {tk.storePrices.addPhoto}
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      disabled={saving || selectedPhotos.length >= 2}
                      onChange={(event) => {
                        const file = event.currentTarget.files?.[0]
                        event.currentTarget.value = ''
                        if (file) setSelectedPhotos((current) => current.length < 2 ? [...current, file] : current)
                      }}
                      className="sr-only"
                    />
                  </label>
                  {selectedPhotos.map((photo, index) => (
                    <div key={`${photo.name}-${index}`} className="flex items-center justify-between gap-2 text-xs">
                      <span className="min-w-0 truncate">{photo.name}</span>
                      <button type="button" disabled={saving} onClick={() => setSelectedPhotos((current) => current.filter((_, itemIndex) => itemIndex !== index))} className="min-h-8 px-2 text-red-800 disabled:opacity-50">
                        {tk.storePrices.removePhoto}
                      </button>
                    </div>
                  ))}
                </div>
              )}
              {saving && selectedPhotos.length > 0 && <div className="space-y-1"><p className="text-sm text-stone-600">{tk.storePrices.uploadingPhoto}</p><progress aria-label={tk.storePrices.uploadingPhoto} className="h-2 w-full" /></div>}
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
