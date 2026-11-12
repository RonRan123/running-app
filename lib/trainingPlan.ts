import { withoutExcluded, type AnalysisActivity } from '@/lib/analysis'
import { addDaysToKey, dayKeyInZone } from '@/lib/activitySummary'
import { TAGS, defaultCheckIn, type CheckIn, type TagKey } from '@/lib/checkIn'

// Rule-based 7-day base-building plan for the Analysis page. Deterministic:
// the output depends only on the input (no clock, no network), so the same
// history, check-in tags and day always give the same plan. Weeks are
// rolling 7-day blocks aligned to the plan's first day.
//
// Every run is easy. The plan sets the week's minutes from recent weeks,
// adjusts them for how the runner says they feel (the check-in tags), and
// places the runs by spacing rules. Training load (TRIMP, the acute:chronic
// ratio) plays no part: it is shown on its own cards only.

export const HR_CAP = 156
const MIN_WEEK_MIN = 90 // 3 × 30 min easy + 1 strength
const MIN_WEEK_RUN_MIN = 30
const MIN_RUN_MIN = 20
const MIN_HISTORY_DAYS = 14
const LAYOFF_REST_DAYS = 7 // full days without a run
const BUILD_RATE = 1.1
const BUILD_AVG_CAP = 1.3 // × the 4-week average: one big week can't compound
const CUTBACK_RATE = 0.8
const CUTBACK_DETECT = 0.9 // a past week ≤ 90% of the one before counts as a cutback
const CUTBACK_RESUME = 0.7 // …and ≥ 70% of it was a planned one: resume from the peak
const BUILD_WEEKS_BEFORE_CUTBACK = 3
const BUILD_GROWTH = 1.05 // …and the last of them is ≥ 5% above two weeks earlier
const RETURN_STEPS = [0.5, 0.75, 0.9, 1]
const RETURN_OVERSHOOT = 1.2 // last week > 120% of its step → repeat the step
const LONG_SHARE = 0.3
const SINGLE_RUN_RATE = 1.1 // no run over 110% of the longest (by distance) in 30 days
const SINGLE_RUN_DAYS = 30
const RECENT_DAYS = 28
const STRIDES_DAYS = 84 // 12 weeks
const STRIDES_MAX_GAP = 7

export interface PlanInput {
  activities: AnalysisActivity[] // full history; excluded IDs are removed here
  today: string // yyyy-MM-dd in the user's time zone
  timeZone: string
  checkIn?: CheckIn // how the runner feels; omitted = everything fine
}

export type DayType = 'easy' | 'long' | 'rest'

export interface PlanDay {
  date: string // yyyy-MM-dd
  type: DayType
  runMin: number // 0 on rest days
  distanceKm: number | null // ≈ runMin ÷ recent easy pace
  strength: boolean
  strides: boolean
  restReason: string | null // the check-in tag that makes this a rest day
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
  // `resumed`: the week after a cutback goes back to the level before it.
  | { kind: 'build'; week: number; resumed: boolean }
  | { kind: 'cutback' }
  // `held`: last week ran well over its step, so that step repeats.
  | { kind: 'return'; step: 1 | 2 | 3 | 4; preGapWeekMin: number; held: boolean }

export interface WeekPlan {
  startDate: string
  days: PlanDay[] // 7 entries
  totalRunMin: number
  totalDistanceKm: number | null
  lastWeekRunMin: number
  lastWeekDistanceKm: number
  changePct: number | null // null when last week had no running
  spaced: boolean // no back-to-back run days this week
  maxRunMin: number // longest single run allowed this week
  maxRunKm: number | null // …as a distance at the recent easy pace
  phase: PlanPhase
  minimumWeek: boolean
  adjusted: boolean // a check-in tag changed this week
  flags: 'not-enough-data'[]
  tags: string[] // short header labels, e.g. "Return week 2 of 4"
  calc: CalcLine[]
  hrCap: number
  easyPaceMinPerKm: number | null
}

interface Run {
  day: string
  min: number
  km: number
}

/**
 * What one check-in tag at one level does to the week. With several tags
 * set, the strictest value of each field applies.
 */
interface Effect {
  restDays: number // rest days counted from the day the tag was set
  weekShare: number | null // cap on the week, as a share of last week's minutes
  spaced: boolean // alternate days only
  noIncrease: boolean // no run longer than the recent longest
  runCapMin: number | null // no run over this many minutes
  note: string // shown under "How this was set"
}

const SICK_REST_DAYS = Infinity
const effect = (e: Partial<Effect> & { note: string }): Effect => ({
  restDays: 0,
  weekShare: null,
  spaced: false,
  noIncrease: false,
  runCapMin: null,
  ...e,
})

// Hold = no build this week (the week is capped at last week's minutes).
export const EFFECTS: Record<TagKey, (Effect | null)[]> = {
  pain: [
    null,
    effect({ weekShare: 1, spaced: true, runCapMin: 30, note: 'hold · alternate days · runs ≤ 30 min' }),
    effect({
      restDays: 2,
      weekShare: 0.75,
      spaced: true,
      runCapMin: 30,
      note: 'rest 2 days · 75% week · alternate days · runs ≤ 30 min',
    }),
  ],
  soreness: [
    null,
    effect({ weekShare: 1, spaced: true, noIncrease: true, note: 'hold · alternate days · no longer runs' }),
    effect({
      restDays: 1,
      weekShare: 0.75,
      spaced: true,
      noIncrease: true,
      note: 'rest 1 day · 75% week · alternate days · no longer runs',
    }),
  ],
  sleep: [
    null,
    effect({ weekShare: 1, note: 'hold' }),
    effect({ weekShare: 1, spaced: true, note: 'hold · alternate days' }),
  ],
  tiredness: [
    null,
    effect({ weekShare: 1, note: 'hold' }),
    effect({ restDays: 1, weekShare: 1, spaced: true, note: 'rest 1 day · hold · alternate days' }),
  ],
  sick: [null, effect({ restDays: SICK_REST_DAYS, note: 'rest until you turn this off' })],
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
  forcedRest?: ReadonlyMap<number, string> // day index → why it must rest
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
    restReason: null,
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
    dates.map((d, i) => ({ ...makeDay(d, 0, ctx.pace), restReason: ctx.forcedRest?.get(i) ?? null }))
  // The cap is in whole minutes, not rounded to 5, so a capped run is exactly
  // at the limit.
  const cap = Math.floor(ctx.maxRunMin)

  const wanted = Math.min(ctx.runs ?? runsPerWeek(weekMin), Math.floor(weekMin / MIN_RUN_MIN))
  for (let n = wanted; n >= 1; n--) {
    const pick = chooseDays(n, dates, ctx)
    if (!pick) continue

    // The long run is 30% of the week, within the single-run cap. If the cap
    // leaves it no longer than an even split, the week has no long run.
    const even = Math.min(cap, floor5(weekMin / n))
    const longMin = Math.max(MIN_RUN_MIN, Math.min(floor5(LONG_SHARE * weekMin), cap))
    const longs = longMin > even ? pick.longs : []
    const easy = pick.runs.filter(i => !longs.includes(i))
    if (easy.length === 0) continue
    const easyMin = weekMin - longMin * longs.length
    const base = Math.min(cap, floor5(easyMin / easy.length))
    if (base < MIN_RUN_MIN) continue // never plan an easy run under 20 min

    // Leftover 5-min chunks go to the earliest easy days, never the day
    // before a long run.
    let extra = base + 5 <= cap ? Math.floor((easyMin - base * easy.length) / 5) : 0
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

export function planNextWeek({ activities, today, timeZone, checkIn = defaultCheckIn() }: PlanInput): WeekPlan {
  const acts = withoutExcluded(activities).filter(a => a.duration > 0)
  const runs: Run[] = acts
    .map(a => ({ day: dayKeyInZone(new Date(a.date), timeZone), min: a.duration / 60, km: a.distance }))
    .filter(r => r.day <= today)

  // A run already logged today makes today history; the plan starts tomorrow.
  const start = runs.some(r => r.day === today) ? addDaysToKey(today, 1) : today
  const history = runs.filter(r => r.day < start)
  const lastWeekFrom = addDaysToKey(start, -7)
  const lastWeekTo = addDaysToKey(start, -1)
  const block = (k: number) =>
    sumIn(history, addDaysToKey(start, -7 * k), addDaysToKey(start, -7 * k + 6))
  const lastWeek = block(1)
  const lastMin = Math.round(lastWeek.min)

  const recent = history.filter(r => r.day >= addDaysToKey(start, -RECENT_DAYS))
  const pace = median(recent.filter(r => r.km > 0.5).map(r => r.min / r.km))

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

  // The check-in tags that are set, and the strictest of what they ask for.
  const active = TAGS.flatMap(tag => {
    const state = checkIn[tag.key]
    const fx = EFFECTS[tag.key][state.level]
    return fx && state.since ? [{ tag, state, fx }] : []
  })
  const adjusted = active.length > 0
  const weekShare = active.reduce<number | null>(
    (min, a) => (a.fx.weekShare == null ? min : Math.min(min ?? Infinity, a.fx.weekShare)),
    null,
  )
  const noIncrease = active.some(a => a.fx.noIncrease)
  const runCapMin = active.reduce<number | null>(
    (min, a) => (a.fx.runCapMin == null ? min : Math.min(min ?? Infinity, a.fx.runCapMin)),
    null,
  )
  // Rest days sit on fixed dates, counted from the day each tag was set.
  const forcedRest = new Map<number, string>()
  for (const { tag, state, fx } of active) {
    for (let i = 0; i < 7; i++) {
      const since = daysBetween(state.since!, addDaysToKey(start, i))
      if (since >= 0 && since < fx.restDays && !forcedRest.has(i)) forcedRest.set(i, tag.label)
    }
  }
  const checkInLines = () => {
    for (const { tag, state, fx } of active) {
      calc.push({
        label: `${tag.label} · ${(tag.levels as readonly string[])[state.level].toLowerCase()}`,
        text: fx.note,
        kind: 'warn',
      })
    }
  }

  // No single run over 110% of the longest (by distance) in the last 30
  // days, turned into minutes at the recent easy pace. A sore-legs tag takes
  // the 10% away; a pain tag caps runs outright.
  const lately = history.filter(r => r.day >= addDaysToKey(start, -SINGLE_RUN_DAYS))
  const rate = noIncrease ? 1 : SINGLE_RUN_RATE
  const longestKm = Math.max(0, ...lately.map(r => r.km))
  const longestMin = Math.max(0, ...lately.map(r => r.min))
  const fromLongest = pace && longestKm > 0 ? rate * longestKm * pace : rate * longestMin
  const maxRunMin = Math.min(
    runCapMin ?? Infinity,
    Math.max(MIN_WEEK_RUN_MIN, Math.floor(fromLongest + 1e-9)),
  )

  const runDays = [...new Set(history.map(r => r.day))].sort()
  const layout = (strict: boolean, minimum: boolean): LayoutContext => ({
    start,
    maxRunMin,
    strict,
    ranYesterday: runDays.includes(addDaysToKey(start, -1)),
    ranDayBefore: runDays.includes(addDaysToKey(start, -2)),
    forcedRest,
    stridesOk: !adjusted && stridesAllowed(runDays, start),
    pace,
    ...(minimum ? { runs: 3, strength: 1 } : {}),
  })

  const finish = (
    weekMin: number,
    phase: PlanPhase,
    extras: { minimumWeek?: boolean; spaced?: boolean } = {},
  ): WeekPlan => {
    const days = layoutWeek(weekMin, layout(extras.spaced ?? false, extras.minimumWeek ?? false))
    const total = totalMin(days)
    if (adjusted) tags.push('Adjusted for check-in')
    if (total < weekMin) {
      const rests = days.filter(d => d.restReason).length
      const capped = days.some(d => d.runMin === maxRunMin)
      calc.push({
        label:
          rests > 0 && !capped
            ? `${rests} rest ${rests === 1 ? 'day' : 'days'} from the check-in`
            : `No run over ${maxRunMin} min · ${
                runCapMin != null && maxRunMin === runCapMin
                  ? 'check-in'
                  : noIncrease
                    ? 'your longest in 30 days'
                    : 'longest in 30 days + 10%'
              }`,
        minutes: total - weekMin,
        kind: 'warn',
      })
    }
    // The last line is the result; anything after the last planned line
    // gets a closing "This week".
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
      spaced: extras.spaced ?? false,
      maxRunMin,
      maxRunKm: estimate(maxRunMin),
      phase,
      minimumWeek: extras.minimumWeek ?? false,
      adjusted,
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
    checkInLines()
    calc.push(planned('Minimum week', MIN_WEEK_MIN))
    return finish(MIN_WEEK_MIN, { kind: 'insufficient' }, { minimumWeek: true, spaced: true })
  }

  calc.push({
    label: `Last full week · ${rangeLabel(lastWeekFrom, lastWeekTo)}`,
    minutes: lastMin,
    distanceKm: lastWeek.km,
  })

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
    const inLadder = (blockStart: string) => !!restart && blockStart < addDaysToKey(restart, 28)
    const buildsBefore = (from: number) => {
      let n = 0
      for (let k = from; ; k++) {
        const blockStart = addDaysToKey(start, -7 * k)
        if (inLadder(blockStart)) break // still in the return ladder
        if (blockStart < firstDay) break
        if (block(k).min <= CUTBACK_DETECT * block(k + 1).min) break
        n++
      }
      return n
    }
    const builds = buildsBefore(1)
    // Steady weeks aren't builds: a cutback is only earned by weeks that grew.
    const grew = (k: number) => block(k).min > BUILD_GROWTH * block(k + 2).min
    const cutbackMin = CUTBACK_RATE * lastWeek.min
    // Last week was the cutback after three builds (70–90% of the week
    // before it): this week goes back to that earlier level, so a cutback
    // never costs the progress made. A week that is short for any other
    // reason is built on as it is; missed minutes are never made up.
    const peak = block(2).min
    const afterCutback =
      builds === 0 &&
      lastWeek.min <= CUTBACK_DETECT * peak &&
      lastWeek.min >= CUTBACK_RESUME * peak &&
      buildsBefore(2) >= BUILD_WEEKS_BEFORE_CUTBACK &&
      grew(2)

    if (builds >= BUILD_WEEKS_BEFORE_CUTBACK && grew(1) && cutbackMin >= MIN_WEEK_MIN) {
      // An easier week after three weeks that grew; skipped while it would
      // fall below the minimum week.
      target = cutbackMin
      phase = { kind: 'cutback' }
      tags.push('Cutback week')
      calc.push(planned(`${builds} build weeks in a row → cutback · 80% × ${lastMin}`, Math.round(target)))
    } else {
      // Rule 2: +10% on last week (or back to the pre-cutback week), but
      // never more than 130% of the 4-week average, so one oversized week
      // isn't built on.
      if (afterCutback) {
        target = peak
        phase = { kind: 'build', week: 1, resumed: true }
        calc.push(planned('Back to the week before the cutback', Math.round(target)))
      } else {
        target = BUILD_RATE * lastWeek.min
        phase = { kind: 'build', week: builds + 1, resumed: false }
        calc.push(planned(`Build week ${builds + 1} · +10% × ${lastMin}`, Math.round(target)))
      }
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

  // Check-in: hold the week at last week's minutes, or cut it to 75% of them.
  checkInLines()
  if (weekShare != null && target > weekShare * lastWeek.min) {
    target = weekShare * lastWeek.min
    calc.push(
      planned(
        weekShare === 1 ? `Check-in → hold at last week's ${lastMin}` : `Check-in → ${weekShare * 100}% × ${lastMin}`,
        Math.round(target),
      ),
    )
  }

  let weekMin = floor5(target)
  calc.push(planned('Rounded down to 5', weekMin))

  // Rule 6: never below the minimum week.
  const minimum = weekMin < MIN_WEEK_MIN
  if (minimum) {
    weekMin = MIN_WEEK_MIN
    tags.push('Minimum week')
    calc.push(planned(`Below the ${MIN_WEEK_MIN}-min minimum → minimum week`, MIN_WEEK_MIN))
  }

  // Returning runners, and anyone a check-in tag says so for, run on
  // alternate days only.
  const spaced = phase.kind === 'return' || active.some(a => a.fx.spaced)
  return finish(weekMin, phase, { minimumWeek: minimum, spaced })
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
