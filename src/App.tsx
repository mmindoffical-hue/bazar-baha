import { useEffect, useRef, useState, type FormEvent } from 'react'
import { ArrowLeft, ArrowRight, ChevronRight, Home, MapPin, Search, ShoppingBasket, UserRound } from 'lucide-react'
import { tk, type PageKey } from './i18n/tk'
import { useAuth } from './lib/AuthContext'
import { supabase } from './lib/supabase'

const navigation: { key: PageKey; icon: typeof Home }[] = [
  { key: 'home', icon: Home },
  { key: 'search', icon: Search },
  { key: 'basket', icon: ShoppingBasket },
  { key: 'profile', icon: UserRound },
]

type Category = { id: number; name_tk: string }
type Product = { id: string; name_tk: string; unit: string }
type PriceListing = {
  price_id: string
  price: number
  in_stock: boolean
  video_path: string | null
  updated_at: string
  store_name: string
  product_id: string
  product_name: string
  unit: string
}

type StoreStatus = 'pending' | 'approved' | 'suspended'
type StoreRecord = {
  id: string
  owner_id: string
  name: string
  phone: string
  city: string | null
  address: string
  lat: number | null
  lng: number | null
  photo_path: string | null
  status: StoreStatus
}
type StoreFields = {
  name: string
  phone: string
  city: string
  address: string
  lat: number | null
  lng: number | null
}

const emptyStoreFields: StoreFields = {
  name: '',
  phone: '',
  city: '',
  address: '',
  lat: null,
  lng: null,
}

async function prepareStorePhoto(file: File) {
  const image = await createImageBitmap(file)
  const scale = Math.min(1, 1280 / Math.max(image.width, image.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(image.width * scale))
  canvas.height = Math.max(1, Math.round(image.height * scale))
  const context = canvas.getContext('2d')
  if (!context) throw new Error('canvas')
  context.drawImage(image, 0, 0, canvas.width, canvas.height)
  image.close()

  for (const quality of [0.8, 0.75, 0.7, 0.65, 0.6, 0.55, 0.5]) {
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality))
    if (blob && blob.size < 2 * 1024 * 1024) return blob
  }
  throw new Error('size')
}

type StoreProduct = Product & { category_id: number }
type StorePrice = {
  id: string
  product_id: string
  price: number | string
  in_stock: boolean
  video_path: string | null
  updated_at: string
}

const videoMimeTypes = [
  'video/mp4',
  'video/webm;codecs=vp9',
  'video/webm;codecs=vp8',
  'video/webm',
]

function StoreVideoCapture({
  storeId,
  productId,
  currentVideoPath,
  onUploaded,
  onClose,
}: {
  storeId: string
  productId: string
  currentVideoPath: string | null
  onUploaded: (path: string) => void
  onClose: () => void
}) {
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null)
  const [previewUrl, setPreviewUrl] = useState('')
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [recording, setRecording] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const recorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const mountedRef = useRef(true)
  const chunksRef = useRef<Blob[]>([])
  const startedAtRef = useRef(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const stopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const mimeTypeRef = useRef('')

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    setCameraStream(null)
  }

  const clearTimers = () => {
    if (timerRef.current) clearInterval(timerRef.current)
    if (stopTimerRef.current) clearTimeout(stopTimerRef.current)
    timerRef.current = null
    stopTimerRef.current = null
  }

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      clearTimers()
      const recorder = recorderRef.current
      if (recorder && recorder.state !== 'inactive') {
        recorder.ondataavailable = null
        recorder.onstop = null
        recorder.stop()
      }
      streamRef.current?.getTracks().forEach((track) => track.stop())
    }
  }, [])

  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl)
  }, [previewUrl])

  const finishRecording = () => {
    const recorder = recorderRef.current
    if (!recorder || recorder.state === 'inactive') return
    clearTimers()
    setElapsedSeconds(Math.min(10, Math.floor((Date.now() - startedAtRef.current) / 1000)))
    recorder.stop()
  }

  const beginRecording = async () => {
    setError('')
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setError(tk.storePrices.unsupportedVideo)
      return
    }
    const mimeType = videoMimeTypes.find((type) => MediaRecorder.isTypeSupported(type))
    if (!mimeType) {
      setError(tk.storePrices.unsupportedVideo)
      return
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 640 },
          height: { ideal: 480 },
        },
        audio: false,
      })
      if (!mountedRef.current) {
        stream.getTracks().forEach((track) => track.stop())
        return
      }
      streamRef.current = stream
      setCameraStream(stream)
      mimeTypeRef.current = mimeType
      chunksRef.current = []
      const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 700000 })
      recorderRef.current = recorder
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data)
      }
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType })
        const url = URL.createObjectURL(blob)
        setPreviewUrl((previous) => {
          if (previous) URL.revokeObjectURL(previous)
          return url
        })
        setRecording(false)
        stopCamera()
      }
      startedAtRef.current = Date.now()
      setElapsedSeconds(0)
      setRecording(true)
      recorder.start(250)
      timerRef.current = setInterval(() => {
        setElapsedSeconds(Math.min(10, Math.floor((Date.now() - startedAtRef.current) / 1000)))
      }, 200)
      stopTimerRef.current = setTimeout(finishRecording, 10000)
    } catch (cameraError) {
      if (!mountedRef.current) return
      stopCamera()
      const errorName = cameraError instanceof DOMException ? cameraError.name : ''
      setError(errorName === 'NotAllowedError' || errorName === 'PermissionDeniedError' || errorName === 'SecurityError'
        ? tk.storePrices.cameraPermission
        : tk.storePrices.unsupportedVideo)
    }
  }

  const retake = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setPreviewUrl('')
    setElapsedSeconds(0)
    setError('')
  }

  const uploadVideo = async () => {
    if (!supabase || !previewUrl || uploading) return
    if (elapsedSeconds < 3) {
      setError(tk.storePrices.videoTooShort)
      return
    }
    setUploading(true)
    setError('')
    let uploadedPath = ''
    try {
      const response = await fetch(previewUrl)
      const blob = await response.blob()
      if (blob.size > 3145728) {
        setError(tk.storePrices.videoTooLarge)
        setUploading(false)
        return
      }
      const isMp4 = mimeTypeRef.current === 'video/mp4'
      const extension = isMp4 ? 'mp4' : 'webm'
      const contentType = isMp4 ? 'video/mp4' : 'video/webm'
      uploadedPath = `${storeId}/${productId}-${Date.now()}.${extension}`
      const { error: uploadError } = await supabase.storage
        .from('store-videos')
        .upload(uploadedPath, blob, { contentType, upsert: false })
      if (uploadError) throw uploadError

      const { data, error: updateError } = await supabase
        .from('prices')
        .update({ video_path: uploadedPath })
        .eq('store_id', storeId)
        .eq('product_id', productId)
        .select('id')
        .maybeSingle()
      if (updateError || !data) throw updateError ?? new Error('price not found')

      if (currentVideoPath) {
        const { error: removeError } = await supabase.storage.from('store-videos').remove([currentVideoPath])
        if (removeError) console.warn('Old product video could not be removed.', removeError)
      }
      onUploaded(uploadedPath)
      onClose()
    } catch {
      if (uploadedPath) {
        const { error: cleanupError } = await supabase.storage.from('store-videos').remove([uploadedPath])
        if (cleanupError) console.warn('Unlinked product video could not be removed.', cleanupError)
      }
      setError(tk.storePrices.videoUploadError)
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="mt-3 space-y-3 border-l-2 border-emerald-800 pl-3">
      {cameraStream && !previewUrl && (
        <video
          ref={(element) => { if (element) element.srcObject = cameraStream }}
          autoPlay
          muted
          playsInline
          className="aspect-video w-full rounded-md bg-black object-cover"
        />
      )}
      {previewUrl && <video src={previewUrl} controls playsInline className="aspect-video w-full rounded-md bg-black" />}
      <p className="text-sm tabular-nums text-stone-700">{elapsedSeconds} / 10 {tk.storePrices.videoSeconds}</p>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      <div className="flex flex-wrap gap-2">
        {!previewUrl && !recording && (
          <button type="button" onClick={() => void beginRecording()} className="min-h-11 rounded-md bg-emerald-800 px-4 text-sm font-semibold text-white">
            {tk.storePrices.startRecording}
          </button>
        )}
        {recording && (
          <button type="button" disabled={elapsedSeconds < 3} onClick={finishRecording} className="min-h-11 rounded-md border border-stone-300 px-4 text-sm font-semibold text-stone-800 disabled:opacity-50">
            {tk.storePrices.stopRecording}
          </button>
        )}
        {previewUrl && (
          <>
            <button type="button" disabled={uploading} onClick={retake} className="min-h-11 rounded-md border border-stone-300 px-4 text-sm font-semibold text-stone-800 disabled:opacity-50">
              {tk.storePrices.retakeVideo}
            </button>
            <button type="button" disabled={uploading} onClick={() => void uploadVideo()} className="min-h-11 rounded-md bg-emerald-800 px-4 text-sm font-semibold text-white disabled:cursor-wait disabled:opacity-60">
              {uploading ? tk.storePrices.uploadingVideo : tk.storePrices.uploadVideo}
            </button>
          </>
        )}
        <button type="button" disabled={uploading} onClick={onClose} className="min-h-11 px-3 text-sm font-semibold text-stone-700 disabled:opacity-50">
          {tk.storePrices.closeCamera}
        </button>
      </div>
    </div>
  )
}

function StorePriceManager({ storeId }: { storeId: string }) {
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
    const normalizedPrice = priceValue.trim().replace(',', '.')
    if (!/^\d+(?:\.\d{1,2})?$/.test(normalizedPrice)
      || Number(normalizedPrice) <= 0 || Number(normalizedPrice) >= 1000000) {
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

function StoreProfile({ userId, role }: { userId: string; role: 'user' | 'admin' | null }) {
  const [store, setStore] = useState<StoreRecord | null>(null)
  const [stores, setStores] = useState<StoreRecord[]>([])
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({})
  const [fields, setFields] = useState<StoreFields>(emptyStoreFields)
  const [photo, setPhoto] = useState<File | null>(null)
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
    const request = client.from('stores').select('id, owner_id, name, phone, city, address, lat, lng, photo_path, status')
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
    if (!store && !photo) {
      setError(tk.stores.photoRequired)
      return
    }
    if (!supabase) {
      setError(tk.stores.saveError)
      return
    }

    setSaving(true)
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
        ? await supabase.from('stores').update(storeFields).eq('id', store.id)
        : await supabase.from('stores').insert({ owner_id: userId, ...storeFields })

      if (result.error) throw result.error
      setPhoto(null)
      setNotice(tk.stores.saved)
      await loadStores()
    } catch {
      setError(tk.stores.saveError)
    } finally {
      setSaving(false)
    }
  }

  const changeStoreStatus = async (storeId: string, status: StoreStatus) => {
    if (!supabase) return
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
    setNotice(tk.stores.statusSaved)
    await loadStores()
  }

  const storeStatusLabel = (status: StoreStatus) => tk.stores.statuses[status]
  const textInput = (key: 'name' | 'phone' | 'city' | 'address', label: string, required = false) => (
    <label className="block space-y-2 text-sm font-medium text-stone-700">
      <span>{label}</span>
      <input
        required={required}
        value={fields[key]}
        onChange={(event) => updateField(key, event.target.value)}
        className="min-h-12 w-full rounded-md border border-stone-300 bg-white px-3 text-base text-stone-900 outline-none focus:border-emerald-800 focus:ring-2 focus:ring-emerald-800/15"
      />
    </label>
  )

  return (
    <div className="mt-8 space-y-8">
      {loading ? <p className="text-sm text-stone-500">{tk.stores.loading}</p> : error && !store && role !== 'admin' ? (
        <p role="alert" className="text-sm text-red-700">{error}</p>
      ) : (
        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-200 pb-3">
            <h2 className="text-lg font-semibold text-stone-900">{store ? store.name : tk.stores.applyTitle}</h2>
            {store && <span className="text-sm font-semibold text-emerald-900">{storeStatusLabel(store.status)}</span>}
          </div>
          <form onSubmit={saveStore} className="space-y-4">
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
                  <input type="file" accept="image/*" capture="environment" className="sr-only" onChange={(event) => setPhoto(event.target.files?.[0] ?? null)} />
                </label>
                <label className="flex min-h-11 cursor-pointer items-center justify-center rounded-md border border-stone-300 px-3 text-center text-sm font-semibold text-stone-800">
                  {tk.stores.gallery}
                  <input type="file" accept="image/*" className="sr-only" onChange={(event) => setPhoto(event.target.files?.[0] ?? null)} />
                </label>
              </div>
            </div>
            <button
              type="button"
              onClick={locateUser}
              disabled={locating}
              className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-emerald-900 disabled:opacity-60"
            >
              <MapPin aria-hidden="true" size={18} />
              {locating ? tk.stores.locationLoading : tk.stores.location}
            </button>
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
        <section className="space-y-6 border-t-2 border-stone-900 pt-5">
          <h2 className="text-xl font-semibold text-stone-900">{tk.stores.adminTitle}</h2>
          {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
          {notice && <p role="status" className="text-sm text-emerald-800">{notice}</p>}
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
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" disabled={busyStoreId === item.id} onClick={() => void changeStoreStatus(item.id, 'approved')} className="min-h-11 rounded-md bg-emerald-800 px-3 text-sm font-semibold text-white disabled:opacity-60">{tk.stores.approve}</button>
                  <button type="button" disabled={busyStoreId === item.id} onClick={() => void changeStoreStatus(item.id, 'suspended')} className="min-h-11 rounded-md border border-stone-400 px-3 text-sm font-semibold text-stone-800 disabled:opacity-60">{tk.stores.suspend}</button>
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
                      <p className="text-sm text-stone-500">{storeStatusLabel(item.status)}</p>
                    </div>
                    {item.status !== 'pending' && (
                      <button
                        type="button"
                        disabled={busyStoreId === item.id}
                        onClick={() => void changeStoreStatus(item.id, item.status === 'approved' ? 'suspended' : 'approved')}
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
        </section>
      )}
    </div>
  )
}

function PageSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div aria-hidden="true" className="mt-6 animate-pulse space-y-3">
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="h-19 rounded-md bg-stone-100" />
      ))}
    </div>
  )
}

function BuyerVideo({ videoPath }: { videoPath: string }) {
  const [open, setOpen] = useState(false)
  const videoUrl = supabase?.storage.from('store-videos').getPublicUrl(videoPath).data.publicUrl

  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="min-h-10 rounded-md border border-emerald-800 px-3 text-sm font-semibold text-emerald-900"
      >
        {open ? tk.buyer.closeVideo : tk.buyer.watchVideo}
      </button>
      {open && videoUrl && (
        <video src={videoUrl} controls playsInline preload="none" className="mt-3 aspect-video w-full rounded-md bg-black" />
      )}
    </div>
  )
}

function relativeTime(updatedAt: string) {
  const elapsedMinutes = Math.max(0, Math.floor((Date.now() - new Date(updatedAt).getTime()) / 60000))
  if (elapsedMinutes < 1) return tk.buyer.relativeTime.justNow
  if (elapsedMinutes < 60) return tk.buyer.relativeTime.minutes(elapsedMinutes)
  const elapsedHours = Math.floor(elapsedMinutes / 60)
  if (elapsedHours < 24) return tk.buyer.relativeTime.hours(elapsedHours)
  return tk.buyer.relativeTime.days(Math.floor(elapsedHours / 24))
}

export default function App() {
  const [activePage, setActivePage] = useState<PageKey>('home')
  const [isSignUp, setIsSignUp] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [categories, setCategories] = useState<Category[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [priceListings, setPriceListings] = useState<PriceListing[]>([])
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null)
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [categoriesLoading, setCategoriesLoading] = useState(true)
  const [productsLoading, setProductsLoading] = useState(false)
  const [pricesLoading, setPricesLoading] = useState(false)
  const [categoriesError, setCategoriesError] = useState(false)
  const [productsError, setProductsError] = useState(false)
  const [pricesError, setPricesError] = useState(false)
  const { user, role, loading, signIn, signUp, signOut } = useAuth()

  useEffect(() => {
    if (!supabase) {
      setCategoriesError(true)
      setCategoriesLoading(false)
      return
    }

    let active = true
    void supabase
      .from('categories')
      .select('id, name_tk')
      .order('name_tk')
      .then(({ data, error: requestError }) => {
        if (!active) return
        setCategories(data ?? [])
        setCategoriesError(Boolean(requestError))
        setCategoriesLoading(false)
      })

    return () => { active = false }
  }, [])

  useEffect(() => {
    const isHomeCategory = activePage === 'home' && selectedCategory
    const isSearch = activePage === 'search' && searchTerm.trim()
    if (!isHomeCategory && !isSearch) {
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

    let active = true
    setProductsLoading(true)
    setProductsError(false)
    let request = supabase.from('products').select('id, name_tk, unit')
    if (isHomeCategory) request = request.eq('category_id', selectedCategory.id)
    else request = request.ilike('name_tk', `%${searchTerm.trim()}%`)

    void request.order('name_tk').then(({ data, error: requestError }) => {
      if (!active) return
      setProducts(data ?? [])
      setProductsError(Boolean(requestError))
      setProductsLoading(false)
    })

    return () => { active = false }
  }, [activePage, selectedCategory, searchTerm])

  useEffect(() => {
    if (!selectedProduct) {
      setPriceListings([])
      setPricesError(false)
      setPricesLoading(false)
      return
    }
    if (!supabase) {
      setPricesError(true)
      setPricesLoading(false)
      return
    }

    let active = true
    setPricesLoading(true)
    setPricesError(false)
    void supabase
      .from('price_list')
      .select('price_id, price, in_stock, video_path, updated_at, store_name, product_id, product_name, unit')
      .eq('product_id', selectedProduct.id)
      .order('price', { ascending: true })
      .then(({ data, error: requestError }) => {
        if (!active) return
        setPriceListings((data ?? []) as PriceListing[])
        setPricesError(Boolean(requestError))
        setPricesLoading(false)
      })

    return () => { active = false }
  }, [selectedProduct])

  const handleAuth = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    setNotice('')

    if (!email.trim()) {
      setError(tk.form.emailRequired)
      return
    }
    if (!password) {
      setError(tk.form.passwordRequired)
      return
    }

    setSubmitting(true)
    const result = isSignUp
      ? await signUp(email.trim(), password)
      : await signIn(email.trim(), password)
    setSubmitting(false)

    if (result) {
      if (isSignUp && result === tk.auth.emailConfirmation) setNotice(result)
      else setError(result)
    } else if (isSignUp) {
      setNotice(tk.auth.signedUp)
      setPassword('')
    }
  }

  const handleSignOut = async () => {
    setError('')
    const result = await signOut()
    if (result) setError(result)
  }

  const openPage = (page: PageKey) => {
    setActivePage(page)
    setSelectedCategory(null)
    setSelectedProduct(null)
    setSearchTerm('')
  }

  const goBack = () => {
    if (selectedProduct) setSelectedProduct(null)
    else setSelectedCategory(null)
  }

  const pageTitle = selectedProduct?.name_tk ?? selectedCategory?.name_tk ?? tk.navigation[activePage]

  return (
    <div className="mx-auto min-h-dvh max-w-xl bg-white pb-24 shadow-sm">
      <header className="border-b border-stone-100 px-5 pb-5 pt-7">
        <p className="text-sm font-semibold tracking-wide text-emerald-800">
          {tk.appName}
        </p>
        <h1 className="mt-5 text-2xl font-semibold text-stone-900">{pageTitle}</h1>
        <p className="mt-1 text-sm text-stone-500">
          {selectedProduct ? tk.buyer.price : selectedCategory ? tk.buyer.products : tk.pageDescriptions[activePage]}
        </p>
      </header>

      <main className="px-5 py-1">
        {(selectedProduct || selectedCategory) && (
          <button
            type="button"
            onClick={goBack}
            className="mt-5 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-emerald-900"
          >
            <ArrowLeft aria-hidden="true" size={18} />
            {tk.buyer.back}
          </button>
        )}
        {selectedProduct ? (
          <section aria-label={selectedProduct.name_tk} className="mt-5 space-y-3">
            {pricesLoading ? <PageSkeleton /> : pricesError ? (
              <p role="alert" className="mt-8 text-sm text-red-700">{tk.buyer.loadError}</p>
            ) : priceListings.length === 0 ? (
              <p className="mt-8 text-center text-sm text-stone-500">{tk.buyer.empty}</p>
            ) : priceListings.map((listing) => {
              const isOld = Date.now() - new Date(listing.updated_at).getTime() > 24 * 60 * 60 * 1000
              return (
                <article
                  key={listing.price_id}
                  className={`border-b border-stone-200 py-4 ${isOld ? 'bg-stone-50 text-stone-400' : 'text-stone-800'}`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <h2 className="min-w-0 wrap-break-word font-semibold">{listing.store_name}</h2>
                    <p className="shrink-0 text-right text-lg font-bold tabular-nums">
                      {Number(listing.price).toFixed(2)} <span className="text-sm font-medium">{tk.buyer.currency}</span>
                    </p>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                    <span>{tk.buyer.unit}: {listing.unit}</span>
                    <span>{listing.in_stock ? tk.buyer.inStock : tk.buyer.outOfStock}</span>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                    <span>{tk.buyer.updated}: {relativeTime(listing.updated_at)}</span>
                    {isOld && <span className="font-semibold">{tk.buyer.oldData}</span>}
                  </div>
                  {listing.video_path && <BuyerVideo videoPath={listing.video_path} />}
                </article>
              )
            })}
          </section>
        ) : activePage === 'home' ? (
          <section className="mt-6">
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
                      onClick={() => setSelectedProduct(product)}
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
                      onClick={() => setSelectedCategory(category)}
                      className="flex min-h-16 w-full items-center justify-between gap-3 py-3 text-left font-semibold text-stone-800"
                    >
                      {category.name_tk}<ChevronRight aria-hidden="true" size={19} className="text-stone-500" />
                    </button>
                  ))}
                </div>
              </>
            )}
          </section>
        ) : activePage === 'search' ? (
          <section className="mt-6">
            <label className="relative block">
              <Search aria-hidden="true" size={19} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-500" />
              <input
                type="search"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
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
                    onClick={() => setSelectedProduct(product)}
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
        ) : activePage === 'profile' ? (
          loading ? (
            <p className="mt-8 text-sm text-stone-500">{tk.auth.loading}</p>
          ) : user ? (
            <section className="mt-8 space-y-5">
              <div className="border-b border-stone-200 pb-5">
                <p className="text-sm text-stone-500">{tk.auth.email}</p>
                <p className="mt-1 break-all font-medium text-stone-900">{user.email}</p>
              </div>
              <StoreProfile userId={user.id} role={role} />
              <button
                type="button"
                onClick={handleSignOut}
                className="min-h-12 w-full rounded-md bg-stone-900 px-4 font-semibold text-white transition-colors hover:bg-stone-700"
              >
                {tk.auth.signOut}
              </button>
              {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
            </section>
          ) : (
            <section className="mt-8">
              <form onSubmit={handleAuth} className="space-y-4">
                <label className="block space-y-2 text-sm font-medium text-stone-700">
                  <span>{tk.auth.email}</span>
                  <input
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    className="min-h-12 w-full rounded-md border border-stone-300 bg-white px-3 text-base text-stone-900 outline-none focus:border-emerald-800 focus:ring-2 focus:ring-emerald-800/15"
                  />
                </label>
                <label className="block space-y-2 text-sm font-medium text-stone-700">
                  <span>{tk.auth.password}</span>
                  <input
                    type="password"
                    autoComplete={isSignUp ? 'new-password' : 'current-password'}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    className="min-h-12 w-full rounded-md border border-stone-300 bg-white px-3 text-base text-stone-900 outline-none focus:border-emerald-800 focus:ring-2 focus:ring-emerald-800/15"
                  />
                </label>
                {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
                {notice && <p role="status" className="text-sm text-emerald-800">{notice}</p>}
                <button
                  type="submit"
                  disabled={submitting}
                  className="min-h-12 w-full rounded-md bg-emerald-800 px-4 font-semibold text-white transition-colors hover:bg-emerald-900 disabled:cursor-wait disabled:opacity-60"
                >
                  {submitting
                    ? isSignUp ? tk.auth.signingUp : tk.auth.signingIn
                    : isSignUp ? tk.auth.createAccount : tk.auth.signIn}
                </button>
              </form>
              <button
                type="button"
                onClick={() => {
                  setIsSignUp(!isSignUp)
                  setError('')
                  setNotice('')
                }}
                className="mt-4 min-h-11 w-full text-sm font-medium text-emerald-900 underline underline-offset-4"
              >
                {isSignUp ? tk.auth.haveAccount : tk.auth.needAccount}
              </button>
            </section>
          )
        ) : activePage === 'basket' && !loading && !user ? (
          <section className="mt-8 border-l-4 border-emerald-800 py-2 pl-4">
            <h2 className="text-lg font-semibold text-stone-900">{tk.basketAuth.title}</h2>
            <p className="mt-1 text-sm text-stone-600">{tk.basketAuth.description}</p>
            <button
              type="button"
              onClick={() => setActivePage('profile')}
              className="mt-4 inline-flex min-h-11 items-center gap-2 font-semibold text-emerald-900"
            >
              {tk.basketAuth.goToProfile}
              <ArrowRight aria-hidden="true" size={18} />
            </button>
          </section>
        ) : activePage === 'basket' ? (
          <PageSkeleton />
        ) : null}
      </main>

      <nav
        aria-label={tk.navigationLabel}
        className="fixed inset-x-0 bottom-0 z-10 mx-auto grid max-w-xl grid-cols-4 border-t border-stone-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur"
      >
        {navigation.map(({ key, icon: Icon }) => {
          const isActive = activePage === key

          return (
            <button
              key={key}
              type="button"
              aria-current={isActive ? 'page' : undefined}
              onClick={() => openPage(key)}
              className={`flex min-h-16 flex-col items-center justify-center gap-1 text-xs font-medium transition-colors ${
                isActive ? 'text-emerald-800' : 'text-stone-500'
              }`}
            >
              <Icon aria-hidden="true" size={20} strokeWidth={isActive ? 2.3 : 1.8} />
              <span>{tk.navigation[key]}</span>
            </button>
          )
        })}
      </nav>
    </div>
  )
}