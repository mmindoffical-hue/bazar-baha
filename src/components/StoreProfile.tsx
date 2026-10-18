import { lazy, Suspense, useEffect, useRef, useState, type FormEvent } from 'react'
import { MapPin } from 'lucide-react'
import { tk } from '../i18n/tk'
import { prepareStoreLogo, prepareStorePhoto } from '../lib/formatting'
import { AdminCatalog } from './AdminCatalog'
import type { StoreFields, StorePrice, StoreRecord, StoreStatus } from '../lib/types'
import { supabase } from '../lib/supabase'
import { StorePriceManager } from './StorePriceManager'

const StoreLocationPicker = lazy(() => import('./StoreLocationPicker'))

type StoreWithPrivatePhone = StoreRecord & { phone: string | null }

const emptyStoreFields: StoreFields = {
  name: '',
  phone: '',
  city: '',
  address: '',
  lat: null,
  lng: null,
}

const phoneDigits = (value: string) => {
  const nationalNumber = value.trim().replace(/^\+993(?:\s|-)?/, '')
  return nationalNumber.replace(/\D/g, '').slice(0, 8)
}

const formatPhone = (value: string) => {
  const digits = phoneDigits(value)
  if (!digits) return '+993'
  return `+993 ${digits.slice(0, 2)}${digits.length > 2 ? ` ${digits.slice(2)}` : ''}`
}

async function savePrivatePhone(storeId: string, phone: string) {
  if (!supabase) throw new Error('Supabase client is unavailable')
  const { data, error: selectError } = await supabase
    .from('store_private')
    .select('store_id')
    .eq('store_id', storeId)
    .maybeSingle()
  if (selectError) {
    console.error('store_private write failed', { code: selectError.code, message: selectError.message })
    throw selectError
  }

  const result = data
    ? await supabase.from('store_private').update({ phone }).eq('store_id', storeId)
    : await supabase.from('store_private').insert({ store_id: storeId, phone })
  if (result.error) {
    console.error('store_private write failed', { code: result.error.code, message: result.error.message })
    throw result.error
  }
}

function StoreApplicationForm({ store, photoUrls, fields, onFieldChange, photo, onPhotoChange, logo, onLogoChange, onLocationChange, onLocate, locating, visible, error, notice, invalidFields, phoneOnlyRetry, onSubmit, saving }: {
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
  invalidFields: string[]
  phoneOnlyRetry: boolean
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
  saving: boolean
}) {
  const phoneInputRef = useRef<HTMLInputElement>(null)
  const textInput = (key: 'name' | 'phone' | 'city' | 'address', label: string, required = false) => (
    <label className="block space-y-2 text-sm font-medium text-stone-700">
      <span>{label}{required ? ' *' : ''}</span>
      <input
        ref={key === 'phone' ? phoneInputRef : undefined}
        id={`store-field-${key}`}
        inputMode={key === 'phone' ? 'tel' : undefined}
        autoComplete={key === 'phone' ? 'tel' : undefined}
        disabled={phoneOnlyRetry && key !== 'phone'}
        value={key === 'phone' ? formatPhone(fields.phone) : fields[key]}
        onFocus={key === 'phone' ? (event) => {
          if (event.currentTarget.selectionStart !== null && event.currentTarget.selectionStart < 4) {
            event.currentTarget.setSelectionRange(4, 4)
          }
        } : undefined}
        onClick={key === 'phone' ? (event) => {
          if (event.currentTarget.selectionStart !== null && event.currentTarget.selectionStart < 4) {
            event.currentTarget.setSelectionRange(4, 4)
          }
        } : undefined}
        onKeyDown={key === 'phone' ? (event) => {
          const position = event.currentTarget.selectionStart
          if ((event.key === 'Backspace' && position !== null && position <= 4)
            || (event.key === 'ArrowLeft' && position !== null && position <= 4)
            || (event.key === 'Home')) {
            event.preventDefault()
            event.currentTarget.setSelectionRange(4, 4)
          }
        } : undefined}
        onChange={(event) => {
          if (key === 'phone') {
            const cursorPosition = event.currentTarget.selectionStart ?? event.currentTarget.value.length
            const inputValue = event.currentTarget.value
            const digitsBeforeCursor = phoneDigits(inputValue.slice(0, cursorPosition)).length
            const digits = phoneDigits(inputValue)
            const formatted = formatPhone(digits)
            onFieldChange(key, digits)
            requestAnimationFrame(() => {
              const input = phoneInputRef.current
              if (!input) return
              const nextPosition = digitsBeforeCursor <= 2 ? 5 + digitsBeforeCursor : 6 + digitsBeforeCursor
              input.setSelectionRange(Math.max(4, Math.min(nextPosition, formatted.length)), Math.max(4, Math.min(nextPosition, formatted.length)))
            })
          } else {
            onFieldChange(key, event.currentTarget.value)
          }
        }}
        className={`min-h-12 w-full rounded-md border bg-white px-3 text-base text-stone-900 outline-none focus:border-emerald-800 focus:ring-2 focus:ring-emerald-800/15 ${invalidFields.includes(key) ? 'border-red-600 ring-2 ring-red-200' : 'border-stone-300'}`}
      />
    </label>
  )

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-200 pb-3">
        <h2 className="text-lg font-semibold text-stone-900">{store ? store.name : tk.stores.applyTitle}</h2>
        {store && <span className="text-sm font-semibold text-emerald-900">{tk.stores.statuses[store.status]}</span>}
      </div>
      <form noValidate onSubmit={onSubmit} className="space-y-4">
        {phoneOnlyRetry && <p role="status" className="rounded-md bg-amber-50 p-3 text-sm text-amber-900">{tk.stores.phoneRetryOnly}</p>}
        {!store && (
          <p role="status" className={`rounded-md border p-3 text-sm font-semibold ${fields.lat === null || fields.lng === null ? 'border-orange-400 bg-orange-50 text-orange-900' : 'border-emerald-400 bg-emerald-50 text-emerald-900'}`}>
            {fields.lat === null || fields.lng === null ? tk.stores.locationRequired : tk.stores.locationSelected}
          </p>
        )}
        {textInput('name', tk.stores.name, true)}
        {textInput('phone', tk.stores.phone, true)}
        {phoneDigits(fields.phone).length < 8 && <p className="-mt-3 text-sm font-medium text-red-700">{tk.stores.phoneIncomplete}</p>}
        {textInput('city', tk.stores.city)}
        {textInput('address', tk.stores.address, true)}
        <div className="space-y-2">
          <p className="text-sm font-medium text-stone-700">{tk.stores.photo}{!store ? ' *' : ''}</p>
          {store && photoUrls[store.id] && !photo && (
            <img src={photoUrls[store.id]} alt={tk.stores.photo} className="h-40 w-full rounded-md object-cover" />
          )}
          {photo && <p className="text-sm text-stone-500">{photo.name}</p>}
          <div id="store-field-photo" className={`grid grid-cols-2 gap-2 rounded-md ${invalidFields.includes('photo') ? 'outline outline-2 outline-red-600' : ''}`}>
            <label className="flex min-h-11 cursor-pointer items-center justify-center rounded-md border border-stone-300 px-3 text-center text-sm font-semibold text-stone-800">
              {tk.stores.camera}
              <input type="file" accept="image/*" capture="environment" disabled={phoneOnlyRetry} className="sr-only" onChange={(event) => onPhotoChange(event.target.files?.[0] ?? null)} />
            </label>
            <label className="flex min-h-11 cursor-pointer items-center justify-center rounded-md border border-stone-300 px-3 text-center text-sm font-semibold text-stone-800">
              {tk.stores.gallery}
              <input type="file" accept="image/*" disabled={phoneOnlyRetry} className="sr-only" onChange={(event) => onPhotoChange(event.target.files?.[0] ?? null)} />
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
            disabled={phoneOnlyRetry}
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
          disabled={locating || phoneOnlyRetry}
          className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-emerald-900 disabled:opacity-60"
        >
          <MapPin aria-hidden="true" size={18} />
          {locating ? tk.stores.locationLoading : tk.stores.location}
        </button>
        {visible && !phoneOnlyRetry && (
          <div id="store-location" tabIndex={-1} className={`space-y-2 rounded-md ${invalidFields.includes('location') ? 'outline outline-2 outline-red-600' : ''}`}>
            {!store && <p className={`rounded-md border p-3 text-sm font-semibold ${fields.lat === null || fields.lng === null ? 'border-orange-400 bg-orange-50 text-orange-900' : 'border-emerald-400 bg-emerald-50 text-emerald-900'}`}>
              {fields.lat === null || fields.lng === null ? tk.stores.locationRequired : tk.stores.locationSelected}
            </p>}
            <p className="text-sm font-medium text-stone-700">{tk.stores.location}{!store ? ' *' : ''}</p>
            <Suspense fallback={<p className="text-sm text-stone-500">{tk.buyer.mapLoading}</p>}>
              <StoreLocationPicker lat={fields.lat} lng={fields.lng} onChange={onLocationChange} />
            </Suspense>
          </div>
        )}
        {fields.lat !== null && fields.lng !== null && (
          <p className="text-xs text-stone-500">{fields.lat.toFixed(5)}, {fields.lng.toFixed(5)}</p>
        )}
        {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
        {notice && <p role="status" className="text-sm text-emerald-800">{notice}</p>}
        <button
          type="submit"
          disabled={saving || phoneDigits(fields.phone).length !== 8 || (!store && (fields.lat === null || fields.lng === null))}
          className="min-h-12 w-full rounded-md bg-emerald-800 px-4 font-semibold text-white transition-colors hover:bg-emerald-900 disabled:cursor-wait disabled:opacity-60"
        >
          {saving ? tk.stores.saving : store ? tk.stores.save : tk.stores.submit}
        </button>
        {!saving && phoneDigits(fields.phone).length !== 8 && <p className="text-sm font-medium text-red-700">{tk.stores.phoneSubmitReason}</p>}
        {!store && (fields.lat === null || fields.lng === null) && <p className="text-sm font-medium text-orange-900">{tk.stores.locationSubmitReason}</p>}
      </form>
    </section>
  )
}

function AdminPanel({ stores, photoUrls, busyStoreId, error, notice, onChangeStatus }: {
  stores: StoreWithPrivatePhone[]
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
            <p className="text-sm text-stone-700">{item.city || ''}{item.city ? ', ' : ''}{item.address}</p>
            <p className="text-sm text-stone-700">{tk.stores.phone}: {item.phone || tk.stores.phoneUnavailable}</p>
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
                  <p className="text-sm text-stone-500">{tk.stores.phone}: {item.phone || tk.stores.phoneUnavailable}</p>
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
  const [stores, setStores] = useState<StoreWithPrivatePhone[]>([])
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
  const [invalidFields, setInvalidFields] = useState<string[]>([])
  const [pendingPhoneStoreId, setPendingPhoneStoreId] = useState('')

  const loadStores = async () => {
    if (!supabase) {
      setError(tk.stores.loadError)
      setLoading(false)
      return
    }
    const client = supabase
    setLoading(true)
    const selectFields = 'id, name, city, address, lat, lng, photo_path, logo_path, serial_no, status'
    const { data, error: requestError } = role === 'admin'
      ? await client.from('stores').select(selectFields).order('created_at', { ascending: false })
      : await client.from('stores').select(selectFields).eq('owner_id', userId).maybeSingle()

    if (requestError) {
      setError(tk.stores.loadError)
      setLoading(false)
      return
    }

    const storeRows = (role === 'admin' ? data ?? [] : data ? [data] : []) as StoreRecord[]
    let ownStore = role === 'admin' ? null : storeRows[0] ?? null
    if (role === 'admin') {
      const { data: ownStoreData, error: ownStoreError } = await client
        .from('stores')
        .select(selectFields)
        .eq('owner_id', userId)
        .maybeSingle()
      if (ownStoreError) {
        setError(tk.stores.loadError)
        setLoading(false)
        return
      }
      ownStore = ownStoreData as StoreRecord | null
    }
    const storeIds = [...new Set([...storeRows.map((item) => item.id), ...(ownStore ? [ownStore.id] : [])])]
    const { data: privatePhoneRows, error: privatePhoneError } = storeIds.length
      ? await client.from('store_private').select('store_id, phone').in('store_id', storeIds)
      : { data: [], error: null }
    if (privatePhoneError) {
      setError(tk.stores.loadError)
      setLoading(false)
      return
    }
    const phonesByStoreId = new Map((privatePhoneRows ?? []).map((item) => [item.store_id, item.phone]))
    const storesWithPhone: StoreWithPrivatePhone[] = storeRows.map((item) => ({
      ...item,
      phone: phonesByStoreId.get(item.id) ?? null,
    }))
    const ownStoreWithPhone = ownStore
      ? { ...ownStore, phone: phonesByStoreId.get(ownStore.id) ?? null }
      : null
    setStores(storesWithPhone)
    setStore(ownStoreWithPhone)
    setFields(ownStoreWithPhone ? {
      name: ownStoreWithPhone.name,
      phone: phoneDigits(ownStoreWithPhone.phone ?? ''),
      city: ownStoreWithPhone.city ?? '',
      address: ownStoreWithPhone.address,
      lat: ownStoreWithPhone.lat,
      lng: ownStoreWithPhone.lng,
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
    setInvalidFields((previous) => previous.filter((field) => field !== key))
  }

  const updateLocation = (lat: number, lng: number) => {
    setFields((previous) => ({ ...previous, lat, lng }))
    setInvalidFields((previous) => previous.filter((field) => field !== 'location'))
  }

  const updatePhoto = (selectedPhoto: File | null) => {
    setPhoto(selectedPhoto)
    if (selectedPhoto) setInvalidFields((previous) => previous.filter((field) => field !== 'photo'))
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
        updateLocation(coords.latitude, coords.longitude)
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
    const missingField = !fields.name.trim()
      ? 'name'
      : phoneDigits(fields.phone).length !== 8
        ? 'phone'
        : !fields.address.trim()
          ? 'address'
          : !store && !photo
            ? 'photo'
            : !store && (fields.lat === null || fields.lng === null)
              ? 'location'
              : ''
    if (missingField) {
      setInvalidFields([missingField])
      setError(missingField === 'phone' ? tk.stores.phoneIncomplete
        : missingField === 'photo' ? tk.stores.photoRequired
          : missingField === 'location' ? tk.stores.locationRequired
            : tk.stores.requiredField)
      requestAnimationFrame(() => {
        const target = missingField === 'photo'
          ? document.getElementById('store-field-photo')
          : document.getElementById(`store-field-${missingField}`)
        target?.scrollIntoView({ behavior: 'smooth', block: 'center' })
        if (missingField === 'location') return
        if (missingField === 'photo') target?.querySelector('input')?.focus()
        else (target as HTMLInputElement | null)?.focus()
      })
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
      let storeId = pendingPhoneStoreId
      if (!storeId) {
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
          name: fields.name.trim(),
          city: fields.city.trim() || null,
          address: fields.address.trim(),
          lat: fields.lat,
          lng: fields.lng,
          photo_path: photoPath,
        }
        const result = store
          ? await supabase.from('stores').update(storeFields).eq('id', store.id).select('id').single()
          : await supabase.from('stores').insert({
            owner_id: userId,
            ...storeFields,
          }).select('id').single()

        if (result.error) throw result.error
        storeSaved = true
        storeId = result.data.id
        setPendingPhoneStoreId(storeId)
      } else {
        storeSaved = true
      }

      try {
        await savePrivatePhone(storeId, `+993${phoneDigits(fields.phone)}`)
      } catch {
        setInvalidFields(['phone'])
        setError(tk.stores.phoneSaveError)
        requestAnimationFrame(() => {
          const input = document.getElementById('store-field-phone')
          input?.scrollIntoView({ behavior: 'smooth', block: 'center' })
          input?.focus()
        })
        return
      }
      setPendingPhoneStoreId('')
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
      if (storeSaved) {
        await loadStores()
        setFields((previous) => ({ ...previous, phone: phoneDigits(fields.phone) }))
      }
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
          onPhotoChange={updatePhoto}
          logo={logo}
          onLogoChange={setLogo}
          onLocationChange={updateLocation}
          onLocate={locateUser}
          locating={locating}
          visible={visible}
          error={error}
          notice={notice}
          invalidFields={invalidFields}
          phoneOnlyRetry={Boolean(pendingPhoneStoreId)}
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
