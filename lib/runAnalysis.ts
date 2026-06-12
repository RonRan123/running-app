import { classifyEffort, type Effort } from '@/lib/analysis'

// Per-sample streams for one run, all arrays aligned with `time`.
export interface RunStreams {
  time: number[]            // seconds from start
  heartrate: number[] | null
  velocity: number[] | null // m/s
  altitude: number[] | null // meters
  cadence: number[] | null
  distance: number[] | null // cumulative meters
}

/** Maffetone target HR: 180 − age. The aerobic band shown is (maf − 10)..maf. */
export function mafTarget(age: number) {
  return 180 - age
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
export function timeInZones(time: number[], heartrate: number[], maxHr: number) {
  const zones: Record<Effort, number> = { easy: 0, moderate: 0, hard: 0 }
  for (let i = 1; i < time.length; i++) {
    const dt = time[i] - time[i - 1]
    if (dt <= 0 || heartrate[i] <= 0) continue
    zones[classifyEffort(heartrate[i], maxHr)] += dt
  }
  return zones
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
