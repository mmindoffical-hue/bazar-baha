import { useEffect, useRef, useState } from 'react'
import { tk } from '../i18n/tk'

export function OfflineDataNotice({ fetchedAt, refreshing = false, active = true }: {
  fetchedAt: number | null
  refreshing?: boolean
  active?: boolean
}) {
  const [offline, setOffline] = useState(false)
  const [visible, setVisible] = useState(false)
  const shownAt = useRef<number | null>(null)
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    let offlineTimer: ReturnType<typeof setTimeout> | null = null
    const handleOnline = () => {
      if (offlineTimer) clearTimeout(offlineTimer)
      offlineTimer = null
      setOffline(false)
    }
    const handleOffline = () => {
      if (offlineTimer) clearTimeout(offlineTimer)
      offlineTimer = setTimeout(() => {
        setOffline(true)
        offlineTimer = null
      }, 2000)
    }
    if (navigator.onLine) setOffline(false)
    else handleOffline()
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      if (offlineTimer) clearTimeout(offlineTimer)
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  useEffect(() => {
    if (hideTimer.current) clearTimeout(hideTimer.current)
    hideTimer.current = null

    if (!active || refreshing) {
      shownAt.current = null
      setVisible(false)
      return
    }

    if (fetchedAt !== null || offline) {
      if (!visible) {
        shownAt.current = Date.now()
        setVisible(true)
      }
      return
    }

    if (!visible || shownAt.current === null) return
    const remaining = Math.max(0, 4000 - (Date.now() - shownAt.current))
    hideTimer.current = setTimeout(() => {
      shownAt.current = null
      setVisible(false)
      hideTimer.current = null
    }, remaining)
    return () => {
      if (hideTimer.current) clearTimeout(hideTimer.current)
      hideTimer.current = null
    }
  }, [active, fetchedAt, offline, refreshing, visible])

  useEffect(() => () => {
    if (hideTimer.current) clearTimeout(hideTimer.current)
  }, [])

  if (!visible || !active || refreshing) return null
  const hours = fetchedAt === null ? 0 : Math.max(0, Math.floor((Date.now() - fetchedAt) / 3_600_000))

  return (
    <p role="status" className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900">
      {tk.buyer.cachedData(hours)}
    </p>
  )
}
