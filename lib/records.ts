import { KM_PER_MILE } from '@/lib/units'

export interface PrTarget {
  km: number
  label: string
}

export const PR_TARGETS: PrTarget[] = [
  { km: 1, label: '1K' },
  { km: KM_PER_MILE, label: '1 Mile' },
  { km: 5, label: '5K' },
  { km: 10, label: '10K' },
  { km: 21.0975, label: 'Half Marathon' },
  { km: 42.195, label: 'Marathon' },
]

export interface EffortActivity {
  id: string
  name: string
  date: string
  distance: number // km
  duration: number // seconds
  // Aligned time (s) / cumulative distance (m) streams when stored
  streams: { time: number[]; distance: number[] } | null
}

export interface Effort {
  activityId: string
  name: string
  date: string
  seconds: number
  fromStreams: boolean // true = exact rolling sub-split, false = whole-run average
}

/**
 * Fastest contiguous stretch covering `targetKm` within one run.
 * Uses a two-pointer sweep over the cumulative distance stream; falls back to
 * scaling the whole-run average pace when no streams are stored.
 */
export function bestEffortForRun(a: EffortActivity, targetKm: number): Effort | null {
  const targetM = targetKm * 1000

  if (a.streams) {
    const { time, distance } = a.streams
    if (distance[distance.length - 1] < targetM) return null

    let best = Infinity
    let j = 0
    for (let i = 0; i < distance.length; i++) {
      while (j < distance.length && distance[j] - distance[i] < targetM) j++
      if (j === distance.length) break
      best = Math.min(best, time[j] - time[i])
    }
    if (!Number.isFinite(best) || best <= 0) return null
    return { activityId: a.id, name: a.name, date: a.date, seconds: best, fromStreams: true }
  }

  // Whole-run fallback: only count runs that actually covered the distance.
  if (a.distance < targetKm || a.duration <= 0) return null
  return {
    activityId: a.id,
    name: a.name,
    date: a.date,
    seconds: Math.round(a.duration * (targetKm / a.distance)),
    fromStreams: false,
  }
}

export interface DistanceRecord {
  target: PrTarget
  best: Effort
  history: Effort[] // one entry per qualifying run, sorted by date ascending
}

/** Best effort per PR target across all runs, plus full per-run history. */
export function bestEfforts(activities: EffortActivity[]): DistanceRecord[] {
  const records: DistanceRecord[] = []
  for (const target of PR_TARGETS) {
    const history = activities
      .map(a => bestEffortForRun(a, target.km))
      .filter((e): e is Effort => e !== null)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    if (history.length === 0) continue
    const best = history.reduce((min, e) => (e.seconds < min.seconds ? e : min))
    records.push({ target, best, history })
  }
  return records
}

/** Riegel formula: predicted time at a new distance from a known performance. */
export function riegel(knownSeconds: number, knownKm: number, targetKm: number, exp = 1.06) {
  return knownSeconds * Math.pow(targetKm / knownKm, exp)
}

export interface RacePrediction {
  seconds: number
  basis: { label: string; seconds: number; date: string; name: string }
}

/**
 * Predict a race time from recent best efforts (Riegel). The longest recent
 * effort distance is the most specific predictor for longer races, so use it.
 */
export function predictRaceTime(
  records: DistanceRecord[],
  raceKm: number,
  recentWindowDays = 90,
): RacePrediction | null {
  const cutoff = Date.now() - recentWindowDays * 24 * 60 * 60 * 1000

  let basis: { target: PrTarget; effort: Effort } | null = null
  for (const r of records) {
    const recentBest = r.history
      .filter(e => new Date(e.date).getTime() >= cutoff)
      .reduce<Effort | null>((min, e) => (min === null || e.seconds < min.seconds ? e : min), null)
    if (!recentBest) continue
    if (!basis || r.target.km > basis.target.km) {
      basis = { target: r.target, effort: recentBest }
    }
  }
  if (!basis) return null

  return {
    seconds: Math.round(riegel(basis.effort.seconds, basis.target.km, raceKm)),
    basis: {
      label: basis.target.label,
      seconds: basis.effort.seconds,
      date: basis.effort.date,
      name: basis.effort.name,
    },
  }
}
