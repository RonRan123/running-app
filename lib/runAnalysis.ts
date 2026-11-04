import { classifyEffort, type Effort, type HrZones } from '@/lib/analysis'

// Per-sample streams for one run, all arrays aligned with `time`.
export interface RunStreams {
  time: number[]            // seconds from start
  heartrate: number[] | null
  velocity: number[] | null // m/s
  altitude: number[] | null // meters
  cadence: number[] | null
  distance: number[] | null // cumulative meters
}


/** Time-weighted % of the run spent at or below the MAF target. */
export function pctAtOrBelowMaf(time: number[], heartrate: number[], maf: number) {
  let below = 0
  let total = 0
  for (let i = 1; i < time.length; i++) {
    const dt = time[i] - time[i - 1]
    if (dt <= 0) continue
    total += dt
    if (heartrate[i] <= maf) below += dt
  }
  return total > 0 ? (below / total) * 100 : 0
}

/** Seconds spent in each effort band, classified sample-by-sample. */
export function timeInZones(time: number[], heartrate: number[], hrZones: HrZones) {
  const zones: Record<Effort, number> = { easy: 0, moderate: 0, hard: 0 }
  for (let i = 1; i < time.length; i++) {
    const dt = time[i] - time[i - 1]
    if (dt <= 0 || heartrate[i] <= 0) continue
    zones[classifyEffort(heartrate[i], hrZones)] += dt
  }
  return zones
}

// Below this speed a sample is treated as walking / standing, not running form.
const MIN_RUNNING_SPEED = 1.5 // m/s (~11:07 min/km)

/**
 * Cadence streams from Intervals.icu / FIT record one foot (~70–95 rpm).
 * Runners talk in steps per minute (both feet, ~150–190), so double any
 * stream whose typical value is clearly one-foot.
 */
export function normalizeCadence(cadence: number[]): number[] {
  const positive = cadence.filter(c => c > 0).sort((a, b) => a - b)
  const median = positive[positive.length >> 1] ?? 0
  return median > 0 && median < 120 ? cadence.map(c => c * 2) : cadence
}

/**
 * Average cadence (steps/min) and step length (m) over running samples.
 * Step length is total distance ÷ total steps, not a mean of per-sample
 * ratios, so slow noisy samples don't skew it. This is what Garmin calls
 * "stride length". Distance comes from the cumulative distance stream:
 * velocity_smooth carries GPS spikes that inflate step length by 50 %+ on
 * some runs, while the distance stream agrees with the run's total.
 */
export function runningForm(
  time: number[],
  cadence: number[],
  velocity: number[],
  distance: number[],
): { cadenceSpm: number; stepLengthM: number } | null {
  const spm = normalizeCadence(cadence)
  let seconds = 0
  let steps = 0
  let meters = 0
  for (let i = 1; i < time.length; i++) {
    const dt = time[i] - time[i - 1]
    // Skip pauses (multi-second gaps) and non-running samples.
    if (dt <= 0 || dt > 10 || !(spm[i] > 0) || !(velocity[i] >= MIN_RUNNING_SPEED)) continue
    const dd = distance[i] - distance[i - 1]
    if (!(dd >= 0)) continue
    seconds += dt
    steps += (spm[i] / 60) * dt
    meters += dd
  }
  if (seconds < 120 || steps === 0) return null
  const cadenceSpm = (steps / seconds) * 60
  // A session averaging under ~120 spm is a walk or hike, not running form.
  if (cadenceSpm < 120) return null
  return { cadenceSpm, stepLengthM: meters / steps }
}

export type Movement = 'running' | 'walking' | 'stopped'

export interface MovementSplit {
  runningSec: number
  walkingSec: number
  stoppedSec: number
  longestRunSec: number // longest unbroken running stretch
  breaks: number        // walks or stops ≥ MIN_BREAK_SEC, including at either end
}

// Cadence bands (steps/min, both feet). Real data is bimodal: walking sits
// around 100–120 spm, running 140–160, with little in between.
const RUN_MIN_SPM = 130
const WALK_MIN_SPM = 60
// Above this the cadence reading is a glitch — fall back to speed.
const MAX_PLAUSIBLE_SPM = 230
// Speed bands used when cadence is missing or zero (dropouts happen mid-run).
const STOPPED_MAX_SPEED = 0.5 // m/s — standing at a light, shuffling in place
const WALK_MAX_SPEED = 1.9    // m/s (~8:46 min/km)
// Smart recording logs every few seconds; longer gaps are auto-pauses or
// GPS dropouts and get classified by the distance covered across the gap.
const MAX_SAMPLE_GAP = 10
// Non-running stretches shorter than this are sensor blips, not breaks.
const MIN_BREAK_SEC = 10

/**
 * Seconds running, walking and stopped across the run's full elapsed time.
 * Stops (traffic lights, pauses) stay in the total — nothing is trimmed —
 * so the split reflects the run as it actually happened.
 */
export function movementSplit(
  time: number[],
  cadence: number[] | null,
  velocity: number[] | null,
  distance: number[] | null,
): MovementSplit | null {
  if (!cadence && !velocity) return null
  const spm = cadence ? normalizeCadence(cadence) : null

  const bySpeed = (v: number): Movement =>
    v < STOPPED_MAX_SPEED ? 'stopped' : v < WALK_MAX_SPEED ? 'walking' : 'running'

  const classify = (i: number, dt: number): Movement => {
    if (dt > MAX_SAMPLE_GAP && distance) {
      const dd = distance[i] - distance[i - 1]
      if (dd >= 0) return bySpeed(dd / dt)
    }
    // Running cadence wins over speed: treadmills report ~0 m/s.
    const s = spm?.[i] ?? 0
    if (s >= RUN_MIN_SPM && s <= MAX_PLAUSIBLE_SPM) return 'running'
    const v = velocity?.[i] ?? 0
    if (velocity && v < STOPPED_MAX_SPEED) return 'stopped'
    if (s >= WALK_MIN_SPM && s < RUN_MIN_SPM) return 'walking'
    return velocity ? bySpeed(v) : 'stopped'
  }

  const out = { runningSec: 0, walkingSec: 0, stoppedSec: 0, longestRunSec: 0, breaks: 0 }
  let stretch = 0 // current running stretch, including blips inside it
  let pause = 0   // current non-running time since the last running sample
  for (let i = 1; i < time.length; i++) {
    const dt = time[i] - time[i - 1]
    if (!(dt > 0)) continue
    const m = classify(i, dt)
    out[`${m}Sec`] += dt
    if (m !== 'running') {
      pause += dt
      continue
    }
    // Warm-up and cool-down walks count too: if the watch recorded it, it's
    // part of the run.
    if (pause >= MIN_BREAK_SEC) {
      out.longestRunSec = Math.max(out.longestRunSec, stretch)
      out.breaks++
      stretch = dt
    } else {
      stretch += pause + dt
    }
    pause = 0
  }
  if (pause >= MIN_BREAK_SEC && out.runningSec > 0) out.breaks++
  out.longestRunSec = Math.max(out.longestRunSec, stretch)
  const total = out.runningSec + out.walkingSec + out.stoppedSec
  return total >= 120 ? out : null
}

/** Rolling time-window average — smooths noisy per-sample series for display. */
export function smoothSeries(time: number[], values: number[], windowSec = 30): number[] {
  const out = new Array<number>(values.length)
  let lo = 0
  let sum = 0
  let count = 0
  let hi = 0
  for (let i = 0; i < values.length; i++) {
    while (hi < values.length && time[hi] <= time[i] + windowSec / 2) {
      sum += values[hi]
      count++
      hi++
    }
    while (time[lo] < time[i] - windowSec / 2) {
      sum -= values[lo]
      count--
      lo++
    }
    out[i] = count > 0 ? sum / count : values[i]
  }
  return out
}

/**
 * Minetti energy-cost polynomial for running on a gradient (J/kg/m).
 * C(0) = 3.6 on the flat; the ratio C(g)/C(0) converts real velocity into
 * grade-adjusted velocity (uphill GAP is faster than actual, downhill slower).
 */
function minettiCost(grade: number) {
  const g = Math.max(-0.3, Math.min(0.3, grade))
  return 155.4 * g ** 5 - 30.4 * g ** 4 - 43.3 * g ** 3 + 46.3 * g ** 2 + 19.5 * g + 3.6
}

/**
 * Grade-adjusted velocity per sample (m/s). Altitude is smoothed before the
 * gradient is taken so GPS elevation noise doesn't whipsaw the adjustment.
 */
export function gradeAdjustedVelocity(streams: RunStreams): number[] | null {
  const { time, velocity, altitude } = streams
  const distance = streams.distance ?? integrateDistance(streams)
  if (!velocity || !altitude || !distance) return null

  const smoothAlt = smoothSeries(time, altitude, 30)
  const out = new Array<number>(velocity.length)
  for (let i = 0; i < velocity.length; i++) {
    const j = Math.max(0, i - 1)
    const dDist = distance[i] - distance[j]
    const grade = dDist > 1 ? (smoothAlt[i] - smoothAlt[j]) / dDist : 0
    out[i] = velocity[i] * (minettiCost(grade) / 3.6)
  }
  return out
}

/** Cumulative meters integrated from velocity when no distance stream exists. */
export function integrateDistance(streams: RunStreams): number[] | null {
  const { time, velocity } = streams
  if (!velocity) return null
  const out = new Array<number>(time.length)
  out[0] = 0
  for (let i = 1; i < time.length; i++) {
    const dt = Math.max(0, time[i] - time[i - 1])
    out[i] = out[i - 1] + velocity[i] * dt
  }
  return out
}

export interface Split {
  index: number          // 1-based split number
  distanceM: number      // length of this split in meters (last one may be partial)
  seconds: number
  paceMinPerKm: number
  gapMinPerKm: number | null
  avgHr: number | null
  elevGainM: number | null
}

/** Per-mile or per-km splits computed from the cumulative distance stream. */
export function computeSplits(streams: RunStreams, splitMeters: number): Split[] {
  const { time, heartrate, altitude } = streams
  const distance = streams.distance ?? integrateDistance(streams)
  if (!distance || distance[distance.length - 1] < splitMeters * 0.1) return []

  const gapVel = gradeAdjustedVelocity(streams)
  const smoothAlt = altitude ? smoothSeries(time, altitude, 30) : null

  const splits: Split[] = []
  let startIdx = 0

  const closeSplit = (endIdx: number) => {
    const distM = distance[endIdx] - distance[startIdx]
    const secs = time[endIdx] - time[startIdx]
    if (distM < 1 || secs <= 0) return

    let hrSum = 0
    let hrCount = 0
    let elevGain = 0
    let gapDist = 0
    for (let i = startIdx + 1; i <= endIdx; i++) {
      const dt = time[i] - time[i - 1]
      if (heartrate && heartrate[i] > 0) {
        hrSum += heartrate[i] * dt
        hrCount += dt
      }
      if (smoothAlt) {
        const dAlt = smoothAlt[i] - smoothAlt[i - 1]
        if (dAlt > 0) elevGain += dAlt
      }
      if (gapVel) gapDist += gapVel[i] * dt
    }

    splits.push({
      index: splits.length + 1,
      distanceM: distM,
      seconds: secs,
      paceMinPerKm: secs / 60 / (distM / 1000),
      gapMinPerKm: gapVel && gapDist > 0 ? secs / 60 / (gapDist / 1000) : null,
      avgHr: hrCount > 0 ? Math.round(hrSum / hrCount) : null,
      elevGainM: smoothAlt ? Math.round(elevGain) : null,
    })
  }

  for (let i = 1; i < distance.length; i++) {
    if (distance[i] - distance[startIdx] >= splitMeters) {
      closeSplit(i)
      startIdx = i
    }
  }
  // Trailing partial split (only if it's at least 10% of a full split)
  if (distance[distance.length - 1] - distance[startIdx] >= splitMeters * 0.1) {
    closeSplit(distance.length - 1)
  }

  return splits
}

/**
 * Evenly thin aligned stream arrays to at most `maxPoints` samples so chart
 * payloads stay small. Always keeps the first and last sample.
 */
export function downsampleStreams(streams: RunStreams, maxPoints = 1500): RunStreams {
  const n = streams.time.length
  if (n <= maxPoints) return streams

  const pick = (arr: number[] | null) => {
    if (!arr) return null
    const out: number[] = []
    for (let i = 0; i < maxPoints; i++) {
      out.push(arr[Math.round((i * (n - 1)) / (maxPoints - 1))])
    }
    return out
  }

  return {
    time: pick(streams.time)!,
    heartrate: pick(streams.heartrate),
    velocity: pick(streams.velocity),
    altitude: pick(streams.altitude),
    cadence: pick(streams.cadence),
    distance: pick(streams.distance),
  }
}
