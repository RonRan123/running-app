'use client'

import { useCallback, useMemo, useState } from 'react'
import { endOfDay, startOfDay, subDays } from 'date-fns'
import DateRangeSlider from '@/components/DateRangeSlider'
import UnitToggle from '@/components/UnitToggle'
import { useUnit } from '@/lib/useUnit'
import {
  acuteChronicRatio,
  baseBuilding,
  fitnessFatigue,
  longRunByWeek,
  weeklyVolume,
  weeklyTimeInZones,
  withoutExcluded,
  type AnalysisActivity,
  type HrProfile,
  zonesOn,
} from '@/lib/analysis'
import { dayKeyInZone } from '@/lib/activitySummary'
import { planNextWeek } from '@/lib/trainingPlan'
import { defaultCheckIn, withTag, type CheckIn, type Level, type TagKey } from '@/lib/checkIn'
import BaseBuildingCard from './BaseBuildingCard'
import AerobicScatter from './AerobicScatter'
import EfficiencyTrend from './EfficiencyTrend'
import ZoneDistribution from './ZoneDistribution'
import RunningForm from './RunningForm'
import RunWalkSplit from './RunWalkSplit'
import WeeklyVolumeChart from './WeeklyVolumeChart'
import FitnessFatigue from './FitnessFatigue'
import LoadRatioCard from './LoadRatioCard'
import LongRunProgression from './LongRunProgression'
import TrainingPlanCard from './TrainingPlanCard'
import WeatherPerformance from './WeatherPerformance'
import Zone2PaceTrend from './Zone2PaceTrend'

export default function AnalysisView({
  activities,
  profile,
  timeZone,
  isDemo = false,
  checkIn: savedCheckIn = null,
}: {
  activities: AnalysisActivity[]
  profile: HrProfile
  timeZone: string
  /** Public demo: open on every run (they're spread out) and don't print the age. */
  isDemo?: boolean
  /** The owner's saved check-in tags; null for the demo, which can't set them. */
  checkIn?: CheckIn | null
}) {
  const { unit, changeUnit } = useUnit()

  const today = useMemo(() => startOfDay(new Date()), [])
  const domainMin = useMemo(() => {
    const earliest = activities.reduce(
      (min, a) => Math.min(min, new Date(a.date).getTime()),
      today.getTime(),
    )
    return startOfDay(new Date(earliest))
  }, [activities, today])

  const defaultFrom = isDemo ? domainMin : subDays(today, 14)
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

  const zones = useMemo(() => zonesOn(profile, today), [profile, today])
  const weeklyZones = useMemo(() => weeklyTimeInZones(inRange, profile), [inRange, profile])
  const weeklyVol = useMemo(() => weeklyVolume(inRange, range.from, range.to), [inRange, range])
  // Training load skips runs with known-bad data (EXCLUDED_ACTIVITY_IDS).
  const load = useMemo(
    () => fitnessFatigue(withoutExcluded(activities), profile),
    [activities, profile],
  )
  const loadRatio = useMemo(() => acuteChronicRatio(load), [load])
  const todayKey = useMemo(() => dayKeyInZone(new Date(), timeZone), [timeZone])
  const [checkIn, setCheckIn] = useState<CheckIn>(savedCheckIn ?? defaultCheckIn())
  const [checkInError, setCheckInError] = useState(false)
  // Show the change at once, save it, and take the server's copy (or roll
  // back) so the plan on screen always matches what is stored.
  const changeTag = useCallback(
    async (key: TagKey, level: Level) => {
      const before = checkIn
      setCheckIn(withTag(before, key, level, todayKey))
      setCheckInError(false)
      try {
        const res = await fetch('/api/check-in', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ [key]: level }),
        })
        if (!res.ok) throw new Error()
        setCheckIn(await res.json())
      } catch {
        setCheckIn(before)
        setCheckInError(true)
      }
    },
    [checkIn, todayKey],
  )
  const plan = useMemo(
    () => planNextWeek({ activities, timeZone, today: todayKey, checkIn }),
    [activities, timeZone, todayKey, checkIn],
  )
  const base = useMemo(() => baseBuilding(activities, profile), [activities, profile])
  const longRuns = useMemo(() => longRunByWeek(activities), [activities])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900">Analysis</h1>
          <p className="text-sm text-zinc-500 mt-0.5">
            {inRange.length} {inRange.length === 1 ? 'run' : 'runs'} in the selected range · easy ≤{' '}
            {zones.easyMax}, hard ≥ {zones.hardMin} bpm
            {isDemo
              ? ' (Maffetone zones)'
              : zones.basis === 'age'
              ? ` today (age ${zones.age}); each run uses your age on its date`
              : ' (from your highest recorded HR — set your birthday in Settings)'}
          </p>
        </div>
        <UnitToggle unit={unit} onChange={changeUnit} />
      </div>

      {/* This week — the plan and what it is trying to grow; fixed windows */}
      <div className="grid gap-6 lg:grid-cols-2">
        <TrainingPlanCard
          plan={plan}
          unit={unit}
          checkIn={checkIn}
          onTag={savedCheckIn ? changeTag : undefined}
          saveFailed={checkInError}
        />
        <BaseBuildingCard base={base} unit={unit} />
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
        <Zone2PaceTrend activities={inRange} profile={profile} unit={unit} />
      </div>
      <ZoneDistribution weekly={weeklyZones} />
      <RunningForm activities={inRange} profile={profile} unit={unit} />
      <RunWalkSplit activities={inRange} />
      <WeatherPerformance activities={inRange} unit={unit} />

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
