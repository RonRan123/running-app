import { classifyEffort, withoutExcluded, zonesOn, type HrProfile } from '@/lib/analysis'
import { addDaysToKey, dayKeyInZone, weekStartKey } from '@/lib/activitySummary'
import { RULES } from '@/lib/racePrinciples'

// Race-time projection for a race goal. Deterministic: depends only on its
// input (no clock), so it can be replayed "as of" any past day for the
// trend line. Every number comes from lib/racePrinciples.ts.
//
// Two methods, blended:
//   1. Riegel from qualifying efforts — hard efforts ≥ 5 km only, with the
//      exponent raised for lower weekly mileage (Vickers & Vertosick 2016).
//   2. A heart-rate vs. pace fit over recent runs, read off at a typical
//      half-marathon heart rate. Works with no hard efforts at all.

export interface PredictionRun {
  id: string
  name: string
  date: string // ISO
  distanceKm: number
  durationSec: number
  avgHeartRate: number | null
  streams: { time: number[]; distance: number[]; heartrate: number[] | null } | null
}

export interface PredictionInput {
  runs: PredictionRun[]
  profile: HrProfile
  today: string // yyyy-MM-dd in the user's time zone; runs after it are ignored
  timeZone: string
  raceKm: number
  raceDate: string // yyyy-MM-dd
}

export type Confidence = 'high' | 'medium' | 'low'

export interface TrailRun {
  runId: string
  name: string
  date: string // yyyy-MM-dd
  text: string
}

export interface PredictionMethod {
  rule: 'RIEGEL_K' | 'HR_PACE_MODEL'
  label: string
  seconds: number
  weight: number // 0–1, after blending
  detail: string
  inputs: TrailRun[]
}

export interface Prediction {
  seconds: number
  low: number
  high: number
  confidence: Confidence
  confidenceReason: string
  raceDay: { low: number; high: number } | null // "if training goes to plan"
  methods: PredictionMethod[]
  excluded: TrailRun[]
  sharpen: string | null
}

// Effort distances tried within each run (km). Capped at the race distance.
const EFFORT_KM = [5, 8.04672, 10, 15, 21.0975]
const RACE_NAME = /\b(race|time ?trial|tt|parkrun|nyrr|trot|tune-?up)\b/i

const DAY_MS = 86_400_000
const daysBetween = (from: string, to: string) =>
  Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS)

/** Riegel's formula: time at `toKm` from a known time at `fromKm`. */
export function riegel(seconds: number, fromKm: number, toKm: number, k: number) {
  return seconds * Math.pow(toKm / fromKm, k)
}

/** Riegel exponent for a weekly volume: 1.06 at ≥ 40 mi/wk, 1.08 at ≤ 20, linear between. */
export function riegelExponent(weeklyKm: number) {
  const { high, low, highMileageKm, lowMileageKm } = RULES.riegelK
  if (weeklyKm >= highMileageKm) return high
  if (weeklyKm <= lowMileageKm) return low
  const t = (weeklyKm - lowMileageKm) / (highMileageKm - lowMileageKm)
  return low + (high - low) * t
}

interface Window {
  seconds: number
  hr: number | null
}

/** Fastest contiguous stretch of `km` in a run, with the mean HR over it. */
export function bestWindow(run: PredictionRun, km: number): Window | null {
  const targetM = km * 1000
  if (run.streams) {
    const { time, distance, heartrate } = run.streams
    if (!distance.length) return null
    const total = distance[distance.length - 1]
    if (total < targetM) {
      // A run that is the distance give or take GPS rounding (9.97 km for a
      // 10K) counts as a whole-run effort, scaled to the exact distance.
      if (total < targetM * 0.99 || total <= 0) return null
      const hrs = heartrate && heartrate.length === time.length ? heartrate.filter(h => h > 0) : []
      return {
        seconds: time[time.length - 1] * (targetM / total),
        hr: hrs.length ? hrs.reduce((a, b) => a + b, 0) / hrs.length : run.avgHeartRate,
      }
    }
    let best = Infinity
    let bi = -1
    let bj = -1
    let j = 0
    for (let i = 0; i < distance.length; i++) {
      while (j < distance.length && distance[j] - distance[i] < targetM) j++
      if (j === distance.length) break
      const t = time[j] - time[i]
      if (t < best) {
        best = t
        bi = i
        bj = j
      }
    }
    if (!Number.isFinite(best) || best <= 0) return null
    let hr: number | null = null
    if (heartrate && heartrate.length === time.length) {
      let sum = 0
      let n = 0
      for (let k = bi; k <= bj; k++) {
        if (heartrate[k] > 0) {
          sum += heartrate[k]
          n++
        }
      }
      hr = n ? sum / n : null
    }
    return { seconds: best, hr }
  }
  // No streams: only the whole run, and only when it is (nearly) the distance,
  // so the run's average HR describes the stretch.
  if (run.distanceKm < km || run.distanceKm > km * 1.25 || run.durationSec <= 0) return null
  return { seconds: run.durationSec * (km / run.distanceKm), hr: run.avgHeartRate }
}

const fmtTime = (s: number) => {
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = Math.round(s % 60)
  const mm = h ? String(m).padStart(2, '0') : String(m)
  return `${h ? `${h}:` : ''}${mm}:${String(sec).padStart(2, '0')}`
}
const kmLabel = (km: number) =>
  Math.abs(km - 21.0975) < 0.01 ? 'half' : Math.abs(km - 8.04672) < 0.01 ? '5 mi' : `${km}K`

interface Candidate {
  run: PredictionRun
  day: string
  km: number
  seconds: number
  hr: number | null
  qualifies: boolean
  why: string
}

/** Projected finish for the race as of `input.today`, or null with no usable data. */
export function predictRace(input: PredictionInput): Prediction | null {
  const { profile, today, timeZone, raceKm, raceDate } = input
  const dayOf = (r: PredictionRun) => dayKeyInZone(new Date(r.date), timeZone)
  const runs = withoutExcluded(input.runs).filter(r => r.durationSec > 0 && dayOf(r) <= today)
  const zones = zonesOn(profile, `${today}T12:00:00Z`)
  const hardThreshold = (zones.easyMax + zones.hardMin) / 2

  // Weekly volume for the Riegel exponent: last 28 days.
  const from28 = addDaysToKey(today, -27)
  const weeklyKm = runs.filter(r => dayOf(r) >= from28).reduce((s, r) => s + r.distanceKm, 0) / 4
  const k = riegelExponent(weeklyKm)

  // ── 1. Qualifying efforts ──
  const windowFrom = addDaysToKey(today, -(RULES.qualifyingWindowDays - 1))
  const recent = runs.filter(r => dayOf(r) >= windowFrom)
  const candidates: Candidate[] = []
  for (const run of recent) {
    const named = RACE_NAME.test(run.name)
    let pick: Candidate | null = null
    let fastestNonQualifying: Candidate | null = null
    for (const km of EFFORT_KM) {
      if (km > raceKm + 0.01 || km < RULES.minEffortKm) continue
      const w = bestWindow(run, km)
      if (!w) continue
      const hard = w.hr != null && classifyEffort(w.hr, zones) !== 'easy' && w.hr >= hardThreshold
      const qualifies = named || hard
      const why = named
        ? `named “${run.name}”`
        : w.hr == null
        ? 'no heart rate over the stretch'
        : `avg ${Math.round(w.hr)} bpm over the stretch`
      const c: Candidate = { run, day: dayOf(run), km, seconds: w.seconds, hr: w.hr, qualifies, why }
      if (qualifies) pick = c // longest qualifying distance wins (loop is ascending)
      else fastestNonQualifying ??= c
    }
    if (pick) candidates.push(pick)
    else if (fastestNonQualifying) candidates.push(fastestNonQualifying)
  }
  const qualifying = candidates.filter(c => c.qualifies)

  let riegelMethod: PredictionMethod | null = null
  if (qualifying.length) {
    let sumW = 0
    let sum = 0
    const inputs: TrailRun[] = []
    for (const c of qualifying) {
      const age = daysBetween(c.day, today)
      const w = Math.sqrt(c.km / raceKm) * Math.pow(0.5, age / 45)
      const est = riegel(c.seconds, c.km, raceKm, k)
      sum += est * w
      sumW += w
      inputs.push({
        runId: c.run.id,
        name: c.run.name,
        date: c.day,
        text: `${kmLabel(c.km)} in ${fmtTime(c.seconds)} (${c.why}) → ${fmtTime(est)}`,
      })
    }
    riegelMethod = {
      rule: 'RIEGEL_K',
      label: `Riegel, k = ${k.toFixed(3).replace(/0$/, '')}`,
      seconds: sum / sumW,
      weight: 1,
      detail: `${qualifying.length} hard effort${qualifying.length === 1 ? '' : 's'} in ${RULES.qualifyingWindowDays} days, weighted toward longer and more recent. k from ${(weeklyKm / 1.609344).toFixed(0)} mi/wk.`,
      inputs,
    }
  }

  // Runs that look fast but don't count, fastest pace first.
  const excluded: TrailRun[] = candidates
    .filter(c => !c.qualifies)
    .sort((a, b) => a.seconds / a.km - b.seconds / b.km)
    .slice(0, 3)
    .map(c => ({
      runId: c.run.id,
      name: c.run.name,
      date: c.day,
      text:
        c.hr == null
          ? `best ${kmLabel(c.km)} ${fmtTime(c.seconds)}, but no heart rate to show it was a hard effort`
          : `best ${kmLabel(c.km)} ${fmtTime(c.seconds)}, ${c.why}: too easy to count as an effort`,
    }))
  for (const run of recent) {
    if (excluded.length >= 4) break
    if (run.distanceKm >= RULES.minEffortKm || !run.avgHeartRate) continue
    if (run.avgHeartRate < hardThreshold) continue
    excluded.push({
      runId: run.id,
      name: run.name,
      date: dayOf(run),
      text: `hard but only ${run.distanceKm.toFixed(1)} km: too short to stretch to a half`,
    })
  }

  // ── 2. Heart rate vs. pace ──
  const hrFrom = addDaysToKey(today, -(RULES.hrModelDays - 1))
  const steady = runs.filter(
    r => dayOf(r) >= hrFrom && r.avgHeartRate && r.durationSec >= 20 * 60 && r.distanceKm >= 3,
  )
  let hrMethod: PredictionMethod | null = null
  if (steady.length >= RULES.hrModelMinRuns) {
    const xs = steady.map(r => r.avgHeartRate!)
    const ys = steady.map(r => (r.distanceKm * 1000) / r.durationSec)
    const mx = xs.reduce((s, x) => s + x, 0) / xs.length
    const my = ys.reduce((s, y) => s + y, 0) / ys.length
    let sxy = 0
    let sxx = 0
    for (let i = 0; i < xs.length; i++) {
      sxy += (xs[i] - mx) * (ys[i] - my)
      sxx += (xs[i] - mx) ** 2
    }
    const slope = sxx > 0 ? sxy / sxx : 0
    const targetHr = RULES.hmHrShare * zones.maxHr
    const speed = my + slope * (targetHr - mx)
    const spread = Math.sqrt(sxx / xs.length)
    if (slope > 0 && spread >= 3 && speed > 0) {
      const seconds = (raceKm * 1000) / speed
      const paceMinPerMi = 1609.344 / speed / 60
      hrMethod = {
        rule: 'HR_PACE_MODEL',
        label: 'Heart rate vs. pace',
        seconds,
        weight: 1,
        detail: `Fit on ${steady.length} runs from the last ${RULES.hrModelDays / 7} weeks. Pace at half-marathon effort (${Math.round(targetHr)} bpm): ${Math.floor(paceMinPerMi)}:${String(Math.round((paceMinPerMi % 1) * 60)).padStart(2, '0')} /mi.${targetHr - Math.max(...xs) > 20 ? ' Far above your usual heart rates, so treat it loosely.' : ''}`,
        inputs: [],
      }
    }
  }

  if (!riegelMethod && !hrMethod) return null

  const methods = [riegelMethod, hrMethod].filter((m): m is PredictionMethod => m != null)
  if (methods.length === 2) {
    riegelMethod!.weight = RULES.blendWeights.riegel
    hrMethod!.weight = RULES.blendWeights.hr
  }
  const seconds = methods.reduce((s, m) => s + m.seconds * m.weight, 0)

  // ── Confidence ──
  const disagree = methods.length === 2 ? Math.abs(methods[0].seconds - methods[1].seconds) / seconds : 0
  const last60 = qualifying.filter(c => daysBetween(c.day, today) < 60)
  let confidence: Confidence
  let confidenceReason: string
  if (last60.length >= 2 && last60.some(c => c.km >= 10) && disagree <= 0.03) {
    confidence = 'high'
    confidenceReason = `${last60.length} hard efforts in the last 60 days, one of 10K or more${methods.length === 2 ? '; the methods agree' : ''}.`
  } else if (qualifying.length >= 1) {
    confidence = 'medium'
    confidenceReason = `${qualifying.length} hard effort${qualifying.length === 1 ? '' : 's'} in the last ${RULES.qualifyingWindowDays} days${methods.length === 2 ? `; the methods are ${disagree <= 0.03 ? 'within' : 'more than'} 3% apart` : ''}.`
  } else {
    confidence = 'low'
    confidenceReason = 'No hard efforts in the last 90 days, so this leans on easy runs alone.'
  }
  const pct = RULES.rangePct[confidence]

  // ── Race day, if training goes to plan ──
  const weeksLeft = Math.max(0, Math.floor(daysBetween(today, raceDate) / 7))
  const trainingWeeks = Math.max(0, weeksLeft - RULES.taperWeeks)
  const gain = Math.min(RULES.gainMax, RULES.gainPerWeek * trainingWeeks)
  const raceDay = daysBetween(today, raceDate) > 0 ? { low: seconds * (1 - gain), high: seconds } : null

  return {
    seconds: Math.round(seconds),
    low: Math.round(seconds * (1 - pct)),
    high: Math.round(seconds * (1 + pct)),
    confidence,
    confidenceReason,
    raceDay: raceDay && { low: Math.round(raceDay.low), high: Math.round(raceDay.high) },
    methods,
    excluded,
    sharpen:
      confidence === 'high'
        ? null
        : 'A 5K time trial or a tune-up race gives a real effort to work from and narrows the range.',
  }
}

/** The projection as of each of the last `weeks` Sundays (oldest first), for the trend line. */
export function predictionTrend(input: PredictionInput, weeks = 8) {
  const thisMonday = weekStartKey(input.today)
  const out: { weekStart: string; seconds: number | null }[] = []
  for (let k = weeks - 1; k >= 0; k--) {
    const weekStart = addDaysToKey(thisMonday, -7 * k)
    const asOf = k === 0 ? input.today : addDaysToKey(weekStart, 6)
    out.push({ weekStart, seconds: predictRace({ ...input, today: asOf })?.seconds ?? null })
  }
  return out
}

/** Training paces (min/km) from a projected race time, via Riegel k = 1.06. */
export function trainingPaces(raceSeconds: number, raceKm: number) {
  const race = raceSeconds / 60 / raceKm
  // Threshold ≈ the pace you could hold for about an hour.
  const hourKm = raceKm * Math.pow(3600 / raceSeconds, 1 / 1.06)
  const threshold = 60 / hourKm
  const tenK = riegel(raceSeconds, raceKm, 10, 1.06) / 60 / 10
  return { race, threshold, tenK }
}
