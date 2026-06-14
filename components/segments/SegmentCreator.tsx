'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import type { Map as MapboxMap, Marker, GeoJSONSource } from 'mapbox-gl'
import { cumulativeMeters, haversineM, type LatLng } from '@/lib/segments'
import { formatDistance } from '@/lib/units'
import { useUnit } from '@/lib/useUnit'

const TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN

interface RunOption {
  id: string
  name: string
  date: string
}

interface Selection {
  start: number | null
  end: number | null
}

export default function SegmentCreator({
  runs,
  runId,
  coordinates,
}: {
  runs: RunOption[]
  runId: string
  coordinates: LatLng[]
}) {
  const router = useRouter()
  const { unit } = useUnit()

  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MapboxMap | null>(null)
  const markersRef = useRef<{ start: Marker | null; end: Marker | null }>({
    start: null,
    end: null,
  })
  const selRef = useRef<Selection>({ start: null, end: null })

  const [selection, setSelection] = useState<Selection>({ start: null, end: null })
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [mapError, setMapError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const cum = useMemo(() => cumulativeMeters(coordinates), [coordinates])

  useEffect(() => {
    if (!containerRef.current || coordinates.length < 2) {
      setLoading(false)
      return
    }
    if (!TOKEN || TOKEN === 'your_mapbox_token_here') {
      setLoading(false)
      setMapError('Add NEXT_PUBLIC_MAPBOX_TOKEN to .env.local to draw segments.')
      return
    }

    let cancelled = false
    selRef.current = { start: null, end: null }
    setSelection({ start: null, end: null })

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
      map.getCanvas().style.cursor = 'crosshair'

      map.on('error', e => {
        if (cancelled) return
        setLoading(false)
        setMapError(e?.error?.message ?? 'Failed to load map.')
      })

      const lineFor = (sel: Selection) => ({
        type: 'Feature' as const,
        properties: {},
        geometry: {
          type: 'LineString' as const,
          coordinates:
            sel.start !== null && sel.end !== null
              ? lngLats.slice(sel.start, sel.end + 1)
              : [],
        },
      })

      const redraw = () => {
        const sel = selRef.current
        ;(map.getSource('selection') as GeoJSONSource | undefined)?.setData(lineFor(sel))

        for (const key of ['start', 'end'] as const) {
          const idx = sel[key]
          const existing = markersRef.current[key]
          if (idx === null) {
            existing?.remove()
            markersRef.current[key] = null
          } else if (existing) {
            existing.setLngLat(lngLats[idx])
          } else {
            markersRef.current[key] = new mapboxgl.Marker({
              color: key === 'start' ? '#22c55e' : '#ef4444',
              scale: 0.75,
            })
              .setLngLat(lngLats[idx])
              .addTo(map)
          }
        }
        setSelection({ ...sel })
      }

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
          paint: { 'line-color': '#3b82f6', 'line-width': 3.5, 'line-opacity': 0.5 },
        })

        map.addSource('selection', { type: 'geojson', data: lineFor(selRef.current) })
        map.addLayer({
          id: 'selection-line',
          type: 'line',
          source: 'selection',
          layout: { 'line-join': 'round', 'line-cap': 'round' },
          paint: { 'line-color': '#f97316', 'line-width': 4.5, 'line-opacity': 0.95 },
        })

        map.on('click', e => {
          // Snap the click to the nearest point on the run's track
          const clicked: LatLng = { lat: e.lngLat.lat, lng: e.lngLat.lng }
          let idx = 0
          let bestDist = Infinity
          for (let i = 0; i < coordinates.length; i++) {
            const d = haversineM(coordinates[i], clicked)
            if (d < bestDist) {
              bestDist = d
              idx = i
            }
          }

          const sel = selRef.current
          if (sel.start === null) {
            sel.start = idx
          } else if (sel.end === null) {
            if (idx === sel.start) return
            selRef.current = {
              start: Math.min(sel.start, idx),
              end: Math.max(sel.start, idx),
            }
          } else {
            // Both placed — move whichever endpoint is closer along the track
            if (Math.abs(idx - sel.start) <= Math.abs(idx - sel.end!)) sel.start = idx
            else sel.end = idx
            if (sel.start! > sel.end!) {
              selRef.current = { start: sel.end, end: sel.start }
            }
          }
          redraw()
        })

        setLoading(false)
      })
    })().catch(() => {
      if (!cancelled) {
        setLoading(false)
        setMapError('Failed to load map.')
      }
    })

    return () => {
      cancelled = true
      markersRef.current = { start: null, end: null }
      mapRef.current?.remove()
      mapRef.current = null
    }
  }, [coordinates])

  const selectionMeters =
    selection.start !== null && selection.end !== null
      ? cum[selection.end] - cum[selection.start]
      : null

  function clearSelection() {
    selRef.current = { start: null, end: null }
    for (const key of ['start', 'end'] as const) {
      markersRef.current[key]?.remove()
      markersRef.current[key] = null
    }
    const source = mapRef.current?.getSource('selection') as GeoJSONSource | undefined
    source?.setData({
      type: 'Feature',
      properties: {},
      geometry: { type: 'LineString', coordinates: [] },
    })
    setSelection({ start: null, end: null })
  }

  async function save() {
    if (selection.start === null || selection.end === null) return
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/segments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          activityId: runId,
          startIdx: selection.start,
          endIdx: selection.end,
        }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        setError(data?.error ?? 'Failed to save segment')
        setSaving(false)
        return
      }
      router.push(`/segments?segment=${data.id}`)
    } catch {
      setError('Failed to save segment')
      setSaving(false)
    }
  }

  const step =
    selection.start === null
      ? 'Click the map where the segment starts.'
      : selection.end === null
        ? 'Now click where it ends.'
        : 'Click again to adjust either endpoint, or save.'

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900">New Segment</h1>
          <p className="text-sm text-zinc-500 mt-0.5">
            Trace a stretch of road from one of your runs — every past and future run
            on it will be compared automatically.
          </p>
        </div>
        <select
          value={runId}
          onChange={e => router.push(`/segments/new?run=${e.target.value}`)}
          className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-900"
        >
          {runs.map(r => (
            <option key={r.id} value={r.id}>
              {format(new Date(r.date), 'MMM d, yyyy')} — {r.name}
            </option>
          ))}
        </select>
      </div>

      <div className="bg-white rounded-2xl border border-zinc-200 p-6 space-y-4">
        <p className="text-sm text-zinc-500">{step}</p>

        <div className="relative h-96 rounded-lg overflow-hidden bg-zinc-50">
          <div ref={containerRef} className="absolute inset-0" />
          {(loading || mapError || coordinates.length < 2) && (
            <div className="absolute inset-0 flex items-center justify-center bg-zinc-50 text-sm text-zinc-400 px-6 text-center">
              {mapError ?? (coordinates.length < 2 ? 'No GPS data for this run' : 'Loading map…')}
            </div>
          )}
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Segment name (e.g. East River 5K stretch)"
            className="flex-1 min-w-48 rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400"
          />
          {selectionMeters !== null ? (
            <span className="text-sm text-zinc-500">
              {formatDistance(selectionMeters / 1000, unit)} selected
            </span>
          ) : null}
          <button
            onClick={clearSelection}
            disabled={selection.start === null}
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-600 hover:text-zinc-900 disabled:opacity-40 transition-colors"
          >
            Clear
          </button>
          <button
            onClick={save}
            disabled={saving || !name.trim() || selection.start === null || selection.end === null}
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-40 transition-colors"
          >
            {saving ? 'Matching runs…' : 'Save segment'}
          </button>
        </div>

        {error ? <p className="text-sm text-red-600">{error}</p> : null}
      </div>
    </div>
  )
}
