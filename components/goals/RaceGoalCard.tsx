'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { differenceInCalendarDays, format } from 'date-fns'
import { formatDistance, formatDuration, formatPace, type Unit } from '@/lib/units'
import type { GoalWithPrediction } from './GoalsView'

export default function RaceGoalCard({
  goal,
  unit,
}: {
  goal: GoalWithPrediction
  unit: Unit
}) {
  const router = useRouter()
  const [deleting, setDeleting] = useState(false)

  const daysOut = differenceInCalendarDays(new Date(goal.date), new Date())
  const goalPaceMinPerKm = goal.goalTime / 60 / goal.distance
  const prediction = goal.prediction

  // Negative delta = predicted faster than goal
  const deltaSec = prediction ? prediction.seconds - goal.goalTime : null
  const onTrack = deltaSec != null && deltaSec <= 0
  const close = deltaSec != null && deltaSec > 0 && deltaSec <= goal.goalTime * 0.02

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
            {format(new Date(goal.date), 'MMMM d, yyyy')} ·{' '}
            {daysOut >= 0 ? `${daysOut} days out` : 'completed'} ·{' '}
            {formatDistance(goal.distance, unit)}
          </p>
        </div>
        <button
          onClick={remove}
          disabled={deleting}
          className="text-xs text-zinc-400 hover:text-red-600 transition-colors disabled:opacity-50"
        >
          Delete
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 mt-4">
        <div>
          <p className="text-xs text-zinc-400 uppercase tracking-wide font-medium">Goal</p>
          <p className="text-lg font-semibold text-zinc-900 tabular-nums mt-0.5">
            {formatDuration(goal.goalTime)}
          </p>
          <p className="text-xs text-zinc-500">{formatPace(goalPaceMinPerKm, unit)}</p>
        </div>
        <div>
          <p className="text-xs text-zinc-400 uppercase tracking-wide font-medium">Predicted</p>
          {prediction ? (
            <>
              <p
                className={`text-lg font-semibold tabular-nums mt-0.5 ${
                  onTrack ? 'text-green-600' : close ? 'text-amber-600' : 'text-red-600'
                }`}
              >
                {formatDuration(prediction.seconds)}
              </p>
              <p className="text-xs text-zinc-500">
                {formatPace(prediction.seconds / 60 / goal.distance, unit)}
              </p>
            </>
          ) : (
            <p className="text-sm text-zinc-400 mt-1">
              Not enough recent data — needs a best effort in the last 90 days.
            </p>
          )}
        </div>
      </div>

      {prediction && deltaSec != null ? (
        <p className="text-xs text-zinc-500 mt-3 pt-3 border-t border-zinc-100">
          {onTrack
            ? `On track — predicted ${formatDuration(Math.abs(deltaSec))} ahead of goal.`
            : `Predicted ${formatDuration(deltaSec)} behind goal.`}{' '}
          Based on your recent {prediction.basis.label} best of{' '}
          {formatDuration(Math.round(prediction.basis.seconds))} (
          {format(new Date(prediction.basis.date), 'MMM d')}).
        </p>
      ) : null}
    </div>
  )
}
