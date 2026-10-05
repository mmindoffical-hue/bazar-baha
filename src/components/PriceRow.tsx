import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, Image as ImageIcon, X } from 'lucide-react'
import { tk } from '../i18n/tk'
import { relativeTime } from '../lib/formatting'
import { supabase } from '../lib/supabase'
import type { PriceListing } from '../lib/types'
import { thumbnailPathFor } from '../lib/productPhotos'

export function PriceRow({ listing }: { listing: PriceListing }) {
  const isOld = Date.now() - new Date(listing.updated_at).getTime() > 24 * 60 * 60 * 1000
  const [viewerIndex, setViewerIndex] = useState<number | null>(null)
  const [thumbnailLoaded, setThumbnailLoaded] = useState(false)
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
