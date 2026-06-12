'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import UnitToggle from '@/components/UnitToggle'
import RouteMap, { type RoutePoint } from '@/components/RouteMap'
import { useUnit } from '@/lib/useUnit'
import { formatDistance, formatDuration, formatPace } from '@/lib/units'
import { mafTarget, timeInZones, type RunStreams, type Split } from '@/lib/runAnalysis'
import HrChart from './HrChart'
import PaceChart from './PaceChart'
import ElevationChart from './ElevationChart'
import SplitsTable from './SplitsTable'
import ZoneBar from './ZoneBar'
import MafSettings from './MafSettings'

export interface DeepDiveActivity {
  id: string
  name: string
  date: string
  distance: number // km
  duration: number // seconds
  avgPace: number | null
  avgHeartRate: number | null
  maxHeartRate: number | null
}

function parseCoordinates(value: unknown): RoutePoint[] {
  if (!Array.isArray(value)) return []
  return (value as unknown[]).filter(
    (p): p is RoutePoint =>
      typeof p === 'object' &&
      p !== null &&
      typeof (p as RoutePoint).lat === 'number' &&
      typeof (p as RoutePoint).lng === 'number',
  )
}

export default function DeepDiveView({
  runs,
  activity,
  coordinates,
  streams,
  splitsMi,
  splitsKm,
  trimp,
  maxHr,
  initialAge,
}: {
  runs: { id: string; name: string; date: string }[]
  activity: DeepDiveActivity
  coordinates: unknown
  streams: RunStreams | null
  splitsMi: Split[]
  splitsKm: Split[]
  trimp: number | null
  maxHr: number
  initialAge: number | null
}) {
  const router = useRouter()
  const { unit, changeUnit } = useUnit()
  const [age, setAge] = useState(initialAge)

  const maf = age != null ? mafTarget(age) : null
  const route = useMemo(() => parseCoordinates(coordinates), [coordinates])

  const zones = useMemo(
    () =>
      streams?.heartrate ? timeInZones(streams.time, streams.heartrate, maxHr) : null,
    [streams, maxHr],
  )

  const stats = [
    { label: 'Distance', value: formatDistance(activity.distance, unit) },
    { label: 'Duration', value: formatDuration(activity.duration) },
    { label: 'Avg Pace', value: activity.avgPace ? formatPace(activity.avgPace, unit) : '—' },
    { label: 'Avg HR', value: activity.avgHeartRate ? `${activity.avgHeartRate} bpm` : '—' },
    { label: 'Max HR', value: activity.maxHeartRate ? `${activity.maxHeartRate} bpm` : '—' },
    { label: 'Relative Effort', value: trimp != null ? Math.round(trimp).toString() : '—' },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900">Run Deep Dive</h1>
          <p className="text-sm text-zinc-500 mt-0.5">
            {format(new Date(activity.date), 'EEEE, MMMM d, yyyy')} · {activity.name}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={activity.id}
            onChange={e => router.push(`/deep-dive?run=${e.target.value}`)}
            className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 max-w-64"
          >
            {runs.map(r => (
              <option key={r.id} value={r.id}>
                {format(new Date(r.date), 'MMM d, yyyy')} — {r.name}
              </option>
            ))}
          </select>
          <UnitToggle unit={unit} onChange={changeUnit} />
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {stats.map(stat => (
          <div key={stat.label} className="bg-white rounded-xl border border-zinc-200 px-4 py-4">
            <p className="text-xs text-zinc-400 uppercase tracking-wide font-medium mb-1">
              {stat.label}
            </p>
            <p className="text-lg font-semibold text-zinc-900 tabular-nums">{stat.value}</p>
          </div>
        ))}
      </div>

      <MafSettings age={age} onSaved={setAge} />

      {streams ? (
        <>
          <HrChart streams={streams} maf={maf} maxHr={maxHr} />
          <div className="grid gap-6 lg:grid-cols-2">
            <PaceChart streams={streams} unit={unit} />
            <ElevationChart streams={streams} unit={unit} />
          </div>
          {zones ? <ZoneBar zones={zones} maxHr={maxHr} /> : null}
          <SplitsTable splits={unit === 'mi' ? splitsMi : splitsKm} unit={unit} />
        </>
      ) : (
        <div className="bg-white rounded-2xl border border-zinc-200 p-12 text-center text-sm text-zinc-400">
          No detailed sensor data is stored for this run yet. Press Sync on the Runs page to
          backfill streams from Intervals.icu, or re-upload the original GPX/FIT file.
        </div>
      )}

      {route.length > 0 ? (
        <div className="bg-white rounded-2xl border border-zinc-200 p-6">
          <p className="text-sm font-medium text-zinc-500 mb-3">Route</p>
          <RouteMap coordinates={route} />
        </div>
      ) : null}
    </div>
  )
}
