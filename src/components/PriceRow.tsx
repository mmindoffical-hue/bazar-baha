import { tk } from '../i18n/tk'
import { relativeTime } from '../lib/formatting'
import type { PriceListing } from '../lib/types'
import { BuyerVideo } from './BuyerVideo'

export function PriceRow({ listing }: { listing: PriceListing }) {
  const isOld = Date.now() - new Date(listing.updated_at).getTime() > 24 * 60 * 60 * 1000

  return (
    <article
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
}
