'use client'

import { useEffect, useRef, useState } from 'react'
import type { Map as MapboxMap } from 'mapbox-gl'

export interface RoutePoint {
  lat: number
  lng: number
}

const TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN

function hasToken() {
  return Boolean(TOKEN && TOKEN !== 'your_mapbox_token_here')
}

export default function RouteMap({ coordinates }: { coordinates: RoutePoint[] }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MapboxMap | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!containerRef.current || coordinates.length === 0) return
    if (!hasToken()) {
      setLoading(false)
      setError('Add NEXT_PUBLIC_MAPBOX_TOKEN to .env.local to see the route map.')
      return
    }

    let cancelled = false

    ;(async () => {
      // Dynamic import — mapbox-gl touches browser APIs, keep it out of SSR
      const mapboxgl = (await import('mapbox-gl')).default
      if (cancelled || !containerRef.current) return

      mapboxgl.accessToken = TOKEN as string

      const lngLats = coordinates.map(p => [p.lng, p.lat] as [number, number])

      const bounds = lngLats.reduce(
        (b, c) => b.extend(c),
        new mapboxgl.LngLatBounds(lngLats[0], lngLats[0]),
      )

      const map = new mapboxgl.Map({
        container: containerRef.current,
        style: 'mapbox://styles/mapbox/light-v11',
        bounds,
        fitBoundsOptions: { padding: 40 },
        attributionControl: false,
      })
      mapRef.current = map

      map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'top-right')
      map.addControl(new mapboxgl.AttributionControl({ compact: true }))

      map.on('error', e => {
        if (cancelled) return
        setLoading(false)
        setError(e?.error?.message ?? 'Failed to load map.')
      })

      map.on('load', () => {
        if (cancelled) return

        map.addSource('route', {
          type: 'geojson',
          data: {
            type: 'Feature',
            properties: {},
            geometry: { type: 'LineString', coordinates: lngLats },
          },
        })

        map.addLayer({
          id: 'route-line',
          type: 'line',
          source: 'route',
          layout: { 'line-join': 'round', 'line-cap': 'round' },
          paint: {
            'line-color': '#3b82f6',
            'line-width': 3.5,
            'line-opacity': 0.9,
          },
        })

        // Start / end markers
        new mapboxgl.Marker({ color: '#22c55e', scale: 0.75 })
          .setLngLat(lngLats[0])
          .addTo(map)
        new mapboxgl.Marker({ color: '#ef4444', scale: 0.75 })
          .setLngLat(lngLats[lngLats.length - 1])
          .addTo(map)

        setLoading(false)
      })
    })().catch(() => {
      if (!cancelled) {
        setLoading(false)
        setError('Failed to load map.')
      }
    })

    return () => {
      cancelled = true
      mapRef.current?.remove()
      mapRef.current = null
    }
  }, [coordinates])

  if (coordinates.length === 0) {
    return (
      <div className="h-80 rounded-lg bg-zinc-50 flex items-center justify-center text-zinc-400 text-sm">
        No GPS data for this run
      </div>
    )
  }

  return (
    <div className="relative h-80 rounded-lg overflow-hidden bg-zinc-50">
      <div ref={containerRef} className="absolute inset-0" />
      {(loading || error) && (
        <div className="absolute inset-0 flex items-center justify-center bg-zinc-50 text-sm text-zinc-400 px-6 text-center">
          {error ?? 'Loading map…'}
        </div>
      )}
    </div>
  )
}
