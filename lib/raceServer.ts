import type { Session } from 'next-auth'
import type { RaceGoal } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { findActivities } from '@/lib/activities'
import { hrProfile, withoutExcluded, type HrProfile } from '@/lib/analysis'
import { addDaysToKey, dayKeyInZone } from '@/lib/activitySummary'
import { timeZoneFrom } from '@/lib/userSettings'
import { buildRacePlan, type CheckIn, type Level, type RacePlan } from '@/lib/racePlan'
import { predictRace, predictionTrend, trainingPaces, type Prediction, type PredictionRun } from '@/lib/racePrediction'
import type { RaceWeekHint } from '@/lib/trainingPlan'

// Server-side assembly of the race page. Streams are read here and never
// shipped to the client. Race goals, check-ins and everything derived from
// them are personal: callers must not use this for a demo session.

export interface RaceData {
  runs: PredictionRun[]
  profile: HrProfile
  timeZone: string
  today: string
  checkIns: CheckIn[]
  easyPace: number | null // min/km, median of the last 28 days
}

const nums = (v: unknown): number[] | null =>
  Array.isArray(v) && v.every(x => typeof x === 'number') ? (v as number[]) : null

export async function loadRaceData(session: Session | null): Promise<RaceData> {
  const [settings, activities, checkIns] = await Promise.all([
    prisma.userSettings.findUnique({ where: { id: 1 } }),
    findActivities(session, {
      orderBy: { date: 'asc' },
      select: {
        id: true,
        name: true,
        date: true,
        distance: true,
        duration: true,
        avgHeartRate: true,
        maxHeartRate: true,
        stream: { select: { time: true, distance: true, heartrate: true } },
      },
    }),
    session?.isDemo ? [] : prisma.weeklyCheckIn.findMany({ orderBy: { weekStart: 'asc' } }),
  ])
  const timeZone = timeZoneFrom(settings)
  const today = dayKeyInZone(new Date(), timeZone)
  const runs: PredictionRun[] = activities.map(a => {
    const time = nums(a.stream?.time)
    const distance = nums(a.stream?.distance)
    const hr = nums(a.stream?.heartrate)
    return {
      id: a.id,
      name: a.name,
      date: a.date.toISOString(),
      distanceKm: a.distance,
      durationSec: a.duration,
      avgHeartRate: a.avgHeartRate,
      streams:
        time && distance && distance.length === time.length
          ? { time, distance, heartrate: hr && hr.length === time.length ? hr : null }
          : null,
    }
  })

  const from = addDaysToKey(today, -27)
  const paces = withoutExcluded(runs)
    .filter(r => r.distanceKm > 0.5 && dayKeyInZone(new Date(r.date), timeZone) >= from)
    .map(r => r.durationSec / 60 / r.distanceKm)
    .sort((a, b) => a - b)
  const easyPace = paces.length ? paces[Math.floor(paces.length / 2)] : null

  return {
    runs,
    profile: hrProfile(settings, activities),
    timeZone,
    today,
    checkIns: checkIns.map(c => ({
      weekStart: c.weekStart,
      effort: c.effort as Level,
      freshness: c.freshness as Level,
      soreness: c.soreness as Level,
      enjoyment: (c.enjoyment ?? null) as Level | null,
      note: c.note,
    })),
    easyPace,
  }
}

export interface RaceView {
  goal: { id: string; name: string; date: string; distanceKm: number; goalTime: number }
  today: string
  daysOut: number
  prediction: Prediction | null
  trend: { weekStart: string; seconds: number | null }[]
  plan: RacePlan | null
}

const key = (d: Date) => d.toISOString().slice(0, 10)

export function raceView(goal: RaceGoal, data: RaceData, { trend = true } = {}): RaceView {
  const raceDate = key(goal.date)
  const predInput = {
    runs: data.runs,
    profile: data.profile,
    today: data.today < raceDate ? data.today : raceDate,
    timeZone: data.timeZone,
    raceKm: goal.distance,
    raceDate,
  }
  const prediction = predictRace(predInput)
  const paces = prediction ? trainingPaces(prediction.seconds, goal.distance) : null
  const plan = buildRacePlan({
    runs: data.runs.map(r => ({ id: r.id, date: r.date, distanceKm: r.distanceKm, durationSec: r.durationSec })),
    today: data.today,
    timeZone: data.timeZone,
    race: { date: raceDate, distanceKm: goal.distance, createdAt: key(goal.createdAt) },
    checkIns: data.checkIns,
    paces,
  })
  return {
    goal: { id: goal.id, name: goal.name, date: raceDate, distanceKm: goal.distance, goalTime: goal.goalTime },
    today: data.today,
    daysOut: Math.round((Date.parse(raceDate) - Date.parse(data.today)) / 86_400_000),
    prediction,
    trend: trend ? predictionTrend(predInput, 8) : [],
    plan,
  }
}

const PHASE_LABEL = { base: 'Base', build: 'Build', peak: 'Peak', taper: 'Taper' } as const

/** This week of the nearest race plan, for the 7-day tile; null without one. */
export function raceWeekHint(view: RaceView, easyPace: number | null): RaceWeekHint | null {
  const plan = view.plan
  if (!plan || plan.current < 0 || plan.current >= plan.weeks.length || !easyPace) return null
  const w = plan.weeks[plan.current]
  const q = w.sessions.find(s => s.quality || s.kind === 'free-run')
  const hills = w.sessions.find(s => s.kind === 'hills')
  const short = view.goal.name.length > 18 ? `${view.goal.name.slice(0, 17)}…` : view.goal.name
  return {
    label: `${short} · ${PHASE_LABEL[w.phase]} wk ${w.number}`,
    targetMin: w.targetKm * easyPace,
    longMin: w.longKm * easyPace,
    workout: q && q.kind !== 'race' ? { label: q.label, detail: q.detail } : null,
    hills: hills ? hills.detail : null,
  }
}

