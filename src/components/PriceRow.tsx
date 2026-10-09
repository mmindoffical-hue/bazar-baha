import { useEffect, useState, type FormEvent } from 'react'
import { ChevronLeft, ChevronRight, Image as ImageIcon, X } from 'lucide-react'
import { tk } from '../i18n/tk'
import { relativeTime } from '../lib/formatting'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import type { PriceListing } from '../lib/types'
import { thumbnailPathFor } from '../lib/productPhotos'

export function PriceRow({ listing, onOpenProfile }: { listing: PriceListing; onOpenProfile: () => void }) {
  const isOld = Date.now() - new Date(listing.updated_at).getTime() > 24 * 60 * 60 * 1000
  const { user } = useAuth()
  const [viewerIndex, setViewerIndex] = useState<number | null>(null)
  const [thumbnailLoaded, setThumbnailLoaded] = useState(false)
  const [reportOpen, setReportOpen] = useState(false)
  const [reportReason, setReportReason] = useState('')
  const [reportError, setReportError] = useState('')
  const [reportNotice, setReportNotice] = useState('')
  const [reporting, setReporting] = useState(false)
  const photoPaths = listing.photo_paths ?? []
  const thumbnailUrl = photoPaths[0] && supabase
    ? supabase.storage.from('product-photos').getPublicUrl(thumbnailPathFor(photoPaths[0])).data.publicUrl
    : ''
  const viewerUrl = viewerIndex !== null && photoPaths[viewerIndex] && supabase
    ? supabase.storage.from('product-photos').getPublicUrl(photoPaths[viewerIndex]).data.publicUrl
    : ''

  useEffect(() => {
    if (viewerIndex === null) return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setViewerIndex(null)
      if (event.key === 'ArrowLeft') setViewerIndex((current) => current === null ? null : Math.max(0, current - 1))
      if (event.key === 'ArrowRight') setViewerIndex((current) => current === null ? null : Math.min(photoPaths.length - 1, current + 1))
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [viewerIndex, photoPaths.length])

  const submitReport = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setReportError('')
    setReportNotice('')
    if (!supabase || !user) {
      setReportError(tk.reports.genericError)
      return
    }
    setReporting(true)
    const { error } = await supabase.from('reports').insert({
      price_id: listing.price_id,
      reporter_id: user.id,
      reason: reportReason.trim() || null,
    })
    setReporting(false)
    if (error) {
      setReportError(error.code === '23505' ? tk.reports.duplicate : tk.reports.genericError)
      return
    }
    setReportNotice(tk.reports.success)
    setReportOpen(false)
    setReportReason('')
  }

  return (
    <article
      className={`border-b border-stone-200 py-4 ${isOld ? 'bg-stone-50 text-stone-400' : 'text-stone-800'}`}
    >
      <div className="flex items-start gap-3">
        <button
          type="button"
          onClick={() => photoPaths.length > 0 && setViewerIndex(0)}
          disabled={photoPaths.length === 0}
          aria-label={photoPaths.length > 0 ? tk.buyer.viewPhoto : tk.buyer.noPhoto}
          className="relative h-16 w-16 shrink-0 overflow-hidden rounded bg-stone-200 disabled:cursor-default"
        >
          {thumbnailUrl ? (
            <img
              src={thumbnailUrl}
              alt={tk.buyer.productPhoto}
              loading="lazy"
              onLoad={() => setThumbnailLoaded(true)}
              className={`absolute inset-0 h-full w-full object-cover transition-opacity ${thumbnailLoaded ? 'opacity-100' : 'opacity-0'}`}
            />
          ) : <ImageIcon aria-hidden="true" size={22} className="absolute inset-0 m-auto text-stone-500" />}
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <h2 className="min-w-0 wrap-break-word font-semibold">{listing.store_name}</h2>
            <p className="shrink-0 text-right text-lg font-bold tabular-nums">
              {Number(listing.price).toFixed(2)} <span className="text-sm font-medium">{tk.buyer.currency}</span>
            </p>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
            <span>{tk.buyer.unit}: {listing.unit}</span>
            <span>{listing.in_stock ? tk.buyer.inStock : tk.buyer.outOfStock}</span>
          </div>
        </div>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
        <span>{tk.buyer.updated}: {relativeTime(listing.updated_at)}</span>
        {isOld && <span className="font-semibold">{tk.buyer.oldData}</span>}
      </div>
      <div className="mt-2">
        <button type="button" onClick={() => {
          setReportError('')
          setReportNotice('')
          if (!user) setReportError(tk.reports.signInRequired)
          else setReportOpen(true)
        }} className="min-h-10 text-xs font-semibold text-red-700 underline underline-offset-2">
          {tk.reports.reportPrice}
        </button>
        {reportError === tk.reports.signInRequired && (
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
            <span role="alert">{reportError}</span>
            <button type="button" onClick={onOpenProfile} className="font-semibold underline">{tk.auth.signIn}</button>
          </div>
        )}
        {reportNotice && <p role="status" className="mt-1 text-xs text-emerald-800">{reportNotice}</p>}
        {reportOpen && (
          <div role="dialog" aria-modal="true" aria-label={tk.reports.reportPrice} className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4">
            <form onSubmit={(event) => void submitReport(event)} className="w-full max-w-sm space-y-4 rounded-md bg-white p-5 shadow-xl">
              <div className="flex items-center justify-between gap-3">
                <h2 className="font-semibold text-stone-900">{tk.reports.reportPrice}</h2>
                <button type="button" onClick={() => setReportOpen(false)} aria-label={tk.reports.close} className="flex h-10 w-10 items-center justify-center text-stone-700"><X aria-hidden="true" size={20} /></button>
              </div>
              <label className="block space-y-2 text-sm font-medium text-stone-700">
                <span>{tk.reports.reason}</span>
                <textarea value={reportReason} maxLength={300} onChange={(event) => setReportReason(event.target.value)} rows={4} className="w-full rounded-md border border-stone-300 p-3 text-base outline-none focus:border-emerald-800" />
              </label>
              {reportError && <p role="alert" className="text-sm text-red-700">{reportError}</p>}
              <button type="submit" disabled={reporting} className="min-h-11 w-full rounded-md bg-emerald-800 px-4 font-semibold text-white disabled:opacity-60">{reporting ? tk.reports.sending : tk.reports.send}</button>
            </form>
          </div>
        )}
      </div>
      {viewerIndex !== null && viewerUrl && (
        <div role="dialog" aria-modal="true" aria-label={tk.buyer.photoViewer} className="fixed inset-0 z-50 flex items-center justify-center bg-black">
          <button type="button" onClick={() => setViewerIndex(null)} aria-label={tk.buyer.closePhotoViewer} className="absolute right-4 top-4 z-10 flex h-11 w-11 items-center justify-center rounded-full bg-black/60 text-white">
            <X aria-hidden="true" size={24} />
          </button>
          <img src={viewerUrl} alt={tk.buyer.productPhoto} className="max-h-full max-w-full object-contain" />
          {photoPaths.length > 1 && (
            <>
              <button type="button" onClick={() => setViewerIndex((current) => current === null ? null : Math.max(0, current - 1))} disabled={viewerIndex === 0} aria-label={tk.buyer.previousPhoto} className="absolute left-3 flex h-11 w-11 items-center justify-center rounded-full bg-black/60 text-white disabled:opacity-40">
                <ChevronLeft aria-hidden="true" size={26} />
              </button>
              <button type="button" onClick={() => setViewerIndex((current) => current === null ? null : Math.min(photoPaths.length - 1, current + 1))} disabled={viewerIndex === photoPaths.length - 1} aria-label={tk.buyer.nextPhoto} className="absolute right-3 flex h-11 w-11 items-center justify-center rounded-full bg-black/60 text-white disabled:opacity-40">
                <ChevronRight aria-hidden="true" size={26} />
              </button>
              <span className="absolute bottom-5 left-1/2 -translate-x-1/2 rounded-full bg-black/60 px-3 py-1 text-sm text-white">
                {viewerIndex + 1}/{photoPaths.length}
              </span>
            </>
          )}
        </div>
      )}
    </article>
  )
}
