import {
  acuteChronicRatio,
  fitnessFatigue,
  withoutExcluded,
  type AnalysisActivity,
  type HrProfile,
} from '@/lib/analysis'
import { addDaysToKey, dayKeyInZone } from '@/lib/activitySummary'

// Rule-based 7-day plan for the Analysis page. Deterministic: the output
// depends only on the input (no clock, no network), so the same history on
// the same day always gives the same plan. Weeks are rolling 7-day blocks
// aligned to the plan's first day; load projection reuses the app's own
// TRIMP / CTL / ATL code via fitnessFatigue().

export const HR_CAP = 156
const MAX_ACWR = 1.3
const MIN_WEEK_MIN = 90 // 3 × 30 min easy + 1 strength
const MIN_WEEK_RUN_MIN = 30
const MIN_RUN_MIN = 20
const MIN_HISTORY_DAYS = 14
const LAYOFF_REST_DAYS = 7 // full days without a run
const BUILD_RATE = 1.1
const CUTBACK_RATE = 0.75
const CUTBACK_DETECT = 0.8 // a past week ≤ 80% of the one before counts as a cutback
const BUILD_WEEKS_BEFORE_CUTBACK = 3
const RETURN_STEPS = [0.5, 0.75, 0.9, 1]
const LONG_SHARE = 0.3
const LONG_STEP_MIN = 10
const DEFAULT_RUN_HR = 150
const RECENT_DAYS = 28
const STRIDES_DAYS = 84 // 12 weeks
const STRIDES_MAX_GAP = 7

export interface PlanInput {
  activities: AnalysisActivity[] // full history; excluded IDs are removed here
  profile: HrProfile
  today: string // yyyy-MM-dd in the user's time zone
  timeZone: string
}

export type DayType = 'easy' | 'long' | 'rest'

export interface PlanDay {
  date: string // yyyy-MM-dd
  type: DayType
  runMin: number // 0 on rest days; multiple of 5
  distanceKm: number | null // ≈ runMin ÷ recent easy pace
  strength: boolean
  strides: boolean
  movedLong: boolean // Sunday make-up for a missed Saturday long run
}

/** One line of the working shown under "How this was set". */
export interface CalcLine {
  label: string
  minutes?: number // formatted by the tile as "213 min (15.0 mi)"
  perWeek?: boolean // "142 min/wk"
  distanceKm?: number | null
  estimated?: boolean // planned value: distance is ≈ from easy pace
  text?: string // non-minute value, e.g. "22 days off"
  kind?: 'result' | 'warn'
}

export type PlanPhase =
  | { kind: 'insufficient' }
  | { kind: 'build'; week: number }
  | { kind: 'cutback' }
  | { kind: 'return'; step: 1 | 2 | 3 | 4; preGapWeekMin: number }

export interface WeekPlan {
  startDate: string
  days: PlanDay[] // 7 entries
  totalRunMin: number
  totalDistanceKm: number | null
  lastWeekRunMin: number
  lastWeekDistanceKm: number
  changePct: number | null // null when last week had no running
  projectedAcwr: number | null // ATL / CTL at the end of day 7
  phase: PlanPhase
  minimumWeek: boolean
  trimmed: boolean // shortened to keep the projected ratio ≤ 1.3
  flags: ('not-enough-data' | 'load-high')[]
  tags: string[] // short header labels, e.g. "Return week 2 of 4"
  calc: CalcLine[]
  hrCap: number
  easyPaceMinPerKm: number | null
}

interface Run {
  day: string
  min: number
  km: number
  hr: number | null
}

type Slot = 'E' | 'ES' | 'L' | 'X' // easy, easy + strength, long, rest

// Weekday (0 = Sunday) → slot, by runs per week. Sunday is always rest /
// cross-train, strength is 48 h apart and never the day before the long run,
// and 3-run weeks have no long run (the 30% cap would make it the shortest).
const TEMPLATES: Record<number, Slot[]> = {
  //   Sun  Mon   Tue   Wed  Thu   Fri  Sat
  3: ['X', 'X', 'ES', 'X', 'ES', 'X', 'E'],
  4: ['X', 'X', 'ES', 'E', 'ES', 'X', 'L'],
  5: ['X', 'E', 'ES', 'E', 'ES', 'X', 'L'],
  6: ['X', 'ES', 'E', 'ES', 'E', 'E', 'L'],
}

const SUNDAY = 0
const FRIDAY = 5
const SATURDAY = 6

const toUtc = (key: string) => new Date(`${key}T00:00:00Z`)
const weekday = (key: string) => toUtc(key).getUTCDay()
const daysBetween = (from: string, to: string) =>
  Math.round((toUtc(to).getTime() - toUtc(from).getTime()) / 86_400_000)
// The epsilon keeps float noise (0.75 × 140 = 104.99999…) from dropping 5 min.
const floor5 = (min: number) => Math.floor(min / 5 + 1e-9) * 5

export function runsPerWeek(weekMin: number) {
  if (weekMin < 120) return 3
  if (weekMin < 180) return 4
  if (weekMin < 260) return 5
  return 6
}

function sumIn(runs: Run[], from: string, to: string) {
  let min = 0
  let km = 0
  for (const r of runs) {
    if (r.day < from || r.day > to) continue
    min += r.min
    km += r.km
  }
  return { min, km }
}

function median(xs: number[]) {
  if (xs.length === 0) return null
  const s = [...xs].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2
}

export interface LayoutContext {
  start: string
  longCap: number // L0: long run at the unscaled target
  lastLong: number
  movedLong: boolean
  stridesOk: boolean
  pace: number | null
}

function makeDay(date: string, runMin: number, pace: number | null): PlanDay {
  return {
    date,
    type: runMin > 0 ? 'easy' : 'rest',
    runMin,
    distanceKm: runMin > 0 && pace ? runMin / pace : null,
    strength: false,
    strides: false,
    movedLong: false,
  }
}

/** Lay out `weekMin` run minutes over the 7 days from `ctx.start`. */
export function layoutWeek(weekMin: number, ctx: LayoutContext): PlanDay[] {
  const dates = Array.from({ length: 7 }, (_, i) => addDaysToKey(ctx.start, i))
  const slots = dates.map(d => TEMPLATES[runsPerWeek(weekMin)][weekday(d)])
  if (ctx.movedLong) {
    // Missed Saturday: today (Sunday) is the long run, Monday rests.
    slots[0] = 'L'
    slots[1] = 'X'
  }

  const longCount = slots.filter(s => s === 'L').length
  const longMin =
    longCount > 0
      ? Math.max(
          MIN_RUN_MIN,
          floor5(Math.min(ctx.longCap, LONG_SHARE * weekMin, ctx.lastLong + LONG_STEP_MIN)),
        )
      : 0
  const easyMin = weekMin - longMin * longCount

  // Never plan an easy run under 20 min: drop easy days (plain ones first)
  // until the remaining minutes cover them.
  const easyCount = () => slots.filter(s => s === 'E' || s === 'ES').length
  while (easyCount() > 0 && easyMin < MIN_RUN_MIN * easyCount()) {
    const plain = slots.lastIndexOf('E')
    slots[plain >= 0 ? plain : slots.lastIndexOf('ES')] = 'X'
  }

  const n = easyCount()
  const base = n > 0 ? floor5(easyMin / n) : 0
  // Leftover 5-min chunks go to the earliest easy days, never Friday (the
  // day before the long run).
  let extra = n > 0 ? Math.floor((easyMin - base * n) / 5) : 0

  const days = dates.map((date, i) => {
    const slot = slots[i]
    if (slot === 'X') return makeDay(date, 0, ctx.pace)
    if (slot === 'L') {
      return { ...makeDay(date, longMin, ctx.pace), type: 'long' as const, movedLong: i === 0 && ctx.movedLong }
    }
    const bonus = extra > 0 && weekday(date) !== FRIDAY ? 5 : 0
    if (bonus) extra--
    return { ...makeDay(date, base + bonus, ctx.pace), strength: slot === 'ES' }
  })

  if (ctx.stridesOk) {
    const target = days.find(d => d.type === 'easy' && weekday(d.date) !== FRIDAY)
    if (target) target.strides = true
  }
  return days
}

/** Rule 6: Tue / Thu / Sat easy 30 min, one strength session. */
function minimumWeek(start: string, pace: number | null): PlanDay[] {
  return Array.from({ length: 7 }, (_, i) => {
    const date = addDaysToKey(start, i)
    const wd = weekday(date)
    const run = wd === 2 || wd === 4 || wd === SATURDAY
    return { ...makeDay(date, run ? MIN_WEEK_RUN_MIN : 0, pace), strength: wd === 2 }
  })
}

const totalMin = (days: PlanDay[]) => days.reduce((s, d) => s + d.runMin, 0)

export function planNextWeek({ activities, profile, today, timeZone }: PlanInput): WeekPlan {
  const acts = withoutExcluded(activities).filter(a => a.duration > 0)
  const dayOf = (a: AnalysisActivity) => dayKeyInZone(new Date(a.date), timeZone)
  const runs: Run[] = acts
    .map(a => ({ day: dayOf(a), min: a.duration / 60, km: a.distance, hr: a.avgHeartRate }))
    .filter(r => r.day <= today)

  // A run already logged today makes today history; the plan starts tomorrow.
  const start = runs.some(r => r.day === today) ? addDaysToKey(today, 1) : today
  const history = runs.filter(r => r.day < start)
  const historyActs = acts.filter(a => dayOf(a) < start)
  const lastWeekFrom = addDaysToKey(start, -7)
  const lastWeekTo = addDaysToKey(start, -1)
  const block = (k: number) =>
    sumIn(history, addDaysToKey(start, -7 * k), addDaysToKey(start, -7 * k + 6))
  const lastWeek = block(1)

  const recent = history.filter(r => r.day >= addDaysToKey(start, -RECENT_DAYS))
  const pace = median(recent.filter(r => r.km > 0.5).map(r => r.min / r.km))
  const recentHr = recent.filter(r => r.hr).map(r => r.hr!)
  const runHr = recentHr.length
    ? recentHr.reduce((s, h) => s + h, 0) / recentHr.length
    : DEFAULT_RUN_HR

  const calc: CalcLine[] = []
  const flags: WeekPlan['flags'] = []
  const tags: string[] = []
  const estimate = (min: number) => (pace ? min / pace : null)
  const planned = (label: string, min: number, kind?: CalcLine['kind']): CalcLine => ({
    label,
    minutes: min,
    distanceKm: estimate(min),
    estimated: true,
    kind,
  })

  const project = (days: PlanDay[]) => {
    const synthetic: AnalysisActivity[] = days
      .filter(d => d.runMin > 0)
      .map(d => ({
        id: `plan-${d.date}`,
        name: 'Planned run',
        date: `${d.date}T12:00:00`,
        distance: d.distanceKm ?? 0,
        duration: d.runMin * 60,
        avgPace: null,
        avgHeartRate: runHr,
        maxHeartRate: null,
      }))
    const end = new Date(`${addDaysToKey(start, 6)}T12:00:00`)
    return acuteChronicRatio(fitnessFatigue([...historyActs, ...synthetic], profile, 7, end))
  }

  const finish = (
    days: PlanDay[],
    phase: PlanPhase,
    extras: { minimumWeek?: boolean; trimmed?: boolean } = {},
  ): WeekPlan => {
    const total = totalMin(days)
    const distances = days.filter(d => d.runMin > 0).map(d => d.distanceKm)
    return {
      startDate: start,
      days,
      totalRunMin: total,
      totalDistanceKm: distances.every(d => d != null)
        ? distances.reduce((s, d) => s! + d!, 0)
        : null,
      lastWeekRunMin: lastWeek.min,
      lastWeekDistanceKm: lastWeek.km,
      changePct: lastWeek.min > 0 ? Math.round((total / lastWeek.min - 1) * 100) : null,
      projectedAcwr: project(days),
      phase,
      minimumWeek: extras.minimumWeek ?? false,
      trimmed: extras.trimmed ?? false,
      flags,
      tags,
      calc,
      hrCap: HR_CAP,
      easyPaceMinPerKm: pace,
    }
  }

  // Edge case: no data or under two weeks of history.
  const firstDay = history[0] ? history.reduce((m, r) => (r.day < m ? r.day : m), history[0].day) : null
  if (!firstDay || daysBetween(firstDay, start) < MIN_HISTORY_DAYS) {
    flags.push('not-enough-data')
    tags.push('Not enough data yet')
    calc.push({ label: 'Fewer than 14 days of runs', text: 'not enough data yet' })
    calc.push(planned('Minimum week', MIN_WEEK_MIN, 'result'))
    return finish(minimumWeek(start, pace), { kind: 'insufficient' }, { minimumWeek: true })
  }

  calc.push({
    label: `Last full week · ${rangeLabel(lastWeekFrom, lastWeekTo)}`,
    minutes: Math.round(lastWeek.min),
    distanceKm: lastWeek.km,
  })

  // Most recent layoff: ≥ 7 full days without a run, between two runs or
  // between the last run and the plan's first day.
  const runDays = [...new Set(history.map(r => r.day))].sort()
  const seq = [...runDays, start]
  let gapStart: string | null = null // last run before the gap
  let restart: string | null = null // first run after it (or the plan start)
  for (let i = seq.length - 2; i >= 0; i--) {
    if (daysBetween(seq[i], seq[i + 1]) - 1 >= LAYOFF_REST_DAYS) {
      gapStart = seq[i]
      restart = seq[i + 1]
      break
    }
  }

  let target: number
  let phase: PlanPhase
  const returnStep = restart ? Math.floor(daysBetween(restart, start) / 7) : Infinity
  if (gapStart && restart && returnStep < RETURN_STEPS.length) {
    // Rule 7: 50 → 75 → 90 → 100% of the pre-gap average week.
    const preGap = sumIn(history, addDaysToKey(gapStart, -27), gapStart)
    const preGapMin = preGap.min / 4
    const pct = RETURN_STEPS[returnStep]
    const step = (returnStep + 1) as 1 | 2 | 3 | 4
    target = pct * preGapMin
    phase = { kind: 'return', step, preGapWeekMin: preGapMin }
    tags.push(`Return week ${step} of 4`)
    calc.push({
      label: `Gap · ${rangeLabel(addDaysToKey(gapStart, 1), addDaysToKey(restart, -1))}`,
      text: `${daysBetween(gapStart, restart) - 1} days off`,
    })
    calc.push({
      label: `Pre-gap average · ${rangeLabel(addDaysToKey(gapStart, -27), gapStart)}`,
      minutes: Math.round(preGapMin),
      perWeek: true,
      distanceKm: preGap.km / 4,
    })
    calc.push(
      planned(`Return week ${step} of 4 · ${pct * 100}% × ${Math.round(preGapMin)}`, Math.round(target)),
    )
  } else {
    // Rule 3: count consecutive build weeks since the last cutback / layoff.
    let builds = 0
    for (let k = 1; ; k++) {
      const blockStart = addDaysToKey(start, -7 * k)
      if (restart && blockStart < addDaysToKey(restart, 28)) break // still in the return ladder
      if (blockStart < firstDay) break
      if (block(k).min <= CUTBACK_DETECT * block(k + 1).min) break
      builds++
    }
    const lastMin = Math.round(lastWeek.min)
    if (builds >= BUILD_WEEKS_BEFORE_CUTBACK) {
      target = CUTBACK_RATE * lastWeek.min
      phase = { kind: 'cutback' }
      tags.push('Cutback week')
      calc.push(planned(`${builds} build weeks in a row → cutback · 75% × ${lastMin}`, Math.round(target)))
    } else {
      // Rule 2 (also when the ratio is below 0.8 — no jumps).
      target = BUILD_RATE * lastWeek.min
      phase = { kind: 'build', week: builds + 1 }
      calc.push(planned(`Build week ${builds + 1} · +10% × ${lastMin}`, Math.round(target)))
    }
  }

  const rounded = floor5(target)
  calc.push(planned('Rounded down to 5', rounded))

  // Rule 6: never below the minimum week.
  if (rounded < MIN_WEEK_MIN) {
    tags.push('Minimum week')
    calc.push(planned('Below the 90-min minimum → minimum week', MIN_WEEK_MIN, 'result'))
    const days = minimumWeek(start, pace)
    const acwr = project(days)
    if (acwr != null && acwr > MAX_ACWR) flagLoadHigh(acwr)
    return finish(days, phase, { minimumWeek: true })
  }

  const lastLong = lastLongRun(history, start)
  const ctx: LayoutContext = {
    start,
    longCap: floor5(Math.min(LONG_SHARE * rounded, lastLong + LONG_STEP_MIN)),
    lastLong,
    movedLong:
      weekday(start) === SUNDAY &&
      runsPerWeek(rounded) >= 4 &&
      !history.some(r => r.day === addDaysToKey(start, -1)),
    stridesOk: stridesAllowed(runDays, start),
    pace,
  }

  // Rule 4: shrink 5 min at a time until the projected ratio is ≤ 1.3. The
  // long run is pinned at its unscaled length, so easy runs shrink first.
  const firstTry = layoutWeek(rounded, ctx)
  const firstAcwr = project(firstTry)
  if (firstAcwr == null || firstAcwr <= MAX_ACWR) {
    calc[calc.length - 1].kind = 'result'
    return finish(firstTry, phase)
  }
  for (let w = rounded - 5; w >= MIN_WEEK_MIN; w -= 5) {
    const days = layoutWeek(w, ctx)
    const acwr = project(days)
    if (acwr == null || acwr <= MAX_ACWR) {
      tags.push('Trimmed for load')
      calc.push({
        label: `Trimmed · load ratio would hit ${firstAcwr.toFixed(2)}`,
        minutes: w - rounded,
        kind: 'warn',
      })
      calc.push(planned('This week', totalMin(days), 'result'))
      return finish(days, phase, { trimmed: true })
    }
  }

  // Even 90 min of the normal layout is too much: fall back to the minimum week.
  tags.push('Minimum week')
  const days = minimumWeek(start, pace)
  calc.push({
    label: `Trimmed · load ratio would hit ${firstAcwr.toFixed(2)}`,
    minutes: MIN_WEEK_MIN - rounded,
    kind: 'warn',
  })
  calc.push(planned('Minimum week', MIN_WEEK_MIN, 'result'))
  const acwr = project(days)
  if (acwr != null && acwr > MAX_ACWR) flagLoadHigh(acwr)
  return finish(days, phase, { minimumWeek: true, trimmed: true })

  function flagLoadHigh(acwr: number) {
    flags.push('load-high')
    tags.push('Load high')
    calc.push({
      label: `Minimum week still projects ${acwr.toFixed(2)}`,
      text: 'keep everything easy',
      kind: 'warn',
    })
  }
}

/** Longest single run in the most recent 7-day block that has any run. */
function lastLongRun(history: Run[], start: string) {
  for (let k = 1; k <= 52; k++) {
    const from = addDaysToKey(start, -7 * k)
    const to = addDaysToKey(from, 6)
    const inBlock = history.filter(r => r.day >= from && r.day <= to)
    if (inBlock.length) return Math.max(...inBlock.map(r => r.min))
  }
  return MIN_WEEK_RUN_MIN
}

/** Rule 8: 12 straight weeks with no gap over 7 days. */
function stridesAllowed(runDays: string[], start: string) {
  const from = addDaysToKey(start, -STRIDES_DAYS)
  if (!runDays.length || runDays[0] > from) return false
  const seq = [...runDays.filter(d => d >= from), start]
  // The gap that spans the window's first day counts too.
  const before = runDays.filter(d => d < from).pop()
  if (before) seq.unshift(before)
  for (let i = 1; i < seq.length; i++) {
    if (daysBetween(seq[i - 1], seq[i]) - 1 > STRIDES_MAX_GAP) return false
  }
  return true
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** "Oct 29 – Nov 4", or "Oct 6 – 27" within one month. */
function rangeLabel(from: string, to: string) {
  const [, fm, fd] = from.split('-').map(Number)
  const [, tm, td] = to.split('-').map(Number)
  const head = `${MONTHS[fm - 1]} ${fd}`
  return fm === tm ? `${head} – ${td}` : `${head} – ${MONTHS[tm - 1]} ${td}`
}
