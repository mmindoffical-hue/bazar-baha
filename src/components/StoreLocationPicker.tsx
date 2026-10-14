import { useEffect, useRef, useState } from 'react'
import { tk } from '../i18n/tk'
import { L } from './leafletSetup'
import 'leaflet/dist/leaflet.css'

export default function StoreLocationPicker({ lat, lng, onChange }: {
  lat: number | null
  lng: number | null
  onChange: (lat: number, lng: number) => void
}) {
  const elementRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const markerRef = useRef<L.Marker | null>(null)
  const onChangeRef = useRef(onChange)
  const [offline, setOffline] = useState(!navigator.onLine)

  onChangeRef.current = onChange

  useEffect(() => {
    const element = elementRef.current
    if (!element) return

    const center: L.LatLngExpression = lat !== null && lng !== null
      ? [lat, lng]
      : [37.95, 58.38]
    const map = L.map(element, { scrollWheelZoom: false, zoomControl: false }).setView(center, lat !== null ? 15 : 12)
    L.control.zoom({ zoomInTitle: tk.buyer.zoomIn, zoomOutTitle: tk.buyer.zoomOut }).addTo(map)
    mapRef.current = map
    const tiles = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map)
    tiles.on('tileerror', () => setOffline(true))

    const placeMarker = (point: L.LatLng) => {
      if (!markerRef.current) {
        markerRef.current = L.marker(point, { draggable: true }).addTo(map)
        markerRef.current.on('dragend', () => {
          const current = markerRef.current?.getLatLng()
          if (current) onChangeRef.current(current.lat, current.lng)
        })
      } else {
        markerRef.current.setLatLng(point)
      }
      onChangeRef.current(point.lat, point.lng)
    }

    map.on('click', (event: L.LeafletMouseEvent) => placeMarker(event.latlng))
    const handleOnline = () => setOffline(false)
    const handleOffline = () => setOffline(true)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    const resizeObserver = new ResizeObserver(() => map.invalidateSize())
    resizeObserver.observe(element)
    requestAnimationFrame(() => map.invalidateSize())

    return () => {
      resizeObserver.disconnect()
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      map.remove()
      mapRef.current = null
      markerRef.current = null
    }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (!map || lat === null || lng === null) return
    const point = L.latLng(lat, lng)
    if (!markerRef.current) markerRef.current = L.marker(point, { draggable: true }).addTo(map)
    else markerRef.current.setLatLng(point)
    markerRef.current.off('dragend')
    markerRef.current.on('dragend', () => {
      const current = markerRef.current?.getLatLng()
      if (current) onChangeRef.current(current.lat, current.lng)
    })
    map.setView(point, Math.max(map.getZoom(), 15))
  }, [lat, lng])

  return (
    <div className="space-y-2">
      <div ref={elementRef} className="store-location-map h-56 w-full overflow-hidden rounded-md border border-stone-300" />
      {offline && <p role="status" className="text-xs text-amber-800">{tk.buyer.mapOffline}</p>}
    </div>
  )
}
