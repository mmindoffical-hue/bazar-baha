import { tk } from '../i18n/tk'

export function OfflineDataNotice({ fetchedAt }: { fetchedAt: number | null }) {
  if (fetchedAt === null) return null
  const hours = Math.max(0, Math.floor((Date.now() - fetchedAt) / 3_600_000))

  return (
    <p role="status" className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900">
      {tk.buyer.cachedData(hours)}
    </p>
  )
}
