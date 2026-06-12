'use client'

import { useUnit } from '@/lib/useUnit'
import { formatDistance, formatDuration, formatPace } from '@/lib/units'

export default function RunDetailStats({
  distance,
  duration,
  avgPace,
  avgHeartRate,
  maxHeartRate,
  sport,
  source,
}: {
  distance: number // km
  duration: number // seconds
  avgPace: number | null // min/km
  avgHeartRate: number | null
  maxHeartRate: number | null
  sport: string
  source: string
}) {
  const { unit } = useUnit()

  const stats = [
    { label: 'Distance', value: formatDistance(distance, unit) },
    { label: 'Duration', value: formatDuration(duration) },
    { label: 'Avg Pace', value: avgPace ? formatPace(avgPace, unit) : '—' },
    { label: 'Avg Heart Rate', value: avgHeartRate ? `${avgHeartRate} bpm` : '—' },
    { label: 'Max Heart Rate', value: maxHeartRate ? `${maxHeartRate} bpm` : '—' },
    { label: 'Sport', value: sport },
    { label: 'Source', value: source === 'intervals' ? 'Intervals.icu' : 'Uploaded file' },
  ]

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
      {stats.map(stat => (
        <div
          key={stat.label}
          className="bg-white rounded-xl border border-zinc-200 px-4 py-4"
        >
          <p className="text-xs text-zinc-400 uppercase tracking-wide font-medium mb-1">
            {stat.label}
          </p>
          <p className="text-lg font-semibold text-zinc-900 tabular-nums">{stat.value}</p>
        </div>
      ))}
    </div>
  )
}
