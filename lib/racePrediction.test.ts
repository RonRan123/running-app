import { describe, expect, it } from 'vitest'
import { addDaysToKey } from '@/lib/activitySummary'
import {
  bestWindow,
  predictRace,
  predictionTrend,
  riegel,
  riegelExponent,
  trainingPaces,
  type PredictionInput,
  type PredictionRun,
} from '@/lib/racePrediction'
import { RULES } from '@/lib/racePrinciples'

const MI = 1.609344
// Age 30 on these dates: easy ≤ 150, hard ≥ 165, max HR 190.
const profile = { birthDate: '1996-06-01', age: null, recordedMax: 185 }
const TODAY = '2027-01-13'

let seq = 0
/** A run at constant pace and HR, with 1-second streams. */
function run(day: string, km: number, paceMinPerKm: number, hr: number, name = 'Morning Run'): PredictionRun {
  const seconds = Math.round(km * paceMinPerKm * 60)
  const speed = (km * 1000) / seconds
  const time = Array.from({ length: seconds + 1 }, (_, i) => i)
  return {
    id: `p${seq++}`,
    name,
    date: `${day}T12:00:00Z`,
    distanceKm: km,
    durationSec: seconds,
    avgHeartRate: hr,
    streams: { time, distance: time.map(t => t * speed), heartrate: time.map(() => hr) },
  }
}

/** 4 easy runs a week for 8 weeks, HR varying with pace (for the HR model). */
function easyWeeks(): PredictionRun[] {
  const out: PredictionRun[] = []
  for (let w = 1; w <= 8; w++) {
    for (const [d, pace, hr] of [
      [1, 6.6, 140],
      [3, 6.3, 146],
      [5, 6.9, 136],
      [6, 6.0, 152],
    ] as const) {
      out.push(run(addDaysToKey(TODAY, -7 * w + d - 7), 8, pace, hr))
    }
  }
  return out
}

const input = (runs: PredictionRun[], over: Partial<PredictionInput> = {}): PredictionInput => ({
  runs,
  profile,
  today: TODAY,
  timeZone: 'UTC',
  raceKm: 21.0975,
  raceDate: '2027-03-21',
  ...over,
})

describe('Riegel', () => {
  it('scales time by distance ratio to the k', () => {
    expect(riegel(3000, 10, 21.0975, 1.06)).toBeCloseTo(3000 * Math.pow(2.10975, 1.06), 6)
  })

  it('raises k for lower weekly mileage', () => {
    expect(riegelExponent(50 * MI)).toBe(RULES.riegelK.high)
    expect(riegelExponent(10 * MI)).toBe(RULES.riegelK.low)
    const mid = riegelExponent(30 * MI)
    expect(mid).toBeGreaterThan(1.06)
    expect(mid).toBeLessThan(1.08)
  })
})

describe('bestWindow', () => {
  it('finds the fastest stretch and its average heart rate', () => {
    const r = run('2027-01-01', 12, 5, 170)
    const w = bestWindow(r, 10)!
    expect(w.seconds).toBeCloseTo(3000, -1)
    expect(w.hr).toBeCloseTo(170)
  })

  it('treats a run a hair short of the distance as a whole-run effort', () => {
    const r = run('2027-01-01', 9.95, 5, 170)
    const w = bestWindow(r, 10)!
    expect(w.seconds).toBeCloseTo(9.95 * 5 * 60 * (10 / 9.95), -1)
    expect(bestWindow(run('2027-01-01', 9.5, 5, 170), 10)).toBeNull()
  })

  it('without streams, only uses a run that is about the distance', () => {
    const r = { ...run('2027-01-01', 10.2, 5, 170), streams: null }
    expect(bestWindow(r, 10)).not.toBeNull()
    expect(bestWindow({ ...r, distanceKm: 16 }, 10)).toBeNull()
  })
})

describe('predictRace', () => {
  it('uses only hard efforts; easy long runs never predict a race', () => {
    const easyOnly = predictRace(input([run('2027-01-02', 16, 6.5, 138)]))
    expect(easyOnly).toBeNull() // no hard efforts and too few runs for the HR model
  })

  it('predicts from a hard 10K with a mileage-adjusted Riegel', () => {
    const tenK = run('2026-12-19', 10, 5.25, 172)
    const p = predictRace(input([tenK]))!
    const m = p.methods[0]
    expect(m.rule).toBe('RIEGEL_K')
    const k = riegelExponent(10 / 4) // only this run in the last 28 days
    expect(p.seconds).toBeCloseTo(riegel(10 * 5.25 * 60, 10, 21.0975, k), -1)
    expect(p.confidence).toBe('medium')
    expect(p.low).toBeLessThan(p.seconds)
    expect(p.high).toBeGreaterThan(p.seconds)
  })

  it('counts a run named as a race even without heart rate', () => {
    const r = { ...run('2026-12-19', 10, 5.25, 0, 'NYRR Joe Kleinerman 10K'), avgHeartRate: null }
    r.streams = { ...r.streams!, heartrate: null }
    expect(predictRace(input([r]))?.methods[0].rule).toBe('RIEGEL_K')
  })

  it('ignores efforts shorter than 5K', () => {
    const p = predictRace(input([run('2026-12-19', 3, 4.5, 178)]))
    expect(p).toBeNull()
  })

  it('lists fast-but-easy runs it left out', () => {
    const p = predictRace(input([run('2026-12-19', 10, 5.25, 172), run('2027-01-02', 16, 6.0, 140, 'Long run')]))!
    expect(p.excluded.map(e => e.name)).toContain('Long run')
  })

  it('falls back to the heart-rate model with low confidence', () => {
    const p = predictRace(input(easyWeeks()))!
    expect(p.methods.map(m => m.rule)).toEqual(['HR_PACE_MODEL'])
    expect(p.confidence).toBe('low')
    expect(p.sharpen).not.toBeNull()
    // Faster than easy pace, slower than world class.
    expect(p.seconds / 21.0975 / 60).toBeLessThan(6.0)
    expect(p.seconds / 21.0975 / 60).toBeGreaterThan(3.5)
  })

  it('blends both methods 60/40 and is high confidence with two recent hard efforts', () => {
    const runs = [...easyWeeks(), run('2026-12-19', 10, 5.25, 172), run('2027-01-09', 5, 5.0, 175)]
    const p = predictRace(input(runs))!
    expect(p.methods.map(m => [m.rule, m.weight])).toEqual([
      ['RIEGEL_K', 0.6],
      ['HR_PACE_MODEL', 0.4],
    ])
    expect(p.seconds).toBeCloseTo(p.methods[0].seconds * 0.6 + p.methods[1].seconds * 0.4, -1)
    expect(['high', 'medium']).toContain(p.confidence)
  })

  it('gives a conservative race-day range', () => {
    const p = predictRace(input([run('2026-12-19', 10, 5.25, 172)]))!
    expect(p.raceDay!.high).toBe(p.seconds)
    expect(p.raceDay!.low).toBeGreaterThanOrEqual(Math.round(p.seconds * (1 - RULES.gainMax)))
  })

  it('ignores runs after "today"', () => {
    const tenK = run('2026-12-19', 10, 5.25, 172)
    const later = run('2027-02-01', 10, 4.5, 175)
    expect(predictRace(input([tenK, later]))).toEqual(predictRace(input([tenK])))
    expect(predictRace(input([later]))).toBeNull()
  })
})

describe('trend and paces', () => {
  it('replays the projection week by week', () => {
    const t = predictionTrend(input([run('2026-12-19', 10, 5.25, 172)]), 6)
    expect(t).toHaveLength(6)
    expect(t[0].seconds).toBeNull() // before the 10K
    expect(t.at(-1)!.seconds).not.toBeNull()
  })

  it('derives threshold faster than race pace and 10K faster still', () => {
    const p = trainingPaces(7000, 21.0975)
    expect(p.threshold).toBeLessThan(p.race)
    expect(p.tenK).toBeLessThan(p.race)
    expect(p.race).toBeCloseTo(7000 / 60 / 21.0975, 6)
  })
})
