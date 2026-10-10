'use client'

import { useEffect, useRef, useState } from 'react'
import type { GeoJSONSource, Map as MapboxMap } from 'mapbox-gl'

const TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN

export interface MapSegment {
  id: string
  name: string
  color: string
  geometry: { lat: number; lng: number }[]
}

function toFeatures(segments: MapSegment[], selectedId: string | null) {
  return {
    type: 'FeatureCollection' as const,
    features: segments.map(s => ({
      type: 'Feature' as const,
      properties: { id: s.id, color: s.color, selected: s.id === selectedId ? 1 : 0 },
      geometry: {
        type: 'LineString' as const,
        coordinates: s.geometry.map(p => [p.lng, p.lat]),
      },
    })),
  }
}

export default function SegmentsMap({
  segments,
  selectedId = null,
  onSelect,
  height = 'h-80',
}: {
  segments: MapSegment[]
  selectedId?: string | null
  onSelect?: (id: string) => void
  height?: string
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MapboxMap | null>(null)
  const onSelectRef = useRef(onSelect)
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    onSelectRef.current = onSelect
  }, [onSelect])

  useEffect(() => {
    if (!containerRef.current || segments.length === 0) return
    if (!TOKEN || TOKEN === 'your_mapbox_token_here') {
      setError('Add NEXT_PUBLIC_MAPBOX_TOKEN to .env.local to see the map.')
      return
    }
    let cancelled = false

    ;(async () => {
      const mapboxgl = (await import('mapbox-gl')).default
      if (cancelled || !containerRef.current) return
      mapboxgl.accessToken = TOKEN as string

      const map = new mapboxgl.Map({
        container: containerRef.current,
        style: 'mapbox://styles/mapbox/light-v11',
        center: [segments[0].geometry[0].lng, segments[0].geometry[0].lat],
        zoom: 13,
        attributionControl: false,
      })
      mapRef.current = map
      map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'top-right')
      map.addControl(new mapboxgl.AttributionControl({ compact: true }))
      map.on('error', e => !cancelled && setError(e?.error?.message ?? 'Failed to load map.'))

      map.on('load', () => {
        if (cancelled) return
        map.addSource('segments', { type: 'geojson', data: toFeatures(segments, selectedId) })
        map.addLayer({
          id: 'segments-casing',
          type: 'line',
          source: 'segments',
          layout: { 'line-join': 'round', 'line-cap': 'round' },
          paint: {
            'line-color': '#ffffff',
            'line-width': ['case', ['==', ['get', 'selected'], 1], 11, 8],
          },
        })
        map.addLayer({
          id: 'segments-line',
          type: 'line',
          source: 'segments',
          layout: { 'line-join': 'round', 'line-cap': 'round' },
          paint: {
            'line-color': ['get', 'color'],
            'line-width': ['case', ['==', ['get', 'selected'], 1], 7, 4],
            'line-opacity': selectedId ? ['case', ['==', ['get', 'selected'], 1], 1, 0.45] : 0.9,
          },
        })
        map.on('click', 'segments-line', e => {
          const id = e.features?.[0]?.properties?.id
          if (typeof id === 'string') onSelectRef.current?.(id)
        })
        map.on('mouseenter', 'segments-line', () => (map.getCanvas().style.cursor = 'pointer'))
        map.on('mouseleave', 'segments-line', () => (map.getCanvas().style.cursor = ''))
        setReady(true)
      })
    })().catch(err => !cancelled && setError(err instanceof Error ? err.message : 'Map failed.'))

    return () => {
      cancelled = true
      mapRef.current?.remove()
      mapRef.current = null
    }
    // Map is created once; selection changes are applied below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [segments])

  // Highlight the selected segment and fly to it (or to the first one).
  useEffect(() => {
    const map = mapRef.current
    if (!ready || !map) return
    ;(map.getSource('segments') as GeoJSONSource | undefined)?.setData(toFeatures(segments, selectedId))
    map.setPaintProperty(
      'segments-line',
      'line-opacity',
      selectedId ? ['case', ['==', ['get', 'selected'], 1], 1, 0.45] : 0.9,
    )
    const target = segments.find(s => s.id === selectedId) ?? segments[0]
    const lngs = target.geometry.map(p => p.lng)
    const lats = target.geometry.map(p => p.lat)
    map.fitBounds(
      [
        [Math.min(...lngs), Math.min(...lats)],
        [Math.max(...lngs), Math.max(...lats)],
      ],
      { padding: 60, maxZoom: 15.5, duration: 600 },
    )
  }, [ready, selectedId, segments])

  return (
    <div className={`relative ${height} w-full bg-zinc-100 rounded-2xl border border-zinc-200 overflow-hidden`}>
      <div ref={containerRef} className="absolute inset-0" />
      {(!ready || error) && (
        <div className="absolute inset-0 flex items-center justify-center text-sm text-zinc-400 px-6 text-center">
          {error ?? 'Loading map…'}
        </div>
      )}
    </div>
  )
}
