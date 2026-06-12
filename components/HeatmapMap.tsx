'use client'

import { useEffect, useRef, useState } from 'react'
import type { Map as MapboxMap } from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'

interface GeoActivity {
  id: string
  coordinates: { lat: number; lng: number }[]
}

const TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN

function hasToken() {
  return Boolean(TOKEN && TOKEN !== 'your_mapbox_token_here')
}

export default function HeatmapMap() {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MapboxMap | null>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'empty' | 'error'>('loading')
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    if (!containerRef.current) return
    if (!hasToken()) {
      setStatus('error')
      setMessage('Add NEXT_PUBLIC_MAPBOX_TOKEN to .env.local to see the heatmap.')
      return
    }

    let cancelled = false

    ;(async () => {
      const res = await fetch('/api/activities/geo')
      if (!res.ok) throw new Error(`Failed to load tracks (${res.status})`)
      const activities: GeoActivity[] = await res.json()
      if (cancelled || !containerRef.current) return

      const tracks = activities
        .map(a =>
          (a.coordinates ?? [])
            .filter(p => typeof p?.lat === 'number' && typeof p?.lng === 'number')
            .map(p => [p.lng, p.lat] as [number, number]),
        )
        .filter(t => t.length > 1)

      if (tracks.length === 0) {
        setStatus('empty')
        return
      }

      const mapboxgl = (await import('mapbox-gl')).default
      if (cancelled || !containerRef.current) return

      mapboxgl.accessToken = TOKEN as string

      const first = tracks[0][0]
      const bounds = new mapboxgl.LngLatBounds(first, first)
      for (const track of tracks) {
        for (const c of track) bounds.extend(c)
      }

      const map = new mapboxgl.Map({
        container: containerRef.current,
        style: 'mapbox://styles/mapbox/dark-v11',
        bounds,
        fitBoundsOptions: { padding: 60 },
        attributionControl: false,
      })
      mapRef.current = map

      map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'top-right')
      map.addControl(new mapboxgl.AttributionControl({ compact: true }))

      map.on('error', e => {
        if (cancelled) return
        setStatus('error')
        setMessage(e?.error?.message ?? 'Failed to load map.')
      })

      map.on('load', () => {
        if (cancelled) return

        map.addSource('tracks', {
          type: 'geojson',
          data: {
            type: 'FeatureCollection',
            features: tracks.map(coordinates => ({
              type: 'Feature' as const,
              properties: {},
              geometry: { type: 'LineString' as const, coordinates },
            })),
          },
        })

        // Wide, faint glow underneath
        map.addLayer({
          id: 'tracks-glow',
          type: 'line',
          source: 'tracks',
          layout: { 'line-join': 'round', 'line-cap': 'round' },
          paint: {
            'line-color': '#f97316',
            'line-width': 5,
            'line-opacity': 0.08,
            'line-blur': 3,
          },
        })

        // Core lines — overlap builds up the heatmap effect
        map.addLayer({
          id: 'tracks-core',
          type: 'line',
          source: 'tracks',
          layout: { 'line-join': 'round', 'line-cap': 'round' },
          paint: {
            'line-color': '#fb923c',
            'line-width': 1.5,
            'line-opacity': 0.35,
          },
        })

        setStatus('ready')
      })
    })().catch(err => {
      if (!cancelled) {
        setStatus('error')
        setMessage(err instanceof Error ? err.message : 'Failed to load heatmap.')
      }
    })

    return () => {
      cancelled = true
      mapRef.current?.remove()
      mapRef.current = null
    }
  }, [])

  return (
    <div className="relative h-full w-full bg-zinc-900">
      <div ref={containerRef} className="absolute inset-0" />
      {status !== 'ready' && (
        <div className="absolute inset-0 flex items-center justify-center text-sm text-zinc-400 px-6 text-center">
          {status === 'loading' && 'Loading heatmap…'}
          {status === 'empty' &&
            'No GPS tracks yet. Sync from Intervals.icu or upload GPX/FIT files with GPS data.'}
          {status === 'error' && (message ?? 'Something went wrong.')}
        </div>
      )}
    </div>
  )
}
