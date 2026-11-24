import { withoutExcluded } from '@/lib/analysis'
import { addDaysToKey, dayKeyInZone, weekStartKey } from '@/lib/activitySummary'
import { RULES } from '@/lib/racePrinciples'

// Season plan for a race goal: Mon–Sun weeks from the goal's creation to
// race day, re-planned every week from what was actually run.
//
// Deterministic: depends only on its input (no clock). Past weeks show the
// plan as it stood at the start of that week — the planner is replayed week
// by week from the season start — so "planned vs. actual" and the change log
// need no stored snapshots. Every number comes from lib/racePrinciples.ts.
//
// Distances in generated text are written as tokens — {km:12.3} and
// {pace:5.4} (min/km) — so the UI can show them in miles or kilometres.

export interface PlanRun {
  id: string
  date: string // ISO
  distanceKm: number
  durationSec: number
}

export type Level = 1 | 2 | 3

export interface CheckIn {
  weekStart: string // Monday, yyyy-MM-dd
  effort: Level // 1 easy · 2 medium · 3 hard
  freshness: Level // 1 drained · 2 okay · 3 fresh
  soreness: Level // 1 none · 2 normal muscle soreness · 3 pain in one spot
  enjoyment: Level | null // 1 a chore · 2 fine · 3 loved it
  note?: string | null
}

export interface RacePlanInput {
  runs: PlanRun[]
  today: string // yyyy-MM-dd in the user's time zone
  timeZone: string
  race: { date: string; distanceKm: number; createdAt: string } // yyyy-MM-dd
  checkIns: CheckIn[]
  /** Training paces (min/km) from the current projection; null = by effort. */
  paces: { race: number; threshold: number; tenK: number } | null
}

export type Phase = 'base' | 'build' | 'peak' | 'taper'
export type SessionKind =
  | 'strides'
  | 'hills'
  | 'fartlek'
  | 'tempo'
  | 'race-pace'
  | 'time-trial'
  | 'tune-up'
  | 'free-run'
  | 'race'

export interface Session {
  kind: SessionKind
  label: string
  detail: string // may contain {pace:…} tokens
  rule: string // principle id
  quality: boolean // counts as the week's one hard session
}

export interface TrailStep {
  rule: string // principle id
  inputs: string
  out: string
}

export interface PlanWeek {
  number: number // 1-based
  start: string // Monday
  end: string // Sunday
  phase: Phase
  weekInPhase: number // 0-based
  cutback: boolean
  hold: boolean
  targetKm: number
  longKm: number
  sessions: Session[]
  status: 'done' | 'current' | 'future'
  actualKm: number | null // so far for the current week
  longestKm: number | null
  onPlan: boolean | null // done weeks only: within the flex band
  checkIn: CheckIn | null
  trail: TrailStep[]
}

export interface PlanChange {
  weekStart: string
  title: string
  why: string
  rules: string[]
}

export interface PhaseSpan {
  phase: Phase
  fromWeek: number
  toWeek: number
  start: string
  end: string
}

export interface RacePlan {
  weeks: PlanWeek[]
  current: number // index of this week; -1 before the season, weeks.length after the race
  phases: PhaseSpan[]
  baselineKm: number
  peakKm: number
  peakWeek: number
  longestLong: { km: number; week: number }
  onPlanPct: number | null // done weeks: actual ÷ planned
  changes: PlanChange[] // newest first
  checkInDue: string | null // Monday of a finished week with no check-in
}

// ── Helpers ──────────────────────────────────────────────────────────────

const DAY_MS = 86_400_000
const daysBetween = (from: string, to: string) =>
  Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS)
const km = (x: number) => `{km:${x.toFixed(2)}}`
const pace = (x: number | undefined) => (x ? `{pace:${x.toFixed(3)}}` : 'by feel')
const MAX_WEEKS = 24

function median(xs: number[]) {
  if (!xs.length) return 0
  const s = [...xs].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

/** Week counts per phase for a season of `n` weeks (race week included). */
export function phaseLengths(n: number) {
  const taper = n >= 6 ? RULES.taperWeeks : Math.min(1, n)
  const peak = Math.min(RULES.peakWeeks, Math.max(0, n - taper - 2))
  const rest = n - taper - peak
  const build = Math.min(RULES.maxBuildWeeks, Math.ceil(rest / 2))
  return { base: rest - build, build, peak, taper }
}

function phaseOf(i: number, n: number): { phase: Phase; weekInPhase: number } {
  const L = phaseLengths(n)
  if (i < L.base) return { phase: 'base', weekInPhase: i }
  if (i < L.base + L.build) return { phase: 'build', weekInPhase: i - L.base }
  if (i < L.base + L.build + L.peak) return { phase: 'peak', weekInPhase: i - L.base - L.build }
  return { phase: 'taper', weekInPhase: i - L.base - L.build - L.peak }
}

const isCutback = (i: number, phase: Phase) =>
  (phase === 'base' || phase === 'build') && (i + 1) % RULES.cutbackEvery === 0

// ── Speed work ───────────────────────────────────────────────────────────

interface SessionCtx {
  i: number
  n: number
  phase: Phase
  weekInPhase: number
  cutback: boolean
  paces: RacePlanInput['paces']
  targetKm: number
  noQuality: boolean // pain reported last week
  freeRun: boolean // two low-enjoyment weeks
}

const halve = (reps: number, cutback: boolean) =>
  cutback ? Math.max(2, Math.ceil(reps * RULES.cutbackQualityShare)) : reps

/** The week's speed work by phase. At most one quality session. */
export function sessionsFor(c: SessionCtx): Session[] {
  const L = phaseLengths(c.n)
  const out: Session[] = []
  const raceWeek = c.i === c.n - 1

  if (!c.noQuality) {
    const reps = c.i < 2 ? 4 : 6
    out.push({
      kind: 'strides',
      label: raceWeek ? 'Strides only' : 'Strides',
      detail: `${reps} × 20 s quick and relaxed, after an easy run, twice this week`,
      rule: 'STRIDES',
      quality: false,
    })
  }
  if (raceWeek) {
    out.push({ kind: 'race', label: 'Race day', detail: 'Start at goal pace, not faster.', rule: 'TAPER', quality: true })
    return out
  }
  if (c.noQuality) return out

  let q: Session | null = null
  if (c.phase === 'base') {
    // Hill sprints start the week after the first base cutback.
    const start = L.base > RULES.cutbackEvery ? RULES.cutbackEvery : Math.floor(L.base / 2)
    if (c.weekInPhase >= start) {
      const reps = halve([6, 8, 10][Math.min(2, c.weekInPhase - start)], c.cutback)
      q = {
        kind: 'hills',
        label: 'Hill sprints',
        detail: `${reps} × 8 s near-max up a steep hill, walk down; then easy`,
        rule: 'HILL_SPRINTS',
        quality: false,
      }
    }
  } else if (c.phase === 'build') {
    const tt = L.build >= 4 ? 2 : -1
    if (c.weekInPhase === tt && !c.cutback) {
      q = {
        kind: 'time-trial',
        label: '5K time trial',
        detail: 'Warm up 15 min, run 5K hard and even, cool down. Sharpens the projection.',
        rule: 'TUNE_UPS',
        quality: true,
      }
    } else if (c.weekInPhase < (tt >= 0 ? tt : Math.ceil(L.build / 2))) {
      const reps = halve([6, 8][Math.min(1, c.weekInPhase)], c.cutback)
      q = {
        kind: 'fartlek',
        label: 'Fartlek',
        detail: `${reps} × 1 min at 10K effort (${pace(c.paces?.tenK)}), 1–2 min easy jog between`,
        rule: 'FARTLEK',
        quality: true,
      }
    } else {
      const k = c.weekInPhase - (tt >= 0 ? tt + 1 : Math.ceil(L.build / 2))
      const capMi = Math.floor((RULES.thresholdShare * c.targetKm) / 1.609344)
      const reps = halve(Math.max(2, Math.min(3 + Math.max(0, k), capMi)), c.cutback)
      q = {
        kind: 'tempo',
        label: 'Tempo',
        detail: `${reps} × 1 mi at threshold (${pace(c.paces?.threshold)}), 1 min jog between`,
        rule: 'THRESHOLD_CAP',
        quality: true,
      }
    }
  } else if (c.phase === 'peak') {
    if (c.weekInPhase === 0) {
      q = {
        kind: 'tune-up',
        label: '10K tune-up race',
        detail: 'A local 10K (e.g. an NYRR race) or a solo 10K effort. Replaces the workout.',
        rule: 'TUNE_UPS',
        quality: true,
      }
    } else {
      const blocks = ['2 × 2 mi', '3 × 2 mi', '2 × 3 mi'][Math.min(2, c.weekInPhase - 1)]
      q = {
        kind: 'race-pace',
        label: 'Half-marathon pace',
        detail: `${blocks} at race pace (${pace(c.paces?.race)}), 3 min jog between`,
        rule: 'RACE_PACE',
        quality: true,
      }
    }
  } else {
    q = {
      kind: 'race-pace',
      label: 'Short race-pace sharpener',
      detail: `2 × 1.5 mi at race pace (${pace(c.paces?.race)}), 3 min jog between`,
      rule: 'TAPER',
      quality: true,
    }
  }

  if (q && c.freeRun && q.quality && q.kind !== 'time-trial' && q.kind !== 'tune-up') {
    q = {
      kind: 'free-run',
      label: 'Free run',
      detail: 'Run however you like: a new route, with friends, no watch. Same time as the workout would take.',
      rule: 'KEEP_IT_FUN',
      quality: false,
    }
  }
  if (q) out.push(q)
  return out
}

const QUALITY_TYPES: SessionKind[] = ['hills', 'fartlek', 'tempo', 'race-pace']

// ── The planner ──────────────────────────────────────────────────────────

interface State {
  ref: number // build reference: last full build week (km)
  long: number // long-run reference (km)
  highRef: number // highest build reference so far: a strong week can climb back to it, never past it
  highLong: number
  hold: boolean
  returnStep: number | null // index into RETURN_LADDER while coming back from a broken week
  returnBase: number // where you were before the break
  forceCutback: boolean
  pain: boolean
  freeRun: boolean
  why: TrailStep[] // check-in / re-plan reasons applied to week c
}

// Same ladder as the 7-day plan's return from a layoff (lib/trainingPlan.ts).
const RETURN_LADDER = [0.5, 0.75, 0.9, 1]

interface SimWeek {
  returnStep: number | null
  targetKm: number
  longKm: number
  cutback: boolean
  hold: boolean
  sessions: Session[]
  trail: TrailStep[]
}

/** Plan weeks c … n-1 from a state. */
function simulate(
  c: number,
  n: number,
  s: State,
  peakCap: number,
  chronicKm: number | null,
  raceKm: number,
  paces: RacePlanInput['paces'],
  priorPeak: number,
): SimWeek[] {
  const out: SimWeek[] = []
  let ref = s.ref
  let long = s.long
  let ret = s.returnStep
  let peak = 0 // peak this plan reaches; the taper steps down from it
  let peakLong = 0
  // Last week's session types, so a type that carries over isn't "new".
  let prevKinds: SessionKind[] =
    c > 0
      ? sessionsFor({
          i: c - 1,
          n,
          ...phaseOf(c - 1, n),
          cutback: isCutback(c - 1, phaseOf(c - 1, n).phase),
          paces,
          targetKm: ref,
          noQuality: false,
          freeRun: false,
        }).map(x => x.kind)
      : []

  for (let i = c; i < n; i++) {
    const { phase, weekInPhase } = phaseOf(i, n)
    const first = i === c
    const trail: TrailStep[] = first ? [...s.why] : []
    let cutback = isCutback(i, phase) || (first && s.forceCutback)
    let target: number
    let longKm: number
    let hold = false
    const returning = ret != null && ret < RETURN_LADDER.length && phase !== 'taper'
    if (returning) cutback = false

    const sessions = sessionsFor({
      i,
      n,
      phase,
      weekInPhase,
      cutback,
      paces,
      targetKm: ref,
      noQuality: first && s.pain,
      freeRun: first && s.freeRun,
    })
    const kinds = sessions.map(x => x.kind)
    const newType = QUALITY_TYPES.find(k => kinds.includes(k) && !prevKinds.includes(k))

    const weekReturn = returning ? ret : null
    if (returning) {
      const share = RETURN_LADDER[ret!]
      target = s.returnBase * share
      trail.push({
        rule: 'RESTART',
        inputs: `Return week ${ret! + 1} of ${RETURN_LADDER.length}; before the break you were at ${km(s.returnBase)}`,
        out: `${Math.round(share * 100)}% → ${km(target)}`,
      })
      longKm = Math.max(s.long, RULES.longShare * target)
      ret = ret! + 1
    } else if (phase === 'taper') {
      const from = peak > 0 ? peak : priorPeak
      cutback = false
      if (i === n - 1) {
        // Race week: a few short easy runs, then the race. The race is part
        // of the week's total, so the bar always contains the race.
        const easy = from * RULES.raceWeekEasyShare
        target = easy + raceKm
        longKm = raceKm
        trail.push({
          rule: 'TAPER',
          inputs: `Peak week ${km(from)}`,
          out: `Easy runs ${Math.round(RULES.raceWeekEasyShare * 100)}% → ${km(easy)}, plus the race ${km(raceKm)} = ${km(target)}`,
        })
      } else {
        const rate = RULES.taperRates[Math.min(weekInPhase, RULES.taperRates.length - 1)]
        target = from * rate
        trail.push({ rule: 'TAPER', inputs: `Peak week ${km(from)}`, out: `${Math.round(rate * 100)}% → ${km(target)}` })
        longKm = Math.max(peakLong, long) * RULES.longCutbackRate
        trail.push({ rule: 'TAPER', inputs: `Peak long run ${km(Math.max(peakLong, long))}`, out: `70% → ${km(longKm)}` })
      }
    } else if (cutback) {
      target = ref * RULES.cutbackRate
      trail.push({
        rule: 'CUTBACK_CADENCE',
        inputs: first && s.forceCutback ? 'Two hard, drained weeks in a row' : `Week ${i + 1} is a cutback week; build reference ${km(ref)}`,
        out: `${Math.round(RULES.cutbackRate * 100)}% → ${km(target)}`,
      })
      longKm = long * RULES.longCutbackRate
      trail.push({ rule: 'CUTBACK_CADENCE', inputs: `Long-run reference ${km(long)}`, out: `70% → ${km(longKm)}` })
    } else {
      hold = (first && s.hold) || (!!newType && i > 0)
      if (hold) {
        target = ref
        if (first && s.hold) {
          trail.push({ rule: 'CHECKIN', inputs: 'Last week felt hard and you were drained', out: `Hold at ${km(ref)}` })
        } else {
          trail.push({ rule: 'ONE_NEW_STRESSOR', inputs: `New this week: ${sessions.find(x => x.kind === newType)?.label}`, out: `Hold at ${km(ref)}` })
        }
      } else {
        const want = ref * (1 + RULES.buildRate)
        target = Math.min(want, Math.max(peakCap, ref))
        trail.push({ rule: 'BUILD_STEP', inputs: `Build reference ${km(ref)}`, out: `+${Math.round(RULES.buildRate * 100)}% → ${km(want)}` })
        if (target < want) trail.push({ rule: 'PEAK_CAP', inputs: `Peak cap ${km(peakCap)}`, out: `Held at ${km(target)}` })
      }
      longKm = hold ? long : Math.min(long + RULES.longStepKm, RULES.longPeakKm)
    }

    if (first && chronicKm != null && chronicKm > 0 && target > RULES.loadRatioMax * chronicKm && phase !== 'taper') {
      const capped = RULES.loadRatioMax * chronicKm
      trail.push({
        rule: 'LOAD_RATIO_MAX',
        inputs: `4-week average ${km(chronicKm)}; ${km(target)} would be ${(target / chronicKm).toFixed(2)}×`,
        out: `Trimmed to ${km(capped)}`,
      })
      target = capped
    }
    if (first && s.pain) {
      const capped = Math.min(target, ref * RULES.checkInPainCut)
      trail.push({ rule: 'CHECKIN', inputs: 'Pain in one spot reported last week', out: `${km(capped)}, no workout, hills or strides. See a physio if it persists.` })
      target = capped
    }

    if (i !== n - 1 && longKm > RULES.longShare * target) {
      const capped = RULES.longShare * target
      trail.push({ rule: 'LONG_RUN_SHARE', inputs: `${km(longKm)} is over ${Math.round(RULES.longShare * 100)}% of ${km(target)}`, out: `Long run ${km(capped)}` })
      longKm = capped
    } else if (i !== n - 1 && phase !== 'taper' && !cutback) {
      trail.push({ rule: 'LONG_RUN_SHARE', inputs: `Long-run reference ${km(long)}`, out: hold ? `Held at ${km(longKm)}` : `+1 mi → ${km(longKm)}` })
    }
    if (longKm >= RULES.longPeakKm - 0.01 && phase !== 'taper') {
      trail.push({ rule: 'LONG_RUN_PEAK', inputs: 'Half-marathon long-run ceiling', out: km(RULES.longPeakKm) })
    }

    for (const x of sessions) {
      trail.push({ rule: x.rule, inputs: x.label, out: x.detail })
    }
    trail.push({ rule: 'EASY_HR_CAP', inputs: 'Easy and long runs', out: `≤ ${RULES.easyHrCap} bpm; workout days exempt` })

    if (!cutback && phase !== 'taper') {
      ref = target
      long = longKm
    }
    if (phase !== 'taper') {
      peak = Math.max(peak, target)
      peakLong = Math.max(peakLong, longKm)
    }
    prevKinds = kinds
    out.push({ returnStep: weekReturn, targetKm: target, longKm, cutback, hold, sessions, trail })
  }
  return out
}

/** Full season plan as of `input.today`. Null when the race is over or too far off. */
export function buildRacePlan(input: RacePlanInput): RacePlan | null {
  const { today, timeZone, race, checkIns, paces } = input
  const runs = withoutExcluded(input.runs)
  const raceWeek = weekStartKey(race.date)
  let start = weekStartKey(addDaysToKey(race.createdAt, 1))
  const earliest = addDaysToKey(raceWeek, -7 * (MAX_WEEKS - 1))
  if (start < earliest) start = earliest
  if (start > raceWeek) start = raceWeek
  const n = daysBetween(start, raceWeek) / 7 + 1

  // Weekly totals by Monday.
  const weekKm = new Map<string, number>()
  const weekLong = new Map<string, number>()
  for (const r of runs) {
    const day = dayKeyInZone(new Date(r.date), timeZone)
    if (day > today) continue
    const wk = weekStartKey(day)
    weekKm.set(wk, (weekKm.get(wk) ?? 0) + r.distanceKm)
    weekLong.set(wk, Math.max(weekLong.get(wk) ?? 0, r.distanceKm))
  }
  const kmIn = (wk: string) => weekKm.get(wk) ?? 0

  const thisWeek = weekStartKey(today)
  const current = thisWeek < start ? -1 : thisWeek > raceWeek ? n : daysBetween(start, thisWeek) / 7

  // Baseline: median of the last complete weeks before the season (or before now).
  const anchor = start < thisWeek ? start : thisWeek
  const prior = Array.from({ length: RULES.baselineWeeks }, (_, k) => kmIn(addDaysToKey(anchor, -7 * (k + 1))))
  const baselineKm = median(prior)
  const yearPeak = Math.max(0, ...Array.from({ length: 52 }, (_, k) => kmIn(addDaysToKey(anchor, -7 * (k + 1)))))
  const peakCap = Math.max(RULES.peakMultiple * baselineKm, yearPeak)
  const longRef = Math.max(
    weekLong.get(addDaysToKey(anchor, -7)) ?? 0,
    weekLong.get(addDaysToKey(anchor, -14)) ?? 0,
    baselineKm * 0.25,
  )

  const byWeek = new Map(checkIns.map(c => [c.weekStart, c]))
  const chronicBefore = (wk: string) => {
    const xs = [1, 2, 3, 4].map(k => kmIn(addDaysToKey(wk, -7 * k)))
    return xs.reduce((a, b) => a + b, 0) / 4
  }

  // Replay: plan as of the start of each week up to the current one.
  const replayUntil = Math.min(Math.max(current, 0), n - 1)
  const plans: SimWeek[][] = []
  const changes: PlanChange[] = []
  let state: State = { ref: baselineKm, long: longRef, highRef: baselineKm, highLong: longRef, hold: false, returnStep: null, returnBase: 0, forceCutback: false, pain: false, freeRun: false, why: [] }
  state.why = [
    { rule: 'BASELINE', inputs: `Last ${RULES.baselineWeeks} weeks: ${prior.map(km).join(', ')}`, out: `Median ${km(baselineKm)}` },
  ]
  let priorPeak = 0

  for (let c = 0; c <= replayUntil; c++) {
    const wk = addDaysToKey(start, 7 * c)
    const sim = simulate(c, n, state, peakCap, c === 0 ? null : chronicBefore(wk), race.distanceKm, paces, priorPeak)
    plans[c] = sim

    // Change log: compare with last week's plan.
    if (c === 0) {
      const pk = Math.max(...sim.filter((_, j) => phaseOf(j, n).phase !== 'taper').map(w => w.targetKm))
      changes.push({
        weekStart: wk,
        title: 'Plan created',
        why: `Baseline ${km(baselineKm)}/wk (median of the last ${RULES.baselineWeeks} weeks) · peak ${km(pk)} · ${n} weeks to race day.`,
        rules: ['BASELINE', 'PEAK_CAP'],
      })
    } else {
      const before = plans[c - 1]
      const was = before[1] // last week's plan for this week
      const now = sim[0]
      const reasons = now.trail.filter(
        t =>
          ['NO_MAKEUP', 'FLEX_BAND', 'RESTART', 'LOAD_RATIO_MAX', 'CHECKIN', 'KEEP_IT_FUN'].includes(t.rule) ||
          (t.rule === 'CUTBACK_CADENCE' && t.inputs.includes('drained')),
      )
      const lastWk = addDaysToKey(wk, -7)
      const ran = kmIn(lastWk)
      const planned = before[0].targetKm
      if (Math.abs(was.targetKm - now.targetKm) >= 0.8) {
        changes.push({
          weekStart: wk,
          title: `Week ${c + 1} ${now.targetKm < was.targetKm ? 'lowered' : 'raised'} ${km(was.targetKm)} → ${km(now.targetKm)}`,
          why: reasons.length
            ? reasons.map(r => `${r.inputs}: ${r.out.charAt(0).toLowerCase()}${r.out.slice(1)}.`).join(' ')
            : `Week ${c} ran ${km(ran)} of ${km(planned)}; the plan re-builds from what you ran.`,
          rules: reasons.length ? [...new Set(reasons.map(r => r.rule))] : ['NO_MAKEUP'],
        })
      }
      const peakOf = (p: SimWeek[], offset: number) =>
        Math.max(...p.filter((_, j) => phaseOf(j + offset, n).phase !== 'taper').map(w => w.targetKm), 0)
      const oldPeak = Math.max(peakOf(before.slice(1), c), 0)
      const newPeak = peakOf(sim, c)
      if (oldPeak > 0 && newPeak > 0 && Math.abs(oldPeak - newPeak) >= 0.8 && phaseOf(c, n).phase !== 'taper') {
        changes.push({
          weekStart: wk,
          title: `Peak ${newPeak < oldPeak ? 'lowered' : 'raised'} ${km(oldPeak)} → ${km(newPeak)}`,
          why:
            newPeak < oldPeak
              ? `Week ${c} ran ${km(ran)} of ${km(planned)}. Missed miles aren't made up, so the build continues from there.`
              : `Week ${c} ran ${km(ran)} of ${km(planned)}, so the build is back where it was before the short week.`,
          rules: ['NO_MAKEUP', 'BUILD_STEP'],
        })
      }
      const oldQ = was.sessions.find(x => x.quality || x.kind === 'free-run')?.kind
      const newQ = now.sessions.find(x => x.quality || x.kind === 'free-run')?.kind
      if (oldQ !== newQ && (newQ === 'free-run' || !newQ)) {
        changes.push({
          weekStart: wk,
          title: newQ === 'free-run' ? `Week ${c + 1} workout swapped for a free run` : `Week ${c + 1} workout dropped`,
          why: newQ === 'free-run' ? 'Two weeks in a row felt like a chore.' : 'You reported pain in one spot.',
          rules: [newQ === 'free-run' ? 'KEEP_IT_FUN' : 'CHECKIN'],
        })
      }
    }

    if (c === replayUntil) break

    // Advance the state with what actually happened in week c.
    const w = sim[0]
    const ran = kmIn(wk)
    const ranLong = weekLong.get(wk) ?? 0
    const why: TrailStep[] = []
    const next: State = { ...state, hold: false, returnStep: null, forceCutback: false, pain: false, freeRun: false, why }
    const { phase } = phaseOf(c, n)
    if (phase !== 'taper') priorPeak = Math.max(priorPeak, w.targetKm)
    const broken = phase !== 'taper' && ran < w.targetKm * RULES.restartShare
    const ranText = `Week ${c + 1}: ran ${km(ran)} of ${km(w.targetKm)}`
    if (w.returnStep != null) {
      // A return week: climb the ladder, or start it over (never compounding).
      next.returnBase = state.returnBase
      next.ref = w.targetKm
      next.long = w.longKm
      if (broken) {
        next.returnStep = 0
        why.push({ rule: 'RESTART', inputs: ranText, out: 'Return ladder starts again at 50%' })
      } else if (w.returnStep + 1 < RETURN_LADDER.length) {
        next.returnStep = w.returnStep + 1
        why.push({ rule: 'RESTART', inputs: ranText, out: 'On to the next return step' })
      } else {
        why.push({ rule: 'RESTART', inputs: ranText, out: 'Back to full volume; the build resumes' })
      }
    } else if (broken) {
      next.returnStep = 0
      next.returnBase = Math.max(state.highRef, w.cutback ? state.ref : w.targetKm)
      next.highRef = next.returnBase
      why.push({ rule: 'NO_MAKEUP', inputs: ranText, out: 'Not made up' })
    } else if (!w.cutback && phase !== 'taper') {
      const hi = Math.max(state.highRef, w.targetKm)
      next.highRef = hi
      if (ran >= w.targetKm * (1 - RULES.flexBand)) {
        next.ref = Math.min(Math.max(w.targetKm, ran), hi)
        why.push({
          rule: 'FLEX_BAND',
          inputs: ranText,
          out: next.ref > w.targetKm + 0.01 ? `Counts as a full week; back up to ${km(next.ref)}` : 'Counts as a full week',
        })
      } else {
        next.ref = ran
        why.push({ rule: 'NO_MAKEUP', inputs: ranText, out: `Re-plan from ${km(ran)}; not made up` })
      }
      const hiLong = Math.max(state.highLong, w.longKm)
      next.highLong = hiLong
      next.long =
        ranLong >= w.longKm * (1 - RULES.flexBand)
          ? Math.min(Math.max(w.longKm, ranLong), hiLong)
          : Math.min(w.longKm, Math.max(ranLong, state.long * RULES.longCutbackRate))
    }

    const ci = byWeek.get(wk)
    const prevCi = byWeek.get(addDaysToKey(wk, -7))
    if (ci) {
      const label = `Check-in: ${['easy', 'medium', 'hard'][ci.effort - 1]}, ${['drained', 'okay', 'fresh'][ci.freshness - 1]}, ${['no soreness', 'normal soreness', 'pain in one spot'][ci.soreness - 1]}`
      if (ci.soreness === 3) next.pain = true
      const drained = (x?: CheckIn) => !!x && x.effort === 3 && x.freshness === 1
      if (drained(ci) && drained(prevCi)) next.forceCutback = true
      else if (drained(ci)) next.hold = true
      if (ci.enjoyment === 1 && prevCi?.enjoyment === 1) next.freeRun = true
      if (!next.pain && !next.hold && !next.forceCutback && !next.freeRun) {
        why.push({ rule: 'CHECKIN', inputs: label, out: ci.effort === 1 && ci.freshness === 3 ? 'Plan unchanged; feeling great never speeds it up' : 'No change needed' })
      } else if (next.freeRun) {
        why.push({ rule: 'KEEP_IT_FUN', inputs: 'Two weeks in a row felt like a chore', out: 'Workout becomes a free run' })
      }
    }
    state = next
  }

  // Assemble: past weeks from their own replay, the rest from the latest plan.
  const latest = plans[replayUntil]
  const weeks: PlanWeek[] = []
  for (let i = 0; i < n; i++) {
    const wk = addDaysToKey(start, 7 * i)
    const sim = i < replayUntil ? plans[i][0] : latest[i - replayUntil]
    const status: PlanWeek['status'] = i < current ? 'done' : i === current ? 'current' : 'future'
    const actual = status === 'future' ? null : kmIn(wk)
    const { phase, weekInPhase } = phaseOf(i, n)
    weeks.push({
      number: i + 1,
      start: wk,
      end: addDaysToKey(wk, 6),
      phase,
      weekInPhase,
      cutback: sim.cutback,
      hold: sim.hold,
      targetKm: sim.targetKm,
      longKm: sim.longKm,
      sessions: sim.sessions,
      status,
      actualKm: actual,
      longestKm: status === 'future' ? null : weekLong.get(wk) ?? 0,
      onPlan: status === 'done' ? actual! >= sim.targetKm * (1 - RULES.flexBand) : null,
      checkIn: byWeek.get(wk) ?? null,
      trail: sim.trail,
    })
  }

  const phases: PhaseSpan[] = []
  for (const w of weeks) {
    const last = phases[phases.length - 1]
    if (last && last.phase === w.phase) {
      last.toWeek = w.number
      last.end = w.end
    } else phases.push({ phase: w.phase, fromWeek: w.number, toWeek: w.number, start: w.start, end: w.end })
  }

  const nonTaper = weeks.filter(w => w.phase !== 'taper')
  const peakW = nonTaper.reduce((a, b) => (b.targetKm > a.targetKm ? b : a), nonTaper[0] ?? weeks[0])
  const longW = weeks.slice(0, -1).reduce((a, b) => (b.longKm > a.longKm ? b : a), weeks[0])
  const done = weeks.filter(w => w.status === 'done')
  const plannedDone = done.reduce((s, w) => s + w.targetKm, 0)
  const actualDone = done.reduce((s, w) => s + (w.actualKm ?? 0), 0)
  const due = [...done].reverse().find(w => !w.checkIn && daysBetween(w.end, today) <= 7)

  return {
    weeks,
    current,
    phases,
    baselineKm,
    peakKm: peakW.targetKm,
    peakWeek: peakW.number,
    longestLong: { km: longW.longKm, week: longW.number },
    onPlanPct: plannedDone > 0 ? actualDone / plannedDone : null,
    changes: changes.reverse(),
    checkInDue: due?.start ?? null,
  }
}
