'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { format } from 'date-fns'
import RouteMap from '@/components/RouteMap'
import UnitToggle from '@/components/UnitToggle'
import { useUnit } from '@/lib/useUnit'
import { formatDistance, formatDuration, formatPace } from '@/lib/units'
import type { EffortPoint, LatLng } from '@/lib/segments'
import EffortTable from './EffortTable'
import EffortCharts from './EffortCharts'

export interface SegmentEffortRow {
  id: string
  activityId: string
  runName: string
  date: string
  elapsed: number // seconds on the segment
  avgHr: number | null
  avgPace: number | null // min/km
  avgGap: number | null // min/km
  elevGain: number | null
  runDistance: number // km, whole run
  runDuration: number // seconds, whole run
  series: EffortPoint[] // time-aligned from segment entry
}

interface SegmentMeta {
  id: string
  name: string
  distance: number
  effortCount: number
}

export default function SegmentsView({
  segments,
  segment,
  efforts,
}: {
  segments: SegmentMeta[]
  segment: { id: string; name: string; distance: number; polyline: LatLng[] }
  efforts: SegmentEffortRow[] // sorted oldest → newest
}) {
  const router = useRouter()
  const { unit, changeUnit } = useUnit()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  const selected = efforts.find(e => e.id === selectedId) ?? null

  async function deleteSegment() {
    if (!confirm(`Delete segment "${segment.name}"? Its matched efforts go with it.`)) return
    setDeleting(true)
    const res = await fetch(`/api/segments/${segment.id}`, { method: 'DELETE' })
    if (res.ok) {
      router.push('/segments')
      router.refresh()
    } else {
      setDeleting(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900">Segments</h1>
          <p className="text-sm text-zinc-500 mt-0.5">
            The same stretch of road, every time you&apos;ve run it — falling HR at the
            same pace is your aerobic engine getting stronger.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <UnitToggle unit={unit} onChange={changeUnit} />
          <Link
            href="/segments/new"
            className="rounded-lg bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-700 transition-colors"
          >
            New segment
          </Link>
        </div>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <select
          value={segment.id}
          onChange={e => {
            setSelectedId(null)
            router.push(`/segments?segment=${e.target.value}`)
          }}
          className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-900"
        >
          {segments.map(s => (
            <option key={s.id} value={s.id}>
              {s.name} · {formatDistance(s.distance, unit)} · {s.effortCount}{' '}
              {s.effortCount === 1 ? 'effort' : 'efforts'}
            </option>
          ))}
        </select>
        <button
          onClick={deleteSegment}
          disabled={deleting}
          className="text-sm text-zinc-400 hover:text-red-600 disabled:opacity-40 transition-colors"
        >
          {deleting ? 'Deleting…' : 'Delete segment'}
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-zinc-200 p-6">
        <div className="flex items-baseline justify-between flex-wrap gap-2 mb-3">
          <p className="text-sm font-medium text-zinc-500">{segment.name}</p>
          <p className="text-xs text-zinc-400">
            {formatDistance(segment.distance, unit)} · {efforts.length}{' '}
            {efforts.length === 1 ? 'matched run' : 'matched runs'}
          </p>
        </div>
        <RouteMap coordinates={segment.polyline} />
      </div>

      {efforts.length === 0 ? (
        <div className="bg-white rounded-2xl border border-zinc-200 p-12 text-center text-sm text-zinc-400">
          No runs match this segment yet — new runs are checked automatically on
          every sync and upload.
        </div>
      ) : (
        <>
          <div className="grid gap-4 lg:grid-cols-3 items-start">
            <div className="lg:col-span-2">
              <EffortTable
                efforts={efforts}
                unit={unit}
                selectedId={selectedId}
                onSelect={id => setSelectedId(id === selectedId ? null : id)}
              />
            </div>
            <div className="bg-white rounded-2xl border border-zinc-200 p-5">
              {selected ? (
                <div className="space-y-3 text-sm">
                  <div>
                    <p className="text-xs text-zinc-400">
                      {format(new Date(selected.date), 'EEEE, MMMM d, yyyy')}
                    </p>
                    <p className="font-semibold text-zinc-900 mt-0.5">{selected.runName}</p>
                  </div>
                  <dl className="space-y-1.5 text-zinc-700">
                    <div className="flex justify-between">
                      <dt className="text-zinc-500">Segment time</dt>
                      <dd className="font-medium">{formatDuration(selected.elapsed)}</dd>
                    </div>
                    {selected.avgPace != null ? (
                      <div className="flex justify-between">
                        <dt className="text-zinc-500">Pace</dt>
                        <dd>{formatPace(selected.avgPace, unit)}</dd>
                      </div>
                    ) : null}
                    {selected.avgGap != null ? (
                      <div className="flex justify-between">
                        <dt className="text-zinc-500">GAP</dt>
                        <dd>{formatPace(selected.avgGap, unit)}</dd>
                      </div>
                    ) : null}
                    {selected.avgHr != null ? (
                      <div className="flex justify-between">
                        <dt className="text-zinc-500">Avg HR</dt>
                        <dd>{selected.avgHr} bpm</dd>
                      </div>
                    ) : null}
                    {selected.elevGain != null ? (
                      <div className="flex justify-between">
                        <dt className="text-zinc-500">Elevation gain</dt>
                        <dd>{selected.elevGain} m</dd>
                      </div>
                    ) : null}
                    <div className="flex justify-between pt-1.5 border-t border-zinc-100">
                      <dt className="text-zinc-500">Whole run</dt>
                      <dd>
                        {formatDistance(selected.runDistance, unit)} ·{' '}
                        {formatDuration(selected.runDuration)}
                      </dd>
                    </div>
                  </dl>
                  <div className="flex gap-4 pt-1">
                    <Link
                      href={`/runs/${selected.activityId}`}
                      className="text-sm font-medium text-zinc-900 hover:text-zinc-600 transition-colors"
                    >
                      View run →
                    </Link>
                    <Link
                      href={`/deep-dive?run=${selected.activityId}`}
                      className="text-sm font-medium text-zinc-900 hover:text-zinc-600 transition-colors"
                    >
                      Deep dive →
                    </Link>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-zinc-400 py-8 text-center">
                  Select a row to inspect that effort and highlight its trace in the
                  charts below.
                </p>
              )}
            </div>
          </div>

          <EffortCharts
            efforts={efforts}
            unit={unit}
            selectedId={selectedId}
            onSelect={id => setSelectedId(id === selectedId ? null : id)}
          />
        </>
      )}
    </div>
  )
}
