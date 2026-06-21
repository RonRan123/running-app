'use client'

import { useMemo, useState } from 'react'
import { endOfDay, startOfDay, subDays } from 'date-fns'
import DateRangeSlider from '@/components/DateRangeSlider'
import UnitToggle from '@/components/UnitToggle'
import { useUnit } from '@/lib/useUnit'
import {
  acuteChronicRatio,
  estimateMaxHr,
  fitnessFatigue,
  longRunByWeek,
  weeklyVolume,
  weeklyZoneDistribution,
  type AnalysisActivity,
} from '@/lib/analysis'
import AerobicScatter from './AerobicScatter'
import EfficiencyTrend from './EfficiencyTrend'
import ZoneDistribution from './ZoneDistribution'
import WeeklyVolumeChart from './WeeklyVolumeChart'
import FitnessFatigue from './FitnessFatigue'
import LoadRatioCard from './LoadRatioCard'
import LongRunProgression from './LongRunProgression'
import Zone2PaceTrend from './Zone2PaceTrend'

export default function AnalysisView({ activities }: { activities: AnalysisActivity[] }) {
  const { unit, changeUnit } = useUnit()

  const today = useMemo(() => startOfDay(new Date()), [])
  const domainMin = useMemo(() => {
    const earliest = activities.reduce(
      (min, a) => Math.min(min, new Date(a.date).getTime()),
      today.getTime(),
    )
    return startOfDay(new Date(earliest))
  }, [activities, today])

  const defaultFrom = subDays(today, 14)
  const [range, setRange] = useState({
    from: defaultFrom < domainMin ? domainMin : defaultFrom,
    to: today,
  })

  const inRange = useMemo(() => {
    const from = startOfDay(range.from).getTime()
    const to = endOfDay(range.to).getTime()
    return activities.filter(a => {
      const t = new Date(a.date).getTime()
      return t >= from && t <= to
    })
  }, [activities, range])

  const maxHr = useMemo(() => estimateMaxHr(activities), [activities])
  const weeklyZones = useMemo(() => weeklyZoneDistribution(inRange, maxHr), [inRange, maxHr])
  const weeklyVol = useMemo(() => weeklyVolume(inRange, range.from, range.to), [inRange, range])
  const load = useMemo(() => fitnessFatigue(activities, maxHr), [activities, maxHr])
  const loadRatio = useMemo(() => acuteChronicRatio(load), [load])
  const longRuns = useMemo(() => longRunByWeek(activities), [activities])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900">Analysis</h1>
          <p className="text-sm text-zinc-500 mt-0.5">
            {inRange.length} {inRange.length === 1 ? 'run' : 'runs'} in the selected range · max HR
            estimated at {maxHr} bpm
          </p>
        </div>
        <UnitToggle unit={unit} onChange={changeUnit} />
      </div>

      <DateRangeSlider
        min={domainMin}
        max={today}
        from={range.from}
        to={range.to}
        onChange={(from, to) => setRange({ from, to })}
      />

      <WeeklyVolumeChart weekly={weeklyVol} unit={unit} />

      {/* Aerobic development — driven by the date range above */}
      <AerobicScatter activities={inRange} unit={unit} />
      <div className="grid gap-6 lg:grid-cols-2">
        <EfficiencyTrend activities={inRange} />
        <Zone2PaceTrend activities={inRange} maxHr={maxHr} unit={unit} />
      </div>
      <ZoneDistribution weekly={weeklyZones} />

      {/* Training load — fixed windows, independent of the slider */}
      <div>
        <h2 className="text-base font-semibold text-zinc-900">Training Load & Race Readiness</h2>
        <p className="text-sm text-zinc-500 mt-0.5 mb-4">
          Computed from your full history — these windows are fixed, not affected by the date range
          above.
        </p>
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <FitnessFatigue load={load} />
          </div>
          <LoadRatioCard ratio={loadRatio} />
        </div>
      </div>
      <LongRunProgression weeks={longRuns} unit={unit} />
    </div>
  )
}
