'use client'

import UnitToggle from '@/components/UnitToggle'
import { useUnit } from '@/lib/useUnit'
import type { DistanceRecord, RacePrediction } from '@/lib/records'
import RaceGoalCard from './RaceGoalCard'
import GoalForm from './GoalForm'
import PrBoard from './PrBoard'
import PrProgression from './PrProgression'

export interface GoalWithPrediction {
  id: string
  name: string
  date: string
  distance: number // km
  goalTime: number // seconds
  prediction: RacePrediction | null
}

export default function GoalsView({
  goals,
  records,
}: {
  goals: GoalWithPrediction[]
  records: DistanceRecord[]
}) {
  const { unit, changeUnit } = useUnit()

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900">Goals & Records</h1>
          <p className="text-sm text-zinc-500 mt-0.5">
            Race targets, Riegel-predicted finish times, and your all-time best efforts.
          </p>
        </div>
        <UnitToggle unit={unit} onChange={changeUnit} />
      </div>

      <div className="space-y-4">
        <h2 className="text-base font-semibold text-zinc-900">Race Goals</h2>
        {goals.length === 0 ? (
          <div className="bg-white rounded-2xl border border-zinc-200 p-8 text-center text-sm text-zinc-400">
            No race goal yet — add the race you&apos;re training for below.
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {goals.map(g => (
              <RaceGoalCard key={g.id} goal={g} unit={unit} />
            ))}
          </div>
        )}
        <GoalForm />
      </div>

      <div className="space-y-4">
        <h2 className="text-base font-semibold text-zinc-900">Personal Records</h2>
        <PrBoard records={records} unit={unit} />
        <PrProgression records={records} />
      </div>
    </div>
  )
}
