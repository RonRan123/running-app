'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import UnitToggle from '@/components/UnitToggle'
import { useUnit } from '@/lib/useUnit'
import { formatDistance, formatDuration, formatPace } from '@/lib/units'
import { mafTarget, timeInZones, type RunStreams, type Split } from '@/lib/runAnalysis'
import HrChart from './HrChart'
import PaceChart from './PaceChart'
import ElevationChart from './ElevationChart'
import SplitsTable from './SplitsTable'
import ZoneBar from './ZoneBar'

export interface RunDeepDiveActivity {
  distance: number  // km
  duration: number  // seconds
  avgPace: number | null
  avgHeartRate: number | null
  maxHeartRate: number | null
}

export default function RunDeepDive({
  activity,
  streams,
  splitsMi,
  splitsKm,
  trimp,
  maxHr,
  initialAge,
}: {
  activity: RunDeepDiveActivity
  streams: RunStreams | null
  splitsMi: Split[]
  splitsKm: Split[]
  trimp: number | null
  maxHr: number
  initialAge: number | null
}) {
  const { unit, changeUnit } = useUnit()

  // Age is configured once in Settings → Training; 180 − age is the MAF band.
  const maf = initialAge != null ? mafTarget(initialAge) : null

  const zones = useMemo(
    () => streams?.heartrate ? timeInZones(streams.time, streams.heartrate, maxHr) : null,
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
          <h2 className="text-base font-semibold text-zinc-900">Deep Dive</h2>
          <p className="text-xs text-zinc-500 mt-0.5">Per-run sensor breakdown</p>
        </div>
        <UnitToggle unit={unit} onChange={changeUnit} />
      </div>

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

      {maf === null && streams?.heartrate ? (
        <p className="text-xs text-zinc-500">
          Set your age in{' '}
          <Link href="/settings" className="underline hover:text-zinc-900">
            Settings
          </Link>{' '}
          to draw the Maffetone (180 − age) target band on the heart rate chart.
        </p>
      ) : null}

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
    </div>
  )
}
