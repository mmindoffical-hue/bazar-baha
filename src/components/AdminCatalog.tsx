import { useEffect, useState, type FormEvent } from 'react'
import { tk } from '../i18n/tk'
import type { Category, StoreProduct } from '../lib/types'
import { removeProductPhotos } from '../lib/productPhotos'
import { supabase } from '../lib/supabase'

type CatalogCategory = Category & { slug: string }
type CatalogProduct = StoreProduct
type ProductUnit = 'kg' | 'dana' | 'litr' | 'paket'
const productUnits: ProductUnit[] = ['kg', 'dana', 'litr', 'paket']

export function AdminCatalog() {
  const [categories, setCategories] = useState<CatalogCategory[]>([])
  const [products, setProducts] = useState<CatalogProduct[]>([])
  const [categoryFilter, setCategoryFilter] = useState('')
  const [categoryFormId, setCategoryFormId] = useState('')
  const [categorySlug, setCategorySlug] = useState('')
  const [categoryName, setCategoryName] = useState('')
  const [productFormId, setProductFormId] = useState('')
  const [productCategoryId, setProductCategoryId] = useState('')
  const [productName, setProductName] = useState('')
  const [productUnit, setProductUnit] = useState<ProductUnit>('kg')
  const [batchCategoryId, setBatchCategoryId] = useState('')
  const [batchText, setBatchText] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const loadCatalog = async () => {
    if (!supabase) {
      setError(tk.adminCatalog.loadError)
      setLoading(false)
      return
    }
    setLoading(true)
    const [categoryResult, productResult] = await Promise.all([
      supabase.from('categories').select('id, slug, name_tk').order('name_tk'),
      supabase.from('products').select('id, category_id, name_tk, unit').order('name_tk'),
    ])
    if (categoryResult.error || productResult.error) {
      setError(tk.adminCatalog.loadError)
    } else {
      setCategories((categoryResult.data ?? []) as CatalogCategory[])
      setProducts((productResult.data ?? []) as CatalogProduct[])
      setError('')
    }
    setLoading(false)
  }

  useEffect(() => { void loadCatalog() }, [])

  const resetCategoryForm = () => {
    setCategoryFormId('')
    setCategorySlug('')
    setCategoryName('')
  }

  const saveCategory = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!supabase || saving) return
    setError('')
    setNotice('')
    setSaving(true)
    const values = { slug: categorySlug.trim().toLocaleLowerCase('tk-TM'), name_tk: categoryName.trim() }
    const result = categoryFormId
      ? await supabase.from('categories').update(values).eq('id', Number(categoryFormId))
      : await supabase.from('categories').insert(values)
    setSaving(false)
    if (result.error) {
      setError(result.error.code === '23505' ? tk.adminCatalog.duplicateCategory : tk.adminCatalog.saveError)
      return
    }
    resetCategoryForm()
    setNotice(tk.stores.saved)
    await loadCatalog()
  }

  const saveProduct = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!supabase || saving) return
    setError('')
    setNotice('')
    setSaving(true)
    const values = {
      category_id: Number(productCategoryId),
      name_tk: productName.trim(),
      unit: productUnit,
    }
    const result = productFormId
      ? await supabase.from('products').update(values).eq('id', productFormId)
      : await supabase.from('products').insert(values)
    setSaving(false)
    if (result.error) {
      setError(result.error.code === '23505' ? tk.adminCatalog.duplicateProduct : tk.adminCatalog.saveError)
      return
    }
    setProductFormId('')
    setProductCategoryId('')
    setProductName('')
    setProductUnit('kg')
    setNotice(tk.stores.saved)
    await loadCatalog()
  }

  const deleteProduct = async (product: CatalogProduct) => {
    if (!supabase || saving) return
    setError('')
    setNotice('')
    setSaving(true)
    const photoPaths: string[] = []
    let offset = 0
    let priceCount = 0
    while (true) {
      const result = await supabase.from('prices')
        .select('store_id, photo_paths', { count: 'exact' })
        .eq('product_id', product.id)
        .range(offset, offset + 999)
      if (result.error) {
        setSaving(false)
        setError(tk.adminCatalog.deleteError)
        return
      }
      if (offset === 0) priceCount = result.count ?? 0
      for (const price of result.data ?? []) photoPaths.push(...(price.photo_paths ?? []))
      offset += result.data?.length ?? 0
      if ((result.data?.length ?? 0) < 1000) break
    }
    if (!window.confirm(tk.adminCatalog.deleteProductConfirm(priceCount))) {
      setSaving(false)
      return
    }
    const { error: deleteError } = await supabase.from('products').delete().eq('id', product.id)
    if (deleteError) {
      setSaving(false)
      setError(tk.adminCatalog.deleteError)
      return
    }
    await removeProductPhotos([...new Set(photoPaths)])
    setSaving(false)
    if (productFormId === product.id) {
      setProductFormId('')
      setProductCategoryId('')
      setProductName('')
      setProductUnit('kg')
    }
    setNotice(tk.adminCatalog.deleted)
    await loadCatalog()
  }

  const addBatch = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!supabase || saving || !batchCategoryId) return
    setError('')
    setNotice('')
    const parsed: { category_id: number; name_tk: string; unit: ProductUnit }[] = []
    const seen = new Set<string>()
    let alreadyThere = 0
    for (const [index, rawLine] of batchText.split(/\r?\n/).entries()) {
      const line = rawLine.trim()
      if (!line) continue
      const separator = line.indexOf(';')
      const name = (separator < 0 ? line : line.slice(0, separator)).trim()
      const rawUnit = separator < 0 ? '' : line.slice(separator + 1).trim().toLocaleLowerCase('tk-TM')
      const unit = (rawUnit || 'kg') as ProductUnit
      if (!productUnits.includes(unit)) {
        setError(tk.adminCatalog.invalidBatchUnit(index + 1))
        return
      }
      if (!name) continue
      if (seen.has(name)) {
        alreadyThere += 1
        continue
      }
      seen.add(name)
      parsed.push({ category_id: Number(batchCategoryId), name_tk: name, unit })
    }
    if (!parsed.length) {
      setNotice(tk.adminCatalog.batchSummary(0, alreadyThere))
      return
    }
    setSaving(true)
    const existingResult = await supabase.from('products').select('name_tk').eq('category_id', Number(batchCategoryId))
    if (existingResult.error) {
      setSaving(false)
      setError(tk.adminCatalog.batchError)
      return
    }
    const existingNames = new Set((existingResult.data ?? []).map((item) => item.name_tk))
    const pending = parsed.filter((item) => {
      if (existingNames.has(item.name_tk)) {
        alreadyThere += 1
        return false
      }
      return true
    })
    let added = 0
    for (let offset = 0; offset < pending.length; offset += 50) {
      const group = pending.slice(offset, offset + 50)
      const { error: insertError } = await supabase.from('products').insert(group)
      if (!insertError) {
        added += group.length
        continue
      }
      if (insertError.code !== '23505') {
        setSaving(false)
        setError(tk.adminCatalog.batchError)
        setNotice(tk.adminCatalog.batchSummary(added, alreadyThere))
        await loadCatalog()
        return
      }
      for (const item of group) {
        const { error: itemError } = await supabase.from('products').insert(item)
        if (!itemError) added += 1
        else if (itemError.code === '23505') alreadyThere += 1
        else {
          setSaving(false)
          setError(tk.adminCatalog.batchError)
          setNotice(tk.adminCatalog.batchSummary(added, alreadyThere))
          await loadCatalog()
          return
        }
      }
    }
    setSaving(false)
    setBatchText('')
    setNotice(tk.adminCatalog.batchSummary(added, alreadyThere))
    await loadCatalog()
  }

  const visibleProducts = products.filter((product) => !categoryFilter || String(product.category_id) === categoryFilter)

  return (
    <section className="space-y-6" aria-label={tk.adminCatalog.title}>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      {notice && <p role="status" className="text-sm text-emerald-800">{notice}</p>}
      {loading ? <p className="text-sm text-stone-500">{tk.stores.loading}</p> : <>
        <section className="space-y-4">
          <h3 className="font-semibold text-stone-900">{tk.adminCatalog.categories}</h3>
          <form onSubmit={(event) => void saveCategory(event)} className="grid gap-3 sm:grid-cols-2">
            <label className="block space-y-1 text-sm font-medium text-stone-700">
              <span>{tk.adminCatalog.slug}</span>
              <input required value={categorySlug} onChange={(event) => setCategorySlug(event.target.value.replace(/\s+/g, '-').toLocaleLowerCase('tk-TM'))} className="min-h-11 w-full rounded-md border border-stone-300 bg-white px-3 text-base text-stone-900" />
            </label>
            <label className="block space-y-1 text-sm font-medium text-stone-700">
              <span>{tk.adminCatalog.categoryName}</span>
              <input required value={categoryName} onChange={(event) => setCategoryName(event.target.value)} className="min-h-11 w-full rounded-md border border-stone-300 bg-white px-3 text-base text-stone-900" />
            </label>
            <div className="flex gap-2 sm:col-span-2">
              <button type="submit" disabled={saving} className="min-h-11 rounded-md bg-emerald-800 px-4 text-sm font-semibold text-white disabled:opacity-60">{categoryFormId ? tk.adminCatalog.save : tk.adminCatalog.addCategory}</button>
              {categoryFormId && <button type="button" onClick={resetCategoryForm} className="min-h-11 px-3 text-sm font-semibold text-stone-700">{tk.adminCatalog.cancel}</button>}
            </div>
          </form>
          {categories.length === 0 ? <p className="text-sm text-stone-500">{tk.adminCatalog.emptyCategories}</p> : (
            <ul className="divide-y divide-stone-200">
              {categories.map((category) => <li key={category.id} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0"><p className="font-medium text-stone-900">{category.name_tk}</p><p className="text-sm text-stone-500">{category.slug}</p></div>
                <button type="button" onClick={() => { setCategoryFormId(String(category.id)); setCategorySlug(category.slug); setCategoryName(category.name_tk) }} className="min-h-10 shrink-0 px-3 text-sm font-semibold text-emerald-900">{tk.adminCatalog.edit}</button>
              </li>)}
            </ul>
          )}
        </section>

        <section className="space-y-4 border-t border-stone-200 pt-5">
          <h3 className="font-semibold text-stone-900">{tk.adminCatalog.products}</h3>
          <form onSubmit={(event) => void saveProduct(event)} className="space-y-3">
            <label className="block space-y-1 text-sm font-medium text-stone-700">
              <span>{tk.adminCatalog.category}</span>
              <select required value={productCategoryId} onChange={(event) => setProductCategoryId(event.target.value)} className="min-h-11 w-full rounded-md border border-stone-300 bg-white px-3 text-base text-stone-900">
                <option value="">{tk.adminCatalog.chooseCategory}</option>
                {categories.map((category) => <option key={category.id} value={category.id}>{category.name_tk}</option>)}
              </select>
            </label>
            <label className="block space-y-1 text-sm font-medium text-stone-700">
              <span>{tk.adminCatalog.productName}</span>
              <input required value={productName} onChange={(event) => setProductName(event.target.value)} className="min-h-11 w-full rounded-md border border-stone-300 bg-white px-3 text-base text-stone-900" />
            </label>
            <label className="block space-y-1 text-sm font-medium text-stone-700">
              <span>{tk.adminCatalog.unit}</span>
              <select value={productUnit} onChange={(event) => setProductUnit(event.target.value as ProductUnit)} className="min-h-11 w-full rounded-md border border-stone-300 bg-white px-3 text-base text-stone-900">
                {productUnits.map((unit) => <option key={unit} value={unit}>{tk.adminCatalog.units[unit]}</option>)}
              </select>
            </label>
            <div className="flex gap-2">
              <button type="submit" disabled={saving || categories.length === 0} className="min-h-11 rounded-md bg-emerald-800 px-4 text-sm font-semibold text-white disabled:opacity-60">{productFormId ? tk.adminCatalog.save : tk.adminCatalog.addProduct}</button>
              {productFormId && <button type="button" onClick={() => { setProductFormId(''); setProductCategoryId(''); setProductName(''); setProductUnit('kg') }} className="min-h-11 px-3 text-sm font-semibold text-stone-700">{tk.adminCatalog.cancel}</button>}
            </div>
          </form>

          <label className="block space-y-1 text-sm font-medium text-stone-700">
            <span>{tk.adminCatalog.category}</span>
            <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)} className="min-h-11 w-full rounded-md border border-stone-300 bg-white px-3 text-base text-stone-900">
              <option value="">{tk.adminCatalog.allCategories}</option>
              {categories.map((category) => <option key={category.id} value={category.id}>{category.name_tk}</option>)}
            </select>
          </label>
          {visibleProducts.length === 0 ? <p className="text-sm text-stone-500">{tk.adminCatalog.emptyProducts}</p> : (
            <ul className="divide-y divide-stone-200">
              {visibleProducts.map((product) => <li key={product.id} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0"><p className="wrap-break-word font-medium text-stone-900">{product.name_tk}</p><p className="text-sm text-stone-500">{categories.find((category) => category.id === product.category_id)?.name_tk} · {tk.adminCatalog.units[product.unit as ProductUnit] ?? product.unit}</p></div>
                <div className="flex shrink-0 gap-1">
                  <button type="button" onClick={() => { setProductFormId(product.id); setProductCategoryId(String(product.category_id)); setProductName(product.name_tk); setProductUnit(product.unit as ProductUnit) }} className="min-h-10 px-2 text-sm font-semibold text-emerald-900">{tk.adminCatalog.edit}</button>
                  <button type="button" disabled={saving} onClick={() => void deleteProduct(product)} className="min-h-10 px-2 text-sm font-semibold text-red-800 disabled:opacity-60">{tk.adminCatalog.deleteProduct}</button>
                </div>
              </li>)}
            </ul>
          )}
        </section>

        <form onSubmit={(event) => void addBatch(event)} className="space-y-3 border-t border-stone-200 pt-5">
          <h3 className="font-semibold text-stone-900">{tk.adminCatalog.batchTitle}</h3>
          <label className="block space-y-1 text-sm font-medium text-stone-700">
            <span>{tk.adminCatalog.category}</span>
            <select required value={batchCategoryId} onChange={(event) => setBatchCategoryId(event.target.value)} className="min-h-11 w-full rounded-md border border-stone-300 bg-white px-3 text-base text-stone-900">
              <option value="">{tk.adminCatalog.chooseCategory}</option>
              {categories.map((category) => <option key={category.id} value={category.id}>{category.name_tk}</option>)}
            </select>
          </label>
          <label className="block space-y-1 text-sm font-medium text-stone-700">
            <span>{tk.adminCatalog.batchPlaceholder}</span>
            <textarea rows={5} value={batchText} onChange={(event) => setBatchText(event.target.value)} className="w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-base text-stone-900" />
          </label>
          <button type="submit" disabled={saving || !batchCategoryId} className="min-h-11 rounded-md bg-emerald-800 px-4 text-sm font-semibold text-white disabled:opacity-60">{tk.adminCatalog.batchSubmit}</button>
        </form>
      </>}
    </section>
  )
}