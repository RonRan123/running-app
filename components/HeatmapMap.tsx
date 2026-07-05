'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import type { Map as MapboxMap, GeoJSONSource } from 'mapbox-gl'
import { endOfDay, startOfDay } from 'date-fns'
import DateRangeSlider from '@/components/DateRangeSlider'

interface GeoActivity {
  id: string
  date: string
  coordinates: { lat: number; lng: number }[]
}

interface Track {
  ts: number
  coordinates: [number, number][]
}

const TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN

function hasToken() {
  return Boolean(TOKEN && TOKEN !== 'your_mapbox_token_here')
}

function toFeatureCollection(tracks: Track[]) {
  return {
    type: 'FeatureCollection' as const,
    features: tracks.map(t => ({
      type: 'Feature' as const,
      properties: {},
      geometry: { type: 'LineString' as const, coordinates: t.coordinates },
    })),
  }
}

export default function HeatmapMap() {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MapboxMap | null>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'empty' | 'error'>('loading')
  const [message, setMessage] = useState<string | null>(null)
  const [tracks, setTracks] = useState<Track[]>([])
  // null = all-time (the default view)
  const [range, setRange] = useState<{ from: Date; to: Date } | null>(null)

  const domain = useMemo(() => {
    if (tracks.length === 0) return null
    const times = tracks.map(t => t.ts)
    return {
      min: startOfDay(new Date(Math.min(...times))),
      max: startOfDay(new Date(Math.max(...times))),
    }
  }, [tracks])

  const visibleTracks = useMemo(() => {
    if (!range) return tracks
    const from = startOfDay(range.from).getTime()
    const to = endOfDay(range.to).getTime()
    return tracks.filter(t => t.ts >= from && t.ts <= to)
  }, [tracks, range])

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

      const loaded: Track[] = activities
        .map(a => ({
          ts: new Date(a.date).getTime(),
          coordinates: (a.coordinates ?? [])
            .filter(p => typeof p?.lat === 'number' && typeof p?.lng === 'number')
            .map(p => [p.lng, p.lat] as [number, number]),
        }))
        .filter(t => t.coordinates.length > 1)

      if (loaded.length === 0) {
        setStatus('empty')
        return
      }
      setTracks(loaded)

      const mapboxgl = (await import('mapbox-gl')).default
      if (cancelled || !containerRef.current) return

      mapboxgl.accessToken = TOKEN as string

      const map = new mapboxgl.Map({
        container: containerRef.current,
        style: 'mapbox://styles/mapbox/dark-v11',
        // Default view: Manhattan. Tracks elsewhere are reachable by panning.
        center: [-73.9712, 40.7831],
        zoom: 11.5,
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
          data: toFeatureCollection(loaded),
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

  // Push the date-filtered track set into the existing map source.
  useEffect(() => {
    if (status !== 'ready') return
    const source = mapRef.current?.getSource('tracks') as GeoJSONSource | undefined
    source?.setData(toFeatureCollection(visibleTracks))
  }, [visibleTracks, status])

  return (
    <div className="space-y-4">
      {status === 'ready' && domain && (
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex-1 min-w-64">
            <DateRangeSlider
              min={domain.min}
              max={domain.max}
              from={range?.from ?? domain.min}
              to={range?.to ?? domain.max}
              onChange={(from, to) => setRange({ from, to })}
            />
          </div>
          {range && (
            <button
              onClick={() => setRange(null)}
              className="text-sm text-zinc-500 hover:text-zinc-900 border border-zinc-200 rounded-lg px-3 py-2 bg-white transition-colors"
            >
              Reset to all time
            </button>
          )}
        </div>
      )}
      {status === 'ready' && range && (
        <p className="text-xs text-zinc-500">
          Showing {visibleTracks.length} of {tracks.length} runs with GPS.
        </p>
      )}

      <div className="relative h-[calc(100vh-18rem)] min-h-[400px] w-full bg-zinc-900 rounded-2xl border border-zinc-200 overflow-hidden">
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
    </div>
  )
}
