'use client'

import { format } from 'date-fns'
import Link from 'next/link'
import UploadButton from '@/components/UploadButton'
import SyncButton from '@/components/SyncButton'
import UnitToggle from '@/components/UnitToggle'
import ActivitySidebar from '@/components/ActivitySidebar'
import type { DayMap, WeeklyGoal } from '@/lib/activitySummary'
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

export interface ActivitySummary {
  days: DayMap
  todayKey: string
  goal: WeeklyGoal | null
}

export default function RunsView({
  activities,
  summary,
}: {
  activities: RunRow[]
  summary: ActivitySummary
}) {
  const { unit, changeUnit } = useUnit()

  const totalKm = activities.reduce((sum, a) => sum + a.distance, 0)
  const totalRuns = activities.length

  return (
    <div className="space-y-6">
      {/* Header row */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-semibold text-zinc-900">All Runs</h1>
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

      <div className="flex flex-col gap-6 lg:grid lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
        {/* Activity sidebar: above the table on small screens, right of it on lg */}
        {activities.length > 0 && (
          <div className="lg:order-2">
            <ActivitySidebar {...summary} unit={unit} />
          </div>
        )}

        {/* Table */}
        {activities.length === 0 ? (
          <div className="text-center py-24 text-zinc-400 lg:col-span-2">
            <p className="text-lg font-medium">No runs yet</p>
            <p className="text-sm mt-1">Upload a GPX or FIT file, or sync from Intervals.icu</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-zinc-200 overflow-hidden overflow-x-auto lg:order-1 min-w-0">
            <table className="w-full text-sm min-w-[640px] lg:min-w-0">
              <thead>
                <tr className="border-b border-zinc-100 text-left text-zinc-400 text-xs uppercase tracking-wide">
                  <th className="px-5 lg:px-4 py-3 font-medium">Date</th>
                  <th className="px-5 lg:px-4 py-3 font-medium">Name</th>
                  <th className="px-5 lg:px-4 py-3 font-medium text-right whitespace-nowrap">Distance</th>
                  <th className="px-5 lg:px-4 py-3 font-medium text-right whitespace-nowrap">Time</th>
                  <th className="px-5 lg:px-4 py-3 font-medium text-right whitespace-nowrap">Pace</th>
                  <th className="px-5 lg:px-4 py-3 font-medium text-right whitespace-nowrap">Avg HR</th>
                  <th className="px-5 lg:px-4 py-3 font-medium text-right whitespace-nowrap lg:hidden">Source</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-50">
                {activities.map(a => (
                  <tr
                    key={a.id}
                    className="hover:bg-zinc-50 transition-colors"
                  >
                    <td className="px-5 lg:px-4 py-3.5 text-zinc-500 whitespace-nowrap">
                      {format(new Date(a.date), 'MMM d, yyyy')}
                    </td>
                    <td className="px-5 lg:px-4 py-3.5 text-zinc-900 font-medium">
                      <Link
                        href={`/runs/${a.id}`}
                        className="hover:text-zinc-600 hover:underline underline-offset-2 transition-colors"
                      >
                        {a.name}
                      </Link>
                    </td>
                    <td className="px-5 lg:px-4 py-3.5 text-zinc-900 text-right tabular-nums whitespace-nowrap">
                      {formatDistance(a.distance, unit)}
                    </td>
                    <td className="px-5 lg:px-4 py-3.5 text-zinc-900 text-right tabular-nums whitespace-nowrap">
                      {formatDuration(a.duration)}
                    </td>
                    <td className="px-5 lg:px-4 py-3.5 text-zinc-500 text-right tabular-nums whitespace-nowrap">
                      {a.avgPace ? formatPace(a.avgPace, unit) : '—'}
                    </td>
                    <td className="px-5 lg:px-4 py-3.5 text-zinc-500 text-right tabular-nums whitespace-nowrap">
                      {a.avgHeartRate ? `${a.avgHeartRate} bpm` : '—'}
                    </td>
                    <td className="px-5 lg:px-4 py-3.5 text-right lg:hidden">
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
    </div>
  )
}
