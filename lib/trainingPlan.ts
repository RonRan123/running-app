import {
  fitnessFatigue,
  trimp,
  withoutExcluded,
  zonesOn,
  type AnalysisActivity,
  type HrProfile,
} from '@/lib/analysis'
import { addDaysToKey, dayKeyInZone } from '@/lib/activitySummary'

// Rule-based 7-day base-building plan for the Analysis page. Deterministic:
// the output depends only on the input (no clock, no network), so the same
// history on the same day always gives the same plan. Weeks are rolling 7-day
// blocks aligned to the plan's first day; load projection uses the app's own
// TRIMP / CTL / ATL math (the same numbers as the Acute : Chronic Load card).
//
// Every run is easy. The plan sets the week's minutes first, then places the
// runs by spacing rules (not a fixed weekday table), and finally checks the
// load ratio day by day: a day whose ratio would still be in the overreach
// zone is a rest day.

export const HR_CAP = 156
const MAX_ACWR = 1.3 // above: no back-to-back days, the week holds
const REST_ACWR = 1.5 // at or above: no run that day
const LOAD_HISTORY_DAYS = 84 // the ratio is unreliable while CTL is warming up
const MIN_WEEK_MIN = 90 // 3 × 30 min easy + 1 strength
const HIGH_LOAD_MIN_WEEK_MIN = 60 // 3 × 20 min when the ratio is ≥ 1.5
const MIN_WEEK_RUN_MIN = 30
const MIN_RUN_MIN = 20
const MIN_HISTORY_DAYS = 14
const LAYOFF_REST_DAYS = 7 // full days without a run
const BUILD_RATE = 1.1
const BUILD_AVG_CAP = 1.3 // × the 4-week average: one big week can't compound
const CUTBACK_RATE = 0.75
const CUTBACK_DETECT = 0.8 // a past week ≤ 80% of the one before counts as a cutback
const BUILD_WEEKS_BEFORE_CUTBACK = 3
const RETURN_STEPS = [0.5, 0.75, 0.9, 1]
const RETURN_OVERSHOOT = 1.2 // last week > 120% of its step → repeat the step
const LONG_SHARE = 0.3
const SINGLE_RUN_RATE = 1.1 // no run over 110% of the longest in 30 days
const SINGLE_RUN_STEP_MIN = 5 // …or +5 min, so short runs can still grow
const SINGLE_RUN_DAYS = 30
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
  loadRest: boolean // resting because the load ratio is ≥ 1.5 that day
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
  // `held`: last week ran well over its step, so that step repeats.
  | { kind: 'return'; step: 1 | 2 | 3 | 4; preGapWeekMin: number; held: boolean }

/** Where today's load ratio sits; null without 12 weeks of history. */
export type LoadState = 'ok' | 'elevated' | 'high'

export interface WeekPlan {
  startDate: string
  days: PlanDay[] // 7 entries
  totalRunMin: number
  totalDistanceKm: number | null
  lastWeekRunMin: number
  lastWeekDistanceKm: number
  changePct: number | null // null when last week had no running
  currentAcwr: number | null // today's ATL / CTL, as on the load-ratio card
  loadState: LoadState | null
  projectedAcwr: number | null // ATL / CTL at the end of day 7
  spaced: boolean // no back-to-back run days this week
  maxRunMin: number // longest single run allowed this week
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

const SUNDAY = 0
const SATURDAY = 6
const ANCHOR_DAYS = [2, 4, 6] // Tue / Thu / Sat: where a 3-run week prefers to sit

const toUtc = (key: string) => new Date(`${key}T00:00:00Z`)
const weekday = (key: string) => toUtc(key).getUTCDay()
const daysBetween = (from: string, to: string) =>
  Math.round((toUtc(to).getTime() - toUtc(from).getTime()) / 86_400_000)
// The epsilon keeps float noise (0.75 × 140 = 104.99999…) from dropping 5 min.
const floor5 = (min: number) => Math.floor(min / 5 + 1e-9) * 5

/** Runs per week by volume: a run day is added before runs get long. */
export function runsPerWeek(weekMin: number) {
  if (weekMin < 120) return 3
  if (weekMin < 180) return 4
  return 5
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
  maxRunMin: number // no single run longer than this
  strict: boolean // back-to-back run days are not allowed at all
  ranYesterday: boolean // a real run the day before `start`
  ranDayBefore: boolean // …and two days before
  forcedRest?: ReadonlySet<number> // day indexes that rest for load
  runs?: number // run count override (the minimum week is always 3)
  strength?: number // strength sessions, default 2
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
    loadRest: false,
  }
}

/** All ways to pick `n` of the indexes 0…6, in lexicographic order. */
function combos(n: number): number[][] {
  const out: number[][] = []
  const walk = (from: number, picked: number[]) => {
    if (picked.length === n) return void out.push(picked)
    for (let i = from; i <= 7 - (n - picked.length); i++) walk(i + 1, [...picked, i])
  }
  walk(0, [])
  return out
}

/**
 * Pick which `n` of the 7 days run, and which of them are long runs.
 * Lowest cost wins (first in lexicographic order on a tie):
 *  - back-to-back days: not allowed when `strict`, otherwise heavily
 *    penalized, and a third day in a row penalized again
 *  - a run the day after a long run is worse still; the day before, mildly
 *  - weeks of 4+ runs want a long run, which sits on the weekend (Saturday
 *    preferred) so it comes round about once a week
 *  - 3-run weeks prefer Tue / Thu / Sat so the plan doesn't drift day to day
 *  - otherwise runs are spread as evenly as possible, counting the last
 *    real run before the plan and the start of the following week
 */
function chooseDays(n: number, dates: string[], ctx: LayoutContext) {
  let best: { runs: number[]; longs: number[]; cost: number } | null = null
  for (const runs of combos(n)) {
    if (runs.some(i => ctx.forcedRest?.has(i))) continue
    const ran = (i: number) =>
      i === -1 ? ctx.ranYesterday : i === -2 ? ctx.ranDayBefore : runs.includes(i)

    let cost = 0
    let adjacent = false
    for (const i of runs) {
      if (!ran(i - 1)) continue
      adjacent = true
      cost += ran(i - 2) ? 200 : 100
    }
    if (adjacent && ctx.strict) continue

    let longs: number[] = []
    if (n >= 4) {
      const weekend = runs.filter(i => [SATURDAY, SUNDAY].includes(weekday(dates[i])))
      // A second long run only when it is the following weekend (Sun → Sat).
      longs = weekend.filter((i, k) => k === 0 || i - weekend[0] >= 6)
      if (longs.length === 0) cost += 10
      else if (weekday(dates[longs[0]]) === SUNDAY) cost += 6
      for (const l of longs) {
        if (ran(l + 1)) cost += 150
        if (ran(l - 1)) cost += ran(l - 2) ? 40 : 20
      }
    }
    if (n === 3) cost += 5 * runs.filter(i => !ANCHOR_DAYS.includes(weekday(dates[i]))).length

    const seq = [ctx.ranYesterday ? -1 : ctx.ranDayBefore ? -2 : -3, ...runs, 7]
    for (let k = 1; k < seq.length; k++) cost += (seq[k] - seq[k - 1]) ** 2

    if (!best || cost < best.cost) best = { runs, longs, cost }
  }
  return best
}

/**
 * Lay out `weekMin` run minutes over the 7 days from `ctx.start`. The total
 * comes out below `weekMin` when the spacing rules leave too few run days for
 * the single-run cap to cover it; those minutes are dropped, never moved.
 */
export function layoutWeek(weekMin: number, ctx: LayoutContext): PlanDay[] {
  const dates = Array.from({ length: 7 }, (_, i) => addDaysToKey(ctx.start, i))
  const rest = () =>
    dates.map((d, i) => ({ ...makeDay(d, 0, ctx.pace), loadRest: !!ctx.forcedRest?.has(i) }))
  const cap = floor5(ctx.maxRunMin)

  const wanted = Math.min(ctx.runs ?? runsPerWeek(weekMin), Math.floor(weekMin / MIN_RUN_MIN))
  for (let n = wanted; n >= 1; n--) {
    const pick = chooseDays(n, dates, ctx)
    if (!pick) continue

    // The long run is 30% of the week, within the single-run cap. If the cap
    // leaves it no longer than an even split, the week has no long run.
    const even = Math.min(cap, floor5(weekMin / n))
    const longMin = Math.max(MIN_RUN_MIN, floor5(Math.min(LONG_SHARE * weekMin, cap)))
    const longs = longMin > even ? pick.longs : []
    const easy = pick.runs.filter(i => !longs.includes(i))
    if (easy.length === 0) continue
    const easyMin = weekMin - longMin * longs.length
    const base = Math.min(cap, floor5(easyMin / easy.length))
    if (base < MIN_RUN_MIN) continue // never plan an easy run under 20 min

    // Leftover 5-min chunks go to the earliest easy days, never the day
    // before a long run.
    let extra = base < cap ? Math.floor((easyMin - base * easy.length) / 5) : 0
    const days = rest()
    for (const i of longs) days[i] = { ...makeDay(dates[i], longMin, ctx.pace), type: 'long' }
    const beforeLong = (i: number) => longs.includes(i + 1)
    for (const i of easy) {
      const bonus = extra > 0 && !beforeLong(i) ? 5 : 0
      if (bonus) extra--
      days[i] = makeDay(dates[i], base + bonus, ctx.pace)
    }

    // Strength: on easy-run days, 48 h apart, never the day before a long run.
    let lastStrength = -Infinity
    let strength = ctx.strength ?? 2
    for (const i of easy) {
      if (strength === 0 || beforeLong(i) || i - lastStrength < 2) continue
      days[i].strength = true
      lastStrength = i
      strength--
    }

    if (ctx.stridesOk) {
      const target = easy.find(i => !beforeLong(i))
      if (target != null) days[target].strides = true
    }
    return days
  }
  return rest()
}

const totalMin = (days: PlanDay[]) => days.reduce((s, d) => s + d.runMin, 0)
const ratioOf = (ctl: number, atl: number) => (ctl < 1 ? null : atl / ctl)

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

  // Load at the end of the day before the plan, then projected forward one
  // day at a time. `rest[i]` is what the load-ratio card would show on day i
  // if that day were a rest day; `end` is the ratio after all 7 days.
  const basePoint = fitnessFatigue(
    historyActs,
    profile,
    1,
    new Date(`${addDaysToKey(start, -1)}T12:00:00`),
  ).at(-1)
  const base = { ctl: basePoint?.ctl ?? 0, atl: basePoint?.atl ?? 0 }
  const plannedLoad = (d: PlanDay) =>
    trimp(
      {
        id: `plan-${d.date}`,
        name: 'Planned run',
        date: `${d.date}T12:00:00`,
        distance: d.distanceKm ?? 0,
        duration: d.runMin * 60,
        avgPace: null,
        avgHeartRate: runHr,
        maxHeartRate: null,
      },
      zonesOn(profile, `${d.date}T12:00:00`).maxHr,
    )
  const project = (days: PlanDay[]) => {
    let { ctl, atl } = base
    const rest: (number | null)[] = []
    for (const d of days) {
      rest.push(ratioOf(ctl - ctl / 42, atl - atl / 7))
      const load = d.runMin > 0 ? plannedLoad(d) : 0
      ctl += (load - ctl) / 42
      atl += (load - atl) / 7
    }
    return { rest, end: ratioOf(ctl, atl) }
  }

  const firstDay = history[0] ? history.reduce((m, r) => (r.day < m ? r.day : m), history[0].day) : null
  // Today's ratio, exactly as the card shows it: with a rest day so far when
  // the plan starts today, or after today's run when it starts tomorrow.
  const currentAcwr =
    start === today ? ratioOf(base.ctl - base.ctl / 42, base.atl - base.atl / 7) : ratioOf(base.ctl, base.atl)
  // For the first 12 weeks the 6-week base is still filling in and the ratio
  // reads high for everyone, so it doesn't steer the plan yet.
  const loadState: LoadState | null =
    currentAcwr == null || !firstDay || daysBetween(firstDay, start) < LOAD_HISTORY_DAYS
      ? null
      : currentAcwr >= REST_ACWR
        ? 'high'
        : currentAcwr > MAX_ACWR
          ? 'elevated'
          : 'ok'
  const loadUp = loadState === 'elevated' || loadState === 'high'

  // No single run over 110% of the longest in the last 30 days (or +5 min);
  // with the ratio in the overreach zone, no longer than that longest run.
  const longest = Math.max(
    0,
    ...history.filter(r => r.day >= addDaysToKey(start, -SINGLE_RUN_DAYS)).map(r => r.min),
  )
  const maxRunMin = Math.max(
    MIN_WEEK_RUN_MIN,
    floor5(
      loadState === 'high'
        ? longest
        : Math.max(SINGLE_RUN_RATE * longest, longest + SINGLE_RUN_STEP_MIN),
    ),
  )

  const runDays = [...new Set(history.map(r => r.day))].sort()
  const layout = (strict: boolean): LayoutContext => ({
    start,
    maxRunMin,
    strict,
    ranYesterday: runDays.includes(addDaysToKey(start, -1)),
    ranDayBefore: runDays.includes(addDaysToKey(start, -2)),
    stridesOk: !loadUp && stridesAllowed(runDays, start),
    pace,
  })

  /**
   * Lay the week out, then walk it day by day: a run on a day whose ratio
   * would still be ≥ 1.5 becomes a rest day and the week is laid out again.
   */
  const solve = (weekMin: number, ctx: LayoutContext) => {
    const forcedRest = new Set<number>()
    for (;;) {
      const days = layoutWeek(weekMin, { ...ctx, forcedRest })
      const { rest, end } = project(days)
      const hot = loadState
        ? days.findIndex((d, i) => d.runMin > 0 && rest[i] != null && rest[i]! >= REST_ACWR)
        : -1
      if (hot < 0) return { days, end }
      forcedRest.add(hot)
    }
  }

  const finish = (
    days: PlanDay[],
    phase: PlanPhase,
    extras: { minimumWeek?: boolean; trimmed?: boolean; spaced?: boolean; wanted?: number } = {},
  ): WeekPlan => {
    const total = totalMin(days)
    const loadRest = days.filter(d => d.loadRest).length
    if (loadRest > 0) {
      calc.push({
        label: `Rest while the load ratio is ≥ ${REST_ACWR}`,
        text: `${loadRest} ${loadRest === 1 ? 'day' : 'days'}`,
        kind: 'warn',
      })
    }
    if (extras.wanted != null && total < extras.wanted) {
      calc.push({
        label: `No run over ${maxRunMin} min · ${
          loadState === 'high' ? 'your longest in 30 days' : 'longest in 30 days + 10%'
        }`,
        minutes: total - extras.wanted,
        kind: 'warn',
      })
    }
    // The last line is the result; anything after the last planned line
    // (a trim, load rest days, the run cap) gets a closing "This week".
    const last = calc[calc.length - 1]
    if (last.estimated && last.minutes === total) last.kind = 'result'
    else calc.push(planned('This week', total, 'result'))

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
      currentAcwr,
      loadState,
      projectedAcwr: project(days).end,
      spaced: extras.spaced ?? false,
      maxRunMin,
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
  if (!firstDay || daysBetween(firstDay, start) < MIN_HISTORY_DAYS) {
    flags.push('not-enough-data')
    tags.push('Not enough data yet')
    calc.push({ label: 'Fewer than 14 days of runs', text: 'not enough data yet' })
    calc.push(planned('Minimum week', MIN_WEEK_MIN))
    const { days } = solve(MIN_WEEK_MIN, { ...layout(true), runs: 3, strength: 1 })
    return finish(days, { kind: 'insufficient' }, { minimumWeek: true, spaced: true })
  }

  calc.push({
    label: `Last full week · ${rangeLabel(lastWeekFrom, lastWeekTo)}`,
    minutes: Math.round(lastWeek.min),
    distanceKm: lastWeek.km,
  })
  if (loadUp) {
    calc.push({
      label: 'Load ratio today',
      text: `${currentAcwr!.toFixed(2)} · ${loadState === 'high' ? 'overreach zone' : 'above 1.3'}`,
      kind: 'warn',
    })
  }

  // Most recent layoff: ≥ 7 full days without a run, between two runs or
  // between the last run and the plan's first day.
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
  const lastMin = Math.round(lastWeek.min)
  const returnStep = restart ? Math.floor(daysBetween(restart, start) / 7) : Infinity
  if (gapStart && restart && returnStep < RETURN_STEPS.length) {
    // Rule 7: 50 → 75 → 90 → 100% of the pre-gap average week. A week run
    // well over its step doesn't earn the next one: the step repeats.
    const preGap = sumIn(history, addDaysToKey(gapStart, -27), gapStart)
    const preGapMin = preGap.min / 4
    const lastStepMin =
      returnStep > 0 ? Math.max(MIN_WEEK_MIN, RETURN_STEPS[returnStep - 1] * preGapMin) : null
    const held = lastStepMin != null && lastWeek.min > RETURN_OVERSHOOT * lastStepMin
    const index = held ? returnStep - 1 : returnStep
    const pct = RETURN_STEPS[index]
    const step = (index + 1) as 1 | 2 | 3 | 4
    target = pct * preGapMin
    phase = { kind: 'return', step, preGapWeekMin: preGapMin, held }
    tags.push(`Return week ${step} of 4${held ? ' (repeated)' : ''}`)
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
    if (held) {
      calc.push({
        label: `Last week ran over its ${Math.round(lastStepMin!)}-min step → repeat it`,
        text: `${lastMin} min run`,
        kind: 'warn',
      })
    }
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
    if (builds >= BUILD_WEEKS_BEFORE_CUTBACK) {
      target = CUTBACK_RATE * lastWeek.min
      phase = { kind: 'cutback' }
      tags.push('Cutback week')
      calc.push(planned(`${builds} build weeks in a row → cutback · 75% × ${lastMin}`, Math.round(target)))
    } else {
      // Rule 2 (also when the ratio is below 0.8 — no jumps): +10% on last
      // week, but never more than 130% of the 4-week average, so one
      // oversized week isn't built on.
      target = BUILD_RATE * lastWeek.min
      phase = { kind: 'build', week: builds + 1 }
      calc.push(planned(`Build week ${builds + 1} · +10% × ${lastMin}`, Math.round(target)))
      const blocks = [1, 2, 3, 4].filter(k => addDaysToKey(start, -7 * k + 6) >= firstDay)
      const average = blocks.reduce((s, k) => s + block(k).min, 0) / blocks.length
      if (target > BUILD_AVG_CAP * average) {
        target = BUILD_AVG_CAP * average
        calc.push(
          planned(`Capped · 130% × ${Math.round(average)} (4-week average)`, Math.round(target)),
        )
      }
    }
  }

  // Load above 1.3: the week holds at last week's minutes instead of building.
  if (loadUp && target > lastWeek.min) {
    target = lastWeek.min
    calc.push(planned('Load ratio above 1.3 → hold at last week', lastMin))
  }

  let weekMin = floor5(target)
  calc.push(planned('Rounded down to 5', weekMin))

  // Rule 6: never below the minimum week (3 × 30, or 3 × 20 in the overreach zone).
  const floorMin = loadState === 'high' ? HIGH_LOAD_MIN_WEEK_MIN : MIN_WEEK_MIN
  let minimum = weekMin < floorMin
  if (minimum) {
    weekMin = floorMin
    tags.push('Minimum week')
    calc.push(planned(`Below the ${floorMin}-min minimum → minimum week`, floorMin))
  }

  // Returning runners and anyone above 1.3 run on alternate days only.
  const spaced = phase.kind === 'return' || loadUp
  const ctx = (min: boolean): LayoutContext =>
    min ? { ...layout(spaced), runs: 3, strength: 1 } : layout(spaced)

  // Rule 4: shrink 5 min at a time until the projected ratio is ≤ 1.3.
  const first = solve(weekMin, ctx(minimum))
  if (first.end == null || first.end <= MAX_ACWR) {
    return finish(first.days, phase, { minimumWeek: minimum, spaced, wanted: weekMin })
  }
  let last = first
  for (let w = weekMin - 5; w >= floorMin; w -= 5) {
    last = solve(w, ctx(false))
    if (last.end == null || last.end <= MAX_ACWR) {
      tags.push('Trimmed for load')
      calc.push({
        label: `Trimmed · load ratio would hit ${first.end.toFixed(2)}`,
        minutes: w - weekMin,
        kind: 'warn',
      })
      return finish(last.days, phase, { trimmed: true, spaced, wanted: w })
    }
  }

  // Even the minimum week projects too high: show it, and say so.
  const trimmed = !minimum
  if (trimmed) {
    minimum = true
    tags.push('Minimum week')
    calc.push({
      label: `Trimmed · load ratio would hit ${first.end.toFixed(2)}`,
      minutes: floorMin - weekMin,
      kind: 'warn',
    })
    calc.push(planned('Minimum week', floorMin))
  }
  flags.push('load-high')
  tags.push('Load high')
  calc.push({
    label: `Minimum week still projects ${last.end!.toFixed(2)}`,
    text: 'keep everything easy',
    kind: 'warn',
  })
  return finish(last.days, phase, { minimumWeek: true, trimmed, spaced, wanted: floorMin })
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
