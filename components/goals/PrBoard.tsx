'use client'

import Link from 'next/link'
import { format } from 'date-fns'
import { formatDuration, formatPace, type Unit } from '@/lib/units'
import type { DistanceRecord } from '@/lib/records'

export default function PrBoard({
  records,
  unit,
}: {
  records: DistanceRecord[]
  unit: Unit
}) {
  if (records.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-zinc-200 p-8 text-center text-sm text-zinc-400">
        No best efforts yet — they&apos;ll appear once you have runs covering at least 1K.
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
      {records.map(r => (
        <Link
          key={r.target.label}
          href={`/runs/${r.best.activityId}`}
          className="bg-white rounded-xl border border-zinc-200 px-4 py-4 hover:border-zinc-400 transition-colors"
        >
          <p className="text-xs text-zinc-400 uppercase tracking-wide font-medium">
            {r.target.label}
          </p>
          <p className="text-lg font-semibold text-zinc-900 tabular-nums mt-1">
            {formatDuration(Math.round(r.best.seconds))}
          </p>
          <p className="text-xs text-zinc-500 mt-0.5">
            {formatPace(r.best.seconds / 60 / r.target.km, unit)}
          </p>
          <p className="text-xs text-zinc-400 mt-1">
            {format(new Date(r.best.date), 'MMM d, yyyy')}
            {!r.best.fromStreams ? ' · est.' : ''}
          </p>
        </Link>
      ))}
    </div>
  )
}
