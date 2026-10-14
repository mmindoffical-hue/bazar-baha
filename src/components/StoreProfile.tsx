import { lazy, Suspense, useEffect, useState, type FormEvent } from 'react'
import { MapPin } from 'lucide-react'
import { tk } from '../i18n/tk'
import { prepareStoreLogo, prepareStorePhoto } from '../lib/formatting'
import { AdminCatalog } from './AdminCatalog'
import type { StoreFields, StorePrice, StoreRecord, StoreStatus } from '../lib/types'
import { supabase } from '../lib/supabase'
import { StorePriceManager } from './StorePriceManager'

const StoreLocationPicker = lazy(() => import('./StoreLocationPicker'))

const emptyStoreFields: StoreFields = {
  name: '',
  phone: '',
  city: '',
  address: '',
  lat: null,
  lng: null,
}

function StoreApplicationForm({ store, photoUrls, fields, onFieldChange, photo, onPhotoChange, logo, onLogoChange, onLocationChange, onLocate, locating, visible, error, notice, onSubmit, saving }: {
  store: StoreRecord | null
  photoUrls: Record<string, string>
  fields: StoreFields
  onFieldChange: (key: keyof StoreFields, value: string | number | null) => void
  photo: File | null
  onPhotoChange: (photo: File | null) => void
  logo: File | null
  onLogoChange: (logo: File | null) => void
  onLocationChange: (lat: number, lng: number) => void
  onLocate: () => void
  locating: boolean
  visible: boolean
  error: string
  notice: string
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
  saving: boolean
}) {
  const textInput = (key: 'name' | 'phone' | 'city' | 'address', label: string, required = false) => (
    <label className="block space-y-2 text-sm font-medium text-stone-700">
      <span>{label}</span>
      <input
        required={required}
        value={fields[key]}
        onChange={(event) => onFieldChange(key, event.target.value)}
        className="min-h-12 w-full rounded-md border border-stone-300 bg-white px-3 text-base text-stone-900 outline-none focus:border-emerald-800 focus:ring-2 focus:ring-emerald-800/15"
      />
    </label>
  )

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-200 pb-3">
        <h2 className="text-lg font-semibold text-stone-900">{store ? store.name : tk.stores.applyTitle}</h2>
        {store && <span className="text-sm font-semibold text-emerald-900">{tk.stores.statuses[store.status]}</span>}
      </div>
      <form onSubmit={onSubmit} className="space-y-4">
        {textInput('name', tk.stores.name, true)}
        {textInput('phone', tk.stores.phone, true)}
        {textInput('city', tk.stores.city)}
        {textInput('address', tk.stores.address, true)}
        <div className="space-y-2">
          <p className="text-sm font-medium text-stone-700">{tk.stores.photo}</p>
          {store && photoUrls[store.id] && !photo && (
            <img src={photoUrls[store.id]} alt={tk.stores.photo} className="h-40 w-full rounded-md object-cover" />
          )}
          {photo && <p className="text-sm text-stone-500">{photo.name}</p>}
          <div className="grid grid-cols-2 gap-2">
            <label className="flex min-h-11 cursor-pointer items-center justify-center rounded-md border border-stone-300 px-3 text-center text-sm font-semibold text-stone-800">
              {tk.stores.camera}
              <input type="file" accept="image/*" capture="environment" className="sr-only" onChange={(event) => onPhotoChange(event.target.files?.[0] ?? null)} />
            </label>
            <label className="flex min-h-11 cursor-pointer items-center justify-center rounded-md border border-stone-300 px-3 text-center text-sm font-semibold text-stone-800">
              {tk.stores.gallery}
              <input type="file" accept="image/*" className="sr-only" onChange={(event) => onPhotoChange(event.target.files?.[0] ?? null)} />
            </label>
          </div>
        </div>
        <div className="space-y-2">
          <p className="text-sm font-medium text-stone-700">{tk.stores.logo}</p>
          {store?.logo_path && supabase && !logo && (
            <img
              src={supabase.storage.from('store-logos').getPublicUrl(store.logo_path).data.publicUrl}
              alt={tk.stores.logoPreview}
              loading="lazy"
              className="h-16 w-16 rounded-full border border-white object-cover shadow-sm"
            />
          )}
          {logo && <p className="text-sm text-stone-500">{tk.stores.logoSelected}: {logo.name}</p>}
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            aria-label={tk.stores.logo}
            onChange={(event) => onLogoChange(event.target.files?.[0] ?? null)}
            className="block w-full text-sm text-stone-700 file:mr-3 file:min-h-11 file:rounded-md file:border-0 file:bg-stone-100 file:px-3 file:font-semibold"
          />
        </div>
        {store && (store.lat === null || store.lng === null) && (
          <p role="status" className="rounded-md bg-amber-50 p-3 text-sm text-amber-900">{tk.stores.locationMissingWarning}</p>
        )}
        <button
          type="button"
          onClick={onLocate}
          disabled={locating}
          className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-emerald-900 disabled:opacity-60"
        >
          <MapPin aria-hidden="true" size={18} />
          {locating ? tk.stores.locationLoading : tk.stores.location}
        </button>
        {visible && (
          <Suspense fallback={<p className="text-sm text-stone-500">{tk.buyer.mapLoading}</p>}>
            <StoreLocationPicker lat={fields.lat} lng={fields.lng} onChange={onLocationChange} />
          </Suspense>
        )}
        {fields.lat !== null && fields.lng !== null && (
          <p className="text-xs text-stone-500">{fields.lat.toFixed(5)}, {fields.lng.toFixed(5)}</p>
        )}
        {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
        {notice && <p role="status" className="text-sm text-emerald-800">{notice}</p>}
        <button
          type="submit"
          disabled={saving}
          className="min-h-12 w-full rounded-md bg-emerald-800 px-4 font-semibold text-white transition-colors hover:bg-emerald-900 disabled:cursor-wait disabled:opacity-60"
        >
          {saving ? tk.stores.saving : store ? tk.stores.save : tk.stores.submit}
        </button>
      </form>
    </section>
  )
}

function AdminPanel({ stores, photoUrls, busyStoreId, error, notice, onChangeStatus }: {
  stores: StoreRecord[]
  photoUrls: Record<string, string>
  busyStoreId: string
  error: string
  notice: string
  onChangeStatus: (storeId: string, status: StoreStatus) => void
}) {
  const [activeTab, setActiveTab] = useState<'stores' | 'catalog'>('stores')
  const [serialSearch, setSerialSearch] = useState('')
  const [serialResult, setSerialResult] = useState<Pick<StoreRecord, 'id' | 'name' | 'city' | 'address' | 'logo_path' | 'serial_no' | 'status'> | null>(null)
  const [serialSearchError, setSerialSearchError] = useState('')
  const [serialSearchLoading, setSerialSearchLoading] = useState(false)
  const storeStatusLabel = (status: StoreStatus) => tk.stores.statuses[status]

  const searchStoreBySerial = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSerialSearchError('')
    setSerialResult(null)
    const serial = Number(serialSearch.trim())
    if (!supabase || !Number.isSafeInteger(serial) || serial <= 0) {
      setSerialSearchError(tk.stores.serialLookupError)
      return
    }
    setSerialSearchLoading(true)
    const { data, error: requestError } = await supabase
      .from('stores')
      .select('id, name, city, address, logo_path, serial_no, status')
      .eq('serial_no', serial)
      .maybeSingle()
    setSerialSearchLoading(false)
    if (requestError) {
      setSerialSearchError(tk.stores.serialLookupError)
      return
    }
    if (!data) {
      setSerialSearchError(tk.stores.serialLookupEmpty)
      return
    }
    setSerialResult(data as Pick<StoreRecord, 'id' | 'name' | 'city' | 'address' | 'logo_path' | 'serial_no' | 'status'>)
  }

  return (
    <section className="space-y-6 border-t-2 border-stone-900 pt-5">
      <h2 className="text-xl font-semibold text-stone-900">{tk.stores.adminTitle}</h2>
      <div role="tablist" aria-label={tk.stores.adminTitle} className="flex border-b border-stone-200">
        <button type="button" role="tab" aria-selected={activeTab === 'stores'} onClick={() => setActiveTab('stores')} className={`min-h-11 border-b-2 px-4 text-sm font-semibold ${activeTab === 'stores' ? 'border-emerald-800 text-emerald-900' : 'border-transparent text-stone-600'}`}>
          {tk.stores.allStores}
        </button>
        <button type="button" role="tab" aria-selected={activeTab === 'catalog'} onClick={() => setActiveTab('catalog')} className={`min-h-11 border-b-2 px-4 text-sm font-semibold ${activeTab === 'catalog' ? 'border-emerald-800 text-emerald-900' : 'border-transparent text-stone-600'}`}>
          {tk.adminCatalog.title}
        </button>
      </div>
      {activeTab === 'catalog' ? <AdminCatalog /> : <div role="tabpanel" className="space-y-6">
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      {notice && <p role="status" className="text-sm text-emerald-800">{notice}</p>}
      <section className="space-y-3 rounded-md border border-stone-200 p-4">
        <h3 className="font-semibold text-stone-800">{tk.stores.serialLookup}</h3>
        <form onSubmit={(event) => void searchStoreBySerial(event)} className="flex gap-2">
          <input
            type="number"
            min="1"
            step="1"
            value={serialSearch}
            onChange={(event) => setSerialSearch(event.target.value)}
            placeholder={tk.stores.serialLookupPlaceholder}
            aria-label={tk.stores.serialLookup}
            className="min-h-11 min-w-0 flex-1 rounded-md border border-stone-300 px-3 text-base"
          />
          <button type="submit" disabled={serialSearchLoading} className="min-h-11 rounded-md bg-stone-900 px-4 text-sm font-semibold text-white disabled:opacity-60">
            {tk.stores.serialLookupSubmit}
          </button>
        </form>
        {serialSearchError && <p role={serialSearchError === tk.stores.serialLookupEmpty ? 'status' : 'alert'} className="text-sm text-stone-700">{serialSearchError}</p>}
        {serialResult && (
          <article className="flex gap-3 border-t border-stone-200 pt-3">
            {serialResult.logo_path && supabase && (
              <img
                src={supabase.storage.from('store-logos').getPublicUrl(serialResult.logo_path).data.publicUrl}
                alt={tk.stores.logoPreview}
                loading="lazy"
                className="h-14 w-14 rounded-full object-cover shadow-sm"
              />
            )}
            <div className="min-w-0">
              <h4 className="font-semibold text-stone-900">{serialResult.name}</h4>
              <p className="text-sm text-stone-700">{tk.buyer.serialNo(serialResult.serial_no ?? 0)}</p>
              <p className="text-sm text-stone-700">{serialResult.city || ''}{serialResult.city ? ', ' : ''}{serialResult.address}</p>
              <p className="text-sm text-stone-500">{storeStatusLabel(serialResult.status)}</p>
            </div>
          </article>
        )}
      </section>
      <div>
        <h3 className="mb-3 font-semibold text-stone-800">{tk.stores.applications}</h3>
        {stores.filter((item) => item.status === 'pending').length === 0 ? (
          <p className="text-sm text-stone-500">{tk.stores.noApplications}</p>
        ) : stores.filter((item) => item.status === 'pending').map((item) => (
          <article key={item.id} className="space-y-3 border-b border-stone-200 py-4">
            {photoUrls[item.id] && <img src={photoUrls[item.id]} alt={tk.stores.photo} className="h-44 w-full rounded-md object-cover" />}
            <h4 className="font-semibold text-stone-900">{item.name}</h4>
            <p className="text-sm text-stone-700">{item.phone}</p>
            <p className="text-sm text-stone-700">{item.city || ''}{item.city ? ', ' : ''}{item.address}</p>
            {item.lat === null || item.lng === null
              ? <p className="text-sm font-medium text-amber-800">{tk.stores.locationMissingWarning}</p>
              : item.serial_no !== null && <p className="text-sm text-stone-600">{tk.buyer.serialNo(item.serial_no)}</p>}
            <div className="grid grid-cols-2 gap-2">
              <button type="button" disabled={busyStoreId === item.id} onClick={() => onChangeStatus(item.id, 'approved')} className="min-h-11 rounded-md bg-emerald-800 px-3 text-sm font-semibold text-white disabled:opacity-60">{tk.stores.approve}</button>
              <button type="button" disabled={busyStoreId === item.id} onClick={() => onChangeStatus(item.id, 'suspended')} className="min-h-11 rounded-md border border-stone-400 px-3 text-sm font-semibold text-stone-800 disabled:opacity-60">{tk.stores.suspend}</button>
            </div>
          </article>
        ))}
      </div>
      <div>
        <h3 className="mb-3 font-semibold text-stone-800">{tk.stores.allStores}</h3>
        {stores.length === 0 ? <p className="text-sm text-stone-500">{tk.stores.noStores}</p> : (
          <div className="divide-y divide-stone-200">
            {stores.map((item) => (
              <article key={item.id} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="wrap-break-word font-medium text-stone-900">{item.name}</p>
                  <p className="text-sm text-stone-500">{item.serial_no !== null ? tk.buyer.serialNo(item.serial_no) : tk.buyer.noSerialNo} · {storeStatusLabel(item.status)}</p>
                </div>
                {item.status !== 'pending' && (
                  <button
                    type="button"
                    disabled={busyStoreId === item.id}
                    onClick={() => onChangeStatus(item.id, item.status === 'approved' ? 'suspended' : 'approved')}
                    className="min-h-11 shrink-0 rounded-md border border-stone-300 px-3 text-sm font-semibold text-stone-800 disabled:opacity-60"
                  >
                    {item.status === 'approved' ? tk.stores.suspend : tk.stores.approveAgain}
                  </button>
                )}
              </article>
            ))}
          </div>
        )}
      </div>
      <AdminReports busyStoreId={busyStoreId} onSuspend={(storeId) => onChangeStatus(storeId, 'suspended')} />
      </div>}
    </section>
  )
}

type ReportEntry = { id: string; price_id: string; reason: string | null }
type ReportListing = Pick<StorePrice, 'price' | 'updated_at'> & {
  price_id: string
  store_id: string
  store_name: string
  product_name: string
}

function AdminReports({ busyStoreId, onSuspend }: { busyStoreId: string; onSuspend: (storeId: string) => void }) {
  const [groups, setGroups] = useState<{ priceId: string; listing: ReportListing | null; reasons: string[] }[]>([])
  const [loading, setLoading] = useState(true)
  const [busyPriceId, setBusyPriceId] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const loadReports = async () => {
    if (!supabase) {
      setError(tk.reports.loadError)
      setLoading(false)
      return
    }
    const client = supabase
    setLoading(true)
    const { data, error: requestError } = await client
      .from('reports')
      .select('id, price_id, reason')
      .order('created_at', { ascending: false })
    if (requestError) {
      setError(tk.reports.loadError)
      setLoading(false)
      return
    }
    const entries = (data ?? []) as ReportEntry[]
    if (entries.length === 0) {
      setGroups([])
      setError('')
      setLoading(false)
      return
    }
    const priceIds = [...new Set(entries.map((entry) => entry.price_id))]
    const { data: priceData, error: priceError } = await client
      .from('price_list')
      .select('price_id, store_id, store_name, product_name, price, updated_at')
      .in('price_id', priceIds)
    if (priceError) {
      setError(tk.reports.loadError)
      setLoading(false)
      return
    }
    const listings = (priceData ?? []) as ReportListing[]
    const grouped = new Map<string, { priceId: string; listing: ReportListing | null; reasons: string[] }>()
    for (const entry of entries) {
      const group = grouped.get(entry.price_id) ?? {
        priceId: entry.price_id,
        listing: listings.find((listing) => listing.price_id === entry.price_id) ?? null,
        reasons: [],
      }
      group.reasons.push(entry.reason?.trim() || tk.reports.noReason)
      grouped.set(entry.price_id, group)
    }
    setGroups([...grouped.values()])
    setError('')
    setLoading(false)
  }

  useEffect(() => { void loadReports() }, [])

  const closeReport = async (priceId: string) => {
    if (!supabase) return
    setBusyPriceId(priceId)
    setError('')
    setNotice('')
    const { error: deleteError } = await supabase.from('reports').delete().eq('price_id', priceId)
    setBusyPriceId('')
    if (deleteError) {
      setError(tk.reports.actionError)
      return
    }
    setNotice(tk.reports.closed)
    await loadReports()
  }

  return (
    <div>
      <h3 className="mb-3 font-semibold text-stone-800">{tk.reports.adminTitle}</h3>
      {error && <p role="alert" className="mb-3 text-sm text-red-700">{error}</p>}
      {notice && <p role="status" className="mb-3 text-sm text-emerald-800">{notice}</p>}
      {loading ? <p className="text-sm text-stone-500">{tk.stores.loading}</p> : groups.length === 0 ? (
        <p className="text-sm text-stone-500">{tk.reports.noReports}</p>
      ) : groups.map((group) => (
        <article key={group.priceId} className="space-y-3 border-b border-stone-200 py-4">
          {group.listing ? (
            <>
              <h4 className="font-semibold text-stone-900">{group.listing.product_name}</h4>
              <p className="text-sm text-stone-700">{tk.buyer.store}: {group.listing.store_name}</p>
              <p className="text-sm text-stone-700">{tk.reports.currentPrice}: {Number(group.listing.price).toFixed(2)} {tk.buyer.currency}</p>
            </>
          ) : <p className="text-sm text-stone-600">{tk.reports.priceUnavailable}</p>}
          <p className="text-sm font-semibold text-stone-800">{tk.reports.count(group.reasons.length)}</p>
          <ul className="list-disc space-y-1 pl-5 text-sm text-stone-600">
            {group.reasons.map((reason, index) => <li key={`${group.priceId}-${index}`}>{reason}</li>)}
          </ul>
          <div className="grid gap-2 sm:grid-cols-2">
            <button type="button" disabled={busyPriceId === group.priceId} onClick={() => void closeReport(group.priceId)} className="min-h-11 rounded-md border border-stone-300 px-3 text-sm font-semibold text-stone-800 disabled:opacity-60">{tk.reports.closeReport}</button>
            {group.listing && <button type="button" disabled={busyStoreId === group.listing.store_id} onClick={() => onSuspend(group.listing!.store_id)} className="min-h-11 rounded-md bg-red-800 px-3 text-sm font-semibold text-white disabled:opacity-60">{tk.reports.suspendStore}</button>}
          </div>
        </article>
      ))}
    </div>
  )
}

export function StoreProfile({ userId, role, visible }: { userId: string; role: 'user' | 'admin' | null; visible: boolean }) {
  const [store, setStore] = useState<StoreRecord | null>(null)
  const [stores, setStores] = useState<StoreRecord[]>([])
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({})
  const [fields, setFields] = useState<StoreFields>(emptyStoreFields)
  const [photo, setPhoto] = useState<File | null>(null)
  const [logo, setLogo] = useState<File | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [locating, setLocating] = useState(false)
  const [busyStoreId, setBusyStoreId] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const loadStores = async () => {
    if (!supabase) {
      setError(tk.stores.loadError)
      setLoading(false)
      return
    }
    const client = supabase
    setLoading(true)
    const request = client.from('stores').select('id, owner_id, name, phone, city, address, lat, lng, photo_path, logo_path, serial_no, status')
    const { data, error: requestError } = role === 'admin'
      ? await request.order('created_at', { ascending: false })
      : await request.eq('owner_id', userId).maybeSingle()

    if (requestError) {
      setError(tk.stores.loadError)
      setLoading(false)
      return
    }

    const storeRows = (role === 'admin' ? data ?? [] : data ? [data] : []) as StoreRecord[]
    const ownStore = storeRows.find((item) => item.owner_id === userId) ?? null
    setStores(storeRows)
    setStore(ownStore)
    setFields(ownStore ? {
      name: ownStore.name,
      phone: ownStore.phone,
      city: ownStore.city ?? '',
      address: ownStore.address,
      lat: ownStore.lat,
      lng: ownStore.lng,
    } : emptyStoreFields)

    if (storeRows.length) {
      const entries = await Promise.all(storeRows
        .filter((item) => item.photo_path)
        .map(async (item) => {
          const { data: signedPhoto } = await client.storage
            .from('store-photos')
            .createSignedUrl(item.photo_path!, 3600)
          return signedPhoto ? [item.id, signedPhoto.signedUrl] as const : null
        }))
      setPhotoUrls(Object.fromEntries(entries.filter((entry): entry is readonly [string, string] => entry !== null)))
    } else {
      setPhotoUrls({})
    }
    setError('')
    setLoading(false)
  }

  useEffect(() => {
    void loadStores()
  }, [userId, role])

  const updateField = (key: keyof StoreFields, value: string | number | null) => {
    setFields((previous) => ({ ...previous, [key]: value }))
  }

  const updateLocation = (lat: number, lng: number) => {
    setFields((previous) => ({ ...previous, lat, lng }))
  }

  const locateUser = () => {
    if (!navigator.geolocation) {
      setError(tk.stores.locationError)
      return
    }
    setError('')
    setNotice('')
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        updateField('lat', coords.latitude)
        updateField('lng', coords.longitude)
        setNotice(tk.stores.locationSuccess)
        setLocating(false)
      },
      () => {
        setError(tk.stores.locationError)
        setLocating(false)
      },
      { enableHighAccuracy: true, timeout: 12000 },
    )
  }

  const saveStore = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    setNotice('')
    if (!store && (fields.lat === null || fields.lng === null)) {
      setError(tk.stores.locationRequired)
      return
    }
    if (!store && !photo) {
      setError(tk.stores.photoRequired)
      return
    }
    if (!supabase) {
      setError(tk.stores.saveError)
      return
    }

    setSaving(true)
    let storeSaved = false
    let logoSaveFailed = false
    try {
      let photoPath = store?.photo_path ?? null
      if (photo) {
        const compressed = await prepareStorePhoto(photo)
        photoPath = `${userId}/vitrin.jpg`
        const { error: uploadError } = await supabase.storage
          .from('store-photos')
          .upload(photoPath, compressed, { contentType: 'image/jpeg', upsert: true })
        if (uploadError) throw uploadError
      }

      const storeFields = {
        ...fields,
        city: fields.city.trim() || null,
        photo_path: photoPath,
      }
      const result = store
        ? await supabase.from('stores').update(storeFields).eq('id', store.id).select('id').single()
        : await supabase.from('stores').insert({ owner_id: userId, ...storeFields }).select('id').single()

      if (result.error) throw result.error
      storeSaved = true
      const storeId = result.data.id
      if (logo) {
        logoSaveFailed = true
        const compressedLogo = await prepareStoreLogo(logo)
        const logoPath = `${storeId}/${Date.now()}.webp`
        const { error: uploadError } = await supabase.storage.from('store-logos').upload(logoPath, compressedLogo, {
          contentType: compressedLogo.type,
          upsert: false,
        })
        if (uploadError) throw uploadError
        const { error: updateLogoError } = await supabase.from('stores').update({ logo_path: logoPath }).eq('id', storeId)
        if (updateLogoError) {
          const { error: cleanupError } = await supabase.storage.from('store-logos').remove([logoPath])
          if (cleanupError) console.warn('Could not remove an unlinked store logo', cleanupError)
          throw updateLogoError
        }
        const oldLogoPath = store?.logo_path
        if (oldLogoPath && oldLogoPath !== logoPath) {
          const { error: removeError } = await supabase.storage.from('store-logos').remove([oldLogoPath])
          if (removeError) console.warn('Could not remove the replaced store logo', removeError)
        }
        logoSaveFailed = false
      }
      setPhoto(null)
      setLogo(null)
      setNotice(tk.stores.saved)
      await loadStores()
    } catch (saveError) {
      console.error('Store save failed', saveError)
      if (logoSaveFailed && storeSaved) {
        setError(saveError instanceof Error && saveError.message === 'size' ? tk.stores.logoSizeError : tk.stores.logoSaveError)
      } else {
        setError(tk.stores.saveError)
      }
    } finally {
      setSaving(false)
    }
  }

  const changeStoreStatus = async (storeId: string, status: StoreStatus) => {
    if (!supabase) return
    const target = stores.find((item) => item.id === storeId)
    if (status === 'approved' && target && (target.lat === null || target.lng === null)
      && !window.confirm(tk.stores.approveWithoutLocation)) return
    setError('')
    setNotice('')
    setBusyStoreId(storeId)
    const { error: statusError } = await supabase.rpc('set_store_status', {
      p_store: storeId,
      p_status: status,
    })
    setBusyStoreId('')
    if (statusError) {
      setError(tk.stores.statusError)
      return
    }
    if (status === 'approved') {
      const { data: approvedStore, error: serialError } = await supabase
        .from('stores')
        .select('serial_no')
        .eq('id', storeId)
        .single()
      if (serialError || approvedStore?.serial_no === null || approvedStore?.serial_no === undefined) {
        setError(tk.stores.statusError)
        await loadStores()
        return
      }
      setNotice(tk.stores.serialAssigned(approvedStore.serial_no))
    } else {
      setNotice(tk.stores.statusSaved)
    }
    await loadStores()
  }

  return (
    <div className="mt-8 space-y-8">
      {loading ? <p className="text-sm text-stone-500">{tk.stores.loading}</p> : error && !store && role !== 'admin' ? (
        <p role="alert" className="text-sm text-red-700">{error}</p>
      ) : (
        <StoreApplicationForm
          store={store}
          photoUrls={photoUrls}
          fields={fields}
          onFieldChange={updateField}
          photo={photo}
          onPhotoChange={setPhoto}
          logo={logo}
          onLogoChange={setLogo}
          onLocationChange={updateLocation}
          onLocate={locateUser}
          locating={locating}
          visible={visible}
          error={error}
          notice={notice}
          onSubmit={(event) => void saveStore(event)}
          saving={saving}
        />
      )}

      {store && !loading && (store.status === 'approved' ? (
        <StorePriceManager storeId={store.id} />
      ) : (
        <section className="border-t border-stone-200 pt-5">
          <p className="text-sm text-stone-600">
            {store.status === 'pending' ? tk.storePrices.pendingMessage : tk.storePrices.suspendedMessage}
          </p>
        </section>
      ))}

      {role === 'admin' && !loading && (
        <AdminPanel
          stores={stores}
          photoUrls={photoUrls}
          busyStoreId={busyStoreId}
          error={error}
          notice={notice}
          onChangeStatus={(storeId, status) => void changeStoreStatus(storeId, status)}
        />
      )}
    </div>
  )
}
