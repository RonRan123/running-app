import { addDays, differenceInCalendarDays, format, startOfDay, startOfWeek } from 'date-fns'

// Most HR-based analysis works from per-run average HR. The effort
// distribution chart is the exception: it uses per-sample time-in-zone
// (`zoneSeconds`, computed server-side from HR streams) and only falls back
// to classifying a whole run by its average when a run has no HR stream.

export interface AnalysisActivity {
  id: string
  name: string
  date: string
  distance: number // km
  duration: number // seconds
  avgPace: number | null // min/km
  avgHeartRate: number | null
  maxHeartRate: number | null
  // Weather at run time (Open-Meteo backfill) — optional so callers that
  // don't select the columns still satisfy the interface.
  weatherTempC?: number | null
  weatherDewPointC?: number | null
  weatherApparentTempC?: number | null
  // Seconds in each effort band from the HR stream; null when the run has
  // no HR stream (or it wasn't selected).
  zoneSeconds?: Record<Effort, number> | null
  // Running form from cadence + velocity streams; null without a cadence stream.
  cadenceSpm?: number | null
  stepLengthM?: number | null
}

// Assumed resting HR for TRIMP — not collected anywhere in the app.
const REST_HR = 60
// Fallback when no activity has a recorded max HR.
const DEFAULT_MAX_HR = 190

// Effort bands as a fraction of max HR. "Easy" tops out at ~78% HRmax
// (the upper edge of Zone 2 in a five-zone model), "hard" starts at ~87%
// (threshold and above).
export const EASY_CEILING = 0.78
export const MODERATE_CEILING = 0.87
// Zone 2 band used for the aerobic pace trend.
const ZONE2_FLOOR = 0.65

export type Effort = 'easy' | 'moderate' | 'hard'

export function estimateMaxHr(activities: AnalysisActivity[]) {
  const observed = activities
    .map(a => a.maxHeartRate ?? 0)
    .reduce((max, hr) => Math.max(max, hr), 0)
  return observed > 120 ? observed : DEFAULT_MAX_HR
}

export function classifyEffort(avgHr: number, maxHr: number): Effort {
  const frac = avgHr / maxHr
  if (frac <= EASY_CEILING) return 'easy'
  if (frac <= MODERATE_CEILING) return 'moderate'
  return 'hard'
}

export function isZone2(avgHr: number, maxHr: number) {
  const frac = avgHr / maxHr
  return frac >= ZONE2_FLOOR && frac <= EASY_CEILING
}

/**
 * Efficiency Factor: meters covered per minute, per heartbeat-per-minute.
 * Rising EF = faster running at the same cardiovascular cost.
 */
export function efficiencyFactor(a: AnalysisActivity) {
  if (!a.avgHeartRate || a.duration === 0) return null
  const metersPerMinute = (a.distance * 1000) / (a.duration / 60)
  return metersPerMinute / a.avgHeartRate
}

/**
 * Banister TRIMP: duration-weighted training impulse from average HR.
 * trimp = minutes × HRr × 0.64 × e^(1.92 × HRr), HRr = fraction of HR reserve.
 */
export function trimp(a: AnalysisActivity, maxHr: number) {
  if (!a.avgHeartRate) return 0
  const hrr = Math.min(1, Math.max(0, (a.avgHeartRate - REST_HR) / (maxHr - REST_HR)))
  return (a.duration / 60) * hrr * 0.64 * Math.exp(1.92 * hrr)
}

export interface LoadPoint {
  date: string // yyyy-MM-dd
  ctl: number
  atl: number
  tsb: number
}

/**
 * Fitness-fatigue model over daily TRIMP totals.
 * CTL: 42-day EWMA (fitness). ATL: 7-day EWMA (fatigue).
 * TSB: yesterday's CTL − ATL (form/readiness going into the day).
 * The EWMA runs from the first activity so the returned window is warmed up.
 */
export function fitnessFatigue(
  activities: AnalysisActivity[],
  maxHr: number,
  windowDays = 183,
): LoadPoint[] {
  if (activities.length === 0) return []

  const dailyTrimp = new Map<string, number>()
  let firstDay = startOfDay(new Date())
  for (const a of activities) {
    const day = startOfDay(new Date(a.date))
    if (day < firstDay) firstDay = day
    const key = format(day, 'yyyy-MM-dd')
    dailyTrimp.set(key, (dailyTrimp.get(key) ?? 0) + trimp(a, maxHr))
  }

  const today = startOfDay(new Date())
  const totalDays = differenceInCalendarDays(today, firstDay) + 1
  const points: LoadPoint[] = []
  let ctl = 0
  let atl = 0

  for (let i = 0; i < totalDays; i++) {
    const day = addDays(firstDay, i)
    const key = format(day, 'yyyy-MM-dd')
    const load = dailyTrimp.get(key) ?? 0
    const tsb = ctl - atl // pre-update values = yesterday's state
    ctl += (load - ctl) / 42
    atl += (load - atl) / 7
    points.push({ date: key, ctl, atl, tsb })
  }

  return points.slice(-windowDays)
}

/** Latest acute:chronic load ratio. Null when there's too little history. */
export function acuteChronicRatio(load: LoadPoint[]) {
  const latest = load[load.length - 1]
  if (!latest || latest.ctl < 1) return null
  return latest.atl / latest.ctl
}

export interface WeeklyZones {
  weekStart: string // yyyy-MM-dd (Monday)
  easySec: number
  moderateSec: number
  hardSec: number
  easyPct: number
  moderatePct: number
  hardPct: number
  // Runs this week classified by avg HR because they had no HR stream.
  fallbackRuns: number
}

/**
 * Weekly time spent easy / moderate / hard. Uses per-sample time-in-zone
 * where a run has an HR stream; otherwise the whole run's duration goes to
 * the band of its average HR, so no week silently loses time.
 */
export function weeklyTimeInZones(
  activities: AnalysisActivity[],
  maxHr: number,
): WeeklyZones[] {
  const weeks = new Map<string, Record<Effort, number> & { fallbackRuns: number }>()
  for (const a of activities) {
    if (!a.zoneSeconds && !a.avgHeartRate) continue
    const key = format(startOfWeek(new Date(a.date), { weekStartsOn: 1 }), 'yyyy-MM-dd')
    const week = weeks.get(key) ?? { easy: 0, moderate: 0, hard: 0, fallbackRuns: 0 }
    if (a.zoneSeconds) {
      week.easy += a.zoneSeconds.easy
      week.moderate += a.zoneSeconds.moderate
      week.hard += a.zoneSeconds.hard
    } else {
      week[classifyEffort(a.avgHeartRate!, maxHr)] += a.duration
      week.fallbackRuns++
    }
    weeks.set(key, week)
  }

  return [...weeks.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .filter(([, w]) => w.easy + w.moderate + w.hard > 0)
    .map(([weekStart, w]) => {
      const total = w.easy + w.moderate + w.hard
      return {
        weekStart,
        easySec: w.easy,
        moderateSec: w.moderate,
        hardSec: w.hard,
        easyPct: (w.easy / total) * 100,
        moderatePct: (w.moderate / total) * 100,
        hardPct: (w.hard / total) * 100,
        fallbackRuns: w.fallbackRuns,
      }
    })
}

export interface WeeklyVolume {
  weekStart: string // yyyy-MM-dd (Monday)
  distanceKm: number // total km for the week
  runCount: number
}

/**
 * Total distance and run count per calendar week.
 * When `from` and `to` are provided every week in that range is included,
 * with zeros for weeks that had no runs.
 */
export function weeklyVolume(
  activities: AnalysisActivity[],
  from?: Date,
  to?: Date,
): WeeklyVolume[] {
  const data = new Map<string, { distanceKm: number; runCount: number }>()
  for (const a of activities) {
    const key = format(startOfWeek(new Date(a.date), { weekStartsOn: 1 }), 'yyyy-MM-dd')
    const w = data.get(key) ?? { distanceKm: 0, runCount: 0 }
    w.distanceKm += a.distance
    w.runCount += 1
    data.set(key, w)
  }

  if (from && to) {
    // Walk every Monday between from and to and fill gaps with zeros.
    const result: WeeklyVolume[] = []
    let cursor = startOfWeek(from, { weekStartsOn: 1 })
    const end = startOfWeek(to, { weekStartsOn: 1 })
    while (cursor <= end) {
      const key = format(cursor, 'yyyy-MM-dd')
      const w = data.get(key) ?? { distanceKm: 0, runCount: 0 }
      result.push({ weekStart: key, ...w })
      cursor = addDays(cursor, 7)
    }
    return result
  }

  return [...data.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([weekStart, w]) => ({ weekStart, ...w }))
}

export interface WeeklyLongRun {
  weekStart: string // yyyy-MM-dd (Monday)
  distance: number // km, longest single run that week
}

/** Longest run of each of the trailing `weeks` weeks (including empty weeks). */
export function longRunByWeek(activities: AnalysisActivity[], weeks = 16): WeeklyLongRun[] {
  const longest = new Map<string, number>()
  for (const a of activities) {
    const key = format(startOfWeek(new Date(a.date), { weekStartsOn: 1 }), 'yyyy-MM-dd')
    longest.set(key, Math.max(longest.get(key) ?? 0, a.distance))
  }

  const thisWeek = startOfWeek(new Date(), { weekStartsOn: 1 })
  const result: WeeklyLongRun[] = []
  for (let i = weeks - 1; i >= 0; i--) {
    const key = format(addDays(thisWeek, -7 * i), 'yyyy-MM-dd')
    result.push({ weekStart: key, distance: longest.get(key) ?? 0 })
  }
  return result
}
