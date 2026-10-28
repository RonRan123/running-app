// Activity sidebar on /runs: streak, this week, weekly goal, month grid and
// the 12-week trend.
//
// Runs are bucketed once, server-side, into local calendar days of the
// user's time zone (Settings → Training). Everything after that works on
// `yyyy-MM-dd` day keys with UTC date arithmetic, so no later step can be
// shifted by the server's or the browser's own time zone.

export const DEFAULT_TIME_ZONE = 'America/New_York'

export interface DayRun {
  name: string
  distanceKm: number
}

export interface DaySummary {
  distanceKm: number
  seconds: number
  runs: DayRun[]
}

/** Local-day key → that day's runs. */
export type DayMap = Record<string, DaySummary>

export type WeeklyGoalType = 'runs' | 'distance'

export interface WeeklyGoal {
  type: WeeklyGoalType
  target: number // run count, or km for a distance goal
}

/** True if `tz` is an IANA time zone this runtime understands. */
export function isValidTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz })
    return true
  } catch {
    return false
  }
}

/** The `yyyy-MM-dd` calendar date of `date` in time zone `tz`. */
export function dayKeyInZone(date: Date, tz: string): string {
  // en-CA formats as yyyy-MM-dd.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

/** Bucket runs into local days of `tz`. */
export function buildDayMap(
  activities: { name: string; date: Date; distance: number; duration: number }[],
  tz: string,
): DayMap {
  const days: DayMap = {}
  for (const a of activities) {
    const key = dayKeyInZone(a.date, tz)
    const d = (days[key] ??= { distanceKm: 0, seconds: 0, runs: [] })
    d.distanceKm += a.distance
    d.seconds += a.duration
    d.runs.push({ name: a.name, distanceKm: a.distance })
  }
  return days
}

// ── Day-key arithmetic (UTC, so DST never moves a key) ──────────────────

function toUtc(key: string): Date {
  return new Date(`${key}T00:00:00Z`)
}

function fromUtc(d: Date): string {
  return d.toISOString().slice(0, 10)
}

export function addDaysToKey(key: string, n: number): string {
  const d = toUtc(key)
  d.setUTCDate(d.getUTCDate() + n)
  return fromUtc(d)
}

/** Monday of the week containing `key`. */
export function weekStartKey(key: string): string {
  const dow = toUtc(key).getUTCDay() // 0 = Sunday
  return addDaysToKey(key, -((dow + 6) % 7))
}

interface Totals {
  distanceKm: number
  seconds: number
  runs: number
  runDays: number
}

function totalsBetween(days: DayMap, fromKey: string, toKey: string): Totals {
  const t: Totals = { distanceKm: 0, seconds: 0, runs: 0, runDays: 0 }
  for (let k = fromKey; k <= toKey; k = addDaysToKey(k, 1)) {
    const d = days[k]
    if (!d) continue
    t.distanceKm += d.distanceKm
    t.seconds += d.seconds
    t.runs += d.runs.length
    t.runDays += 1
  }
  return t
}

// ── Streak ──────────────────────────────────────────────────────────────

/**
 * Consecutive Mon–Sun weeks with at least one run, ending at today's week.
 * The current week counts once it has a run; until then it doesn't break
 * the streak, so the count holds through Monday morning instead of dropping
 * to 0 every week.
 */
export function weekStreak(days: DayMap, todayKey: string): number {
  const weeksWithRuns = new Set(
    Object.keys(days)
      .filter(k => k <= todayKey)
      .map(weekStartKey),
  )
  let week = weekStartKey(todayKey)
  if (!weeksWithRuns.has(week)) week = addDaysToKey(week, -7)
  let streak = 0
  while (weeksWithRuns.has(week)) {
    streak += 1
    week = addDaysToKey(week, -7)
  }
  return streak
}

// ── This week ───────────────────────────────────────────────────────────

export type DayState = 'run' | 'rest' | 'future'

export interface WeekDay {
  key: string
  dayOfMonth: number
  state: DayState
  isToday: boolean
  runs: DayRun[]
}

export interface ThisWeek extends Totals {
  startKey: string
  endKey: string
  days: WeekDay[]
}

function dayState(days: DayMap, key: string, todayKey: string): DayState {
  if (days[key]) return 'run'
  return key > todayKey ? 'future' : 'rest'
}

export function thisWeek(days: DayMap, todayKey: string): ThisWeek {
  const startKey = weekStartKey(todayKey)
  const endKey = addDaysToKey(startKey, 6)
  const week: WeekDay[] = []
  for (let i = 0; i < 7; i++) {
    const key = addDaysToKey(startKey, i)
    week.push({
      key,
      dayOfMonth: toUtc(key).getUTCDate(),
      state: dayState(days, key, todayKey),
      isToday: key === todayKey,
      runs: days[key]?.runs ?? [],
    })
  }
  return { startKey, endKey, days: week, ...totalsBetween(days, startKey, todayKey) }
}

// ── Weekly goal ─────────────────────────────────────────────────────────

export interface GoalProgress {
  type: WeeklyGoalType
  target: number
  done: number // runs, or km
  fraction: number // 0–1, capped
}

export function goalProgress(goal: WeeklyGoal, week: ThisWeek): GoalProgress {
  const done = goal.type === 'runs' ? week.runs : week.distanceKm
  return {
    type: goal.type,
    target: goal.target,
    done,
    fraction: goal.target > 0 ? Math.min(1, done / goal.target) : 0,
  }
}

// ── Month grid ──────────────────────────────────────────────────────────

/** `yyyy-MM` of a day key. */
export function monthOf(key: string): string {
  return key.slice(0, 7)
}

/** Shift a `yyyy-MM` month by `n` months. */
export function addMonths(month: string, n: number): string {
  const [y, m] = month.split('-').map(Number)
  const idx = y * 12 + (m - 1) + n
  return `${Math.floor(idx / 12)}-${String((idx % 12) + 1).padStart(2, '0')}`
}

export interface MonthCell {
  key: string
  dayOfMonth: number
  state: DayState
  runs: DayRun[]
}

export interface MonthGrid extends Totals {
  month: string // yyyy-MM
  leadingBlanks: number // empty cells before the 1st (Monday-first grid)
  cells: MonthCell[]
}

export function monthGrid(days: DayMap, month: string, todayKey: string): MonthGrid {
  const first = `${month}-01`
  const last = addDaysToKey(`${addMonths(month, 1)}-01`, -1)
  const cells: MonthCell[] = []
  for (let k = first; k <= last; k = addDaysToKey(k, 1)) {
    cells.push({
      key: k,
      dayOfMonth: toUtc(k).getUTCDate(),
      state: dayState(days, k, todayKey),
      runs: days[k]?.runs ?? [],
    })
  }
  const leadingBlanks = (toUtc(first).getUTCDay() + 6) % 7
  return { month, leadingBlanks, cells, ...totalsBetween(days, first, last) }
}

// ── Past 12 weeks ───────────────────────────────────────────────────────

export interface WeekVolume {
  weekStart: string
  distanceKm: number
  seconds: number
  runs: number
}

/** Totals for the last `weeks` Mon–Sun weeks, oldest first, current week last. */
export function recentWeeks(days: DayMap, todayKey: string, weeks = 12): WeekVolume[] {
  const current = weekStartKey(todayKey)
  const result: WeekVolume[] = []
  for (let i = weeks - 1; i >= 0; i--) {
    const weekStart = addDaysToKey(current, -7 * i)
    const t = totalsBetween(days, weekStart, addDaysToKey(weekStart, 6))
    result.push({ weekStart, distanceKm: t.distanceKm, seconds: t.seconds, runs: t.runs })
  }
  return result
}
