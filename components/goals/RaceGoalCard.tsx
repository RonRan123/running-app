'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { differenceInCalendarDays, format, parseISO } from 'date-fns'
import { formatDistance, formatDuration, formatPace, type Unit } from '@/lib/units'
import { fmtDistance, fmtRange } from '@/lib/raceFormat'
import type { GoalWithPrediction } from './GoalsView'

const PHASE = {
  base: 'bg-zinc-100 text-zinc-700',
  build: 'bg-blue-50 text-blue-700',
  peak: 'bg-orange-50 text-orange-800',
  taper: 'bg-emerald-50 text-emerald-700',
} as const

export default function RaceGoalCard({
  goal,
  unit,
  readOnly = false,
}: {
  goal: GoalWithPrediction
  unit: Unit
  readOnly?: boolean
}) {
  const router = useRouter()
  const [deleting, setDeleting] = useState(false)

  const raceDay = parseISO(goal.date)
  const daysOut = differenceInCalendarDays(raceDay, new Date())
  const goalPaceMinPerKm = goal.goalTime / 60 / goal.distance
  const p = goal.prediction

  // Negative delta = projected faster than goal
  const deltaSec = p ? p.seconds - goal.goalTime : null
  const onTrack = deltaSec != null && deltaSec <= 0
  const close = deltaSec != null && deltaSec > 0 && deltaSec <= goal.goalTime * 0.02
  const w = goal.week

  async function remove() {
    if (!confirm(`Delete goal "${goal.name}"?`)) return
    setDeleting(true)
    await fetch(`/api/goals/${goal.id}`, { method: 'DELETE' })
    router.refresh()
  }

  return (
    <div className="bg-white rounded-2xl border border-zinc-200 p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-zinc-900">{goal.name}</h3>
          <p className="text-xs text-zinc-500 mt-0.5">
            {format(raceDay, 'MMMM d, yyyy')} · {daysOut >= 0 ? `${daysOut} days out` : 'completed'} ·{' '}
            {formatDistance(goal.distance, unit)}
          </p>
        </div>
        {!readOnly && (
          <button
            onClick={remove}
            disabled={deleting}
            className="text-xs text-zinc-500 hover:text-red-600 transition-colors disabled:opacity-50 min-h-8"
          >
            Delete
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 mt-4">
        <div>
          <p className="text-xs text-zinc-500 uppercase tracking-wide font-medium">Goal</p>
          <p className="text-lg font-semibold text-zinc-900 tabular-nums mt-0.5">{formatDuration(goal.goalTime)}</p>
          <p className="text-xs text-zinc-500">{formatPace(goalPaceMinPerKm, unit)}</p>
        </div>
        <div>
          <p className="text-xs text-zinc-500 uppercase tracking-wide font-medium">Projected today</p>
          {p ? (
            <>
              <p
                className={`text-lg font-semibold tabular-nums mt-0.5 ${
                  onTrack ? 'text-green-700' : close ? 'text-amber-700' : 'text-red-700'
                }`}
              >
                {formatDuration(p.seconds)}
              </p>
              <p className="text-xs text-zinc-500">
                {fmtRange(p.low, p.high)} · {p.confidence} confidence
              </p>
            </>
          ) : (
            <p className="text-sm text-zinc-500 mt-1">
              Not enough data yet: needs a hard 5K+ effort, or six runs with heart rate.
            </p>
          )}
        </div>
      </div>

      {p && deltaSec != null && (
        <p className="text-xs text-zinc-500 mt-3">
          {onTrack
            ? `On track: projected ${formatDuration(Math.abs(deltaSec))} ahead of goal.`
            : `Projected ${formatDuration(deltaSec)} behind goal.`}
        </p>
      )}

      {daysOut >= 0 && (
        <div className="mt-3 pt-3 border-t border-zinc-100 space-y-2">
          {w ? (
            <>
              <div className="flex flex-wrap gap-1.5 text-xs">
                <span className={`rounded-full px-2.5 py-0.5 font-medium ${PHASE[w.phase]}`}>
                  {w.phase[0].toUpperCase() + w.phase.slice(1)} · week {w.number} of {w.of}
                </span>
                {w.cutback && (
                  <span className="rounded-full px-2.5 py-0.5 font-medium bg-emerald-50 text-emerald-700">Cutback</span>
                )}
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-zinc-600">This week</span>
                <span className="font-medium tabular-nums">
                  {fmtDistance(w.doneKm, unit)} / {fmtDistance(w.targetKm, unit, 0)}
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-zinc-100" aria-hidden="true">
                <div
                  className="h-1.5 rounded-full bg-blue-600"
                  style={{ width: `${Math.min(100, (w.doneKm / w.targetKm) * 100)}%` }}
                />
              </div>
            </>
          ) : goal.startsOn ? (
            <p className="text-sm text-zinc-600">Plan starts {format(parseISO(goal.startsOn), 'EEE, MMM d')}.</p>
          ) : null}
          {!readOnly && (
            <Link href={`/goals/${goal.id}`} className="inline-flex items-center min-h-8 text-sm font-medium text-blue-700 hover:underline">
              Open race plan →
            </Link>
          )}
        </div>
      )}
    </div>
  )
}
