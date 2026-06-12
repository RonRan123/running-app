'use client'

import { format } from 'date-fns'
import Link from 'next/link'
import UploadButton from '@/components/UploadButton'
import SyncButton from '@/components/SyncButton'
import UnitToggle from '@/components/UnitToggle'
import { useUnit } from '@/lib/useUnit'
import { formatDistance, formatDuration, formatPace } from '@/lib/units'

export interface RunRow {
  id: string
  name: string
  date: string
  distance: number
  duration: number
  avgPace: number | null
  avgHeartRate: number | null
  source: string
}

export default function RunsView({ activities }: { activities: RunRow[] }) {
  const { unit, changeUnit } = useUnit()

  const totalKm = activities.reduce((sum, a) => sum + a.distance, 0)
  const totalRuns = activities.length

  return (
    <div className="space-y-6">
      {/* Header row */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900">All Runs</h1>
          {totalRuns > 0 && (
            <p className="text-sm text-zinc-500 mt-0.5">
              {totalRuns} {totalRuns === 1 ? 'run' : 'runs'} · {formatDistance(totalKm, unit, 1)}{' '}
              total
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <UnitToggle unit={unit} onChange={changeUnit} />
          <SyncButton />
          <UploadButton />
        </div>
      </div>

      {/* Table */}
      {activities.length === 0 ? (
        <div className="text-center py-24 text-zinc-400">
          <p className="text-lg font-medium">No runs yet</p>
          <p className="text-sm mt-1">Upload a GPX or FIT file, or sync from Intervals.icu</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-zinc-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-100 text-left text-zinc-400 text-xs uppercase tracking-wide">
                <th className="px-5 py-3 font-medium">Date</th>
                <th className="px-5 py-3 font-medium">Name</th>
                <th className="px-5 py-3 font-medium text-right">Distance</th>
                <th className="px-5 py-3 font-medium text-right">Time</th>
                <th className="px-5 py-3 font-medium text-right">Pace</th>
                <th className="px-5 py-3 font-medium text-right">Avg HR</th>
                <th className="px-5 py-3 font-medium text-right">Source</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-50">
              {activities.map(a => (
                <tr
                  key={a.id}
                  className="hover:bg-zinc-50 transition-colors"
                >
                  <td className="px-5 py-3.5 text-zinc-500 whitespace-nowrap">
                    {format(new Date(a.date), 'MMM d, yyyy')}
                  </td>
                  <td className="px-5 py-3.5 text-zinc-900 font-medium">
                    <Link
                      href={`/runs/${a.id}`}
                      className="hover:text-zinc-600 hover:underline underline-offset-2 transition-colors"
                    >
                      {a.name}
                    </Link>
                  </td>
                  <td className="px-5 py-3.5 text-zinc-900 text-right tabular-nums">
                    {formatDistance(a.distance, unit)}
                  </td>
                  <td className="px-5 py-3.5 text-zinc-900 text-right tabular-nums">
                    {formatDuration(a.duration)}
                  </td>
                  <td className="px-5 py-3.5 text-zinc-500 text-right tabular-nums">
                    {a.avgPace ? formatPace(a.avgPace, unit) : '—'}
                  </td>
                  <td className="px-5 py-3.5 text-zinc-500 text-right tabular-nums">
                    {a.avgHeartRate ? `${a.avgHeartRate} bpm` : '—'}
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <span className={`inline-block text-xs px-2 py-0.5 rounded-full font-medium ${
                      a.source === 'intervals'
                        ? 'bg-violet-50 text-violet-700'
                        : 'bg-zinc-100 text-zinc-500'
                    }`}>
                      {a.source === 'intervals' ? 'intervals.icu' : 'upload'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
