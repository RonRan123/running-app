import { describe, expect, it } from 'vitest'
import {
  baseBuilding,
  fitnessFatigue,
  hrProfile,
  trimp,
  withoutBirthDate,
  zonesOn,
  type AnalysisActivity,
  type HrProfile,
} from '@/lib/analysis'

function run(date: string, min: number, hr: number | null = 140, km = min / 8): AnalysisActivity {
  return { id: date + min, name: 'Run', date, distance: km, duration: min * 60, avgPace: 8, avgHeartRate: hr, maxHeartRate: null }
}

describe('resting and max heart rate from Settings', () => {
  const settings = { birthDate: new Date('1996-01-01T00:00:00Z'), age: null }
  const DAY = '2026-11-02T12:00:00Z'

  it('defaults to resting 60 and a max of 220 − age', () => {
    const profile = hrProfile(settings, [])
    expect(zonesOn(profile, DAY).maxHr).toBe(190)
    expect(trimp(run(DAY, 30, 125), 190)).toBeCloseTo(trimp(run(DAY, 30, 125), 190, 60))
  })

  it('uses the overrides for max HR, the hard zone and training load', () => {
    const profile = hrProfile({ ...settings, restingHr: 50, maxHr: 200 }, [run(DAY, 30)])
    const zones = zonesOn(profile, DAY)
    expect(zones.maxHr).toBe(200)
    expect(zones.hardMin).toBe(174) // 87% of 200
    expect(zones.easyMax).toBe(150) // still 180 − age
    // A lower resting HR makes the same heart rate a bigger share of the reserve.
    expect(trimp(run(DAY, 30, 125), 190, 50)).toBeGreaterThan(trimp(run(DAY, 30, 125), 190, 60))
    const withOverride = fitnessFatigue([run(DAY, 30, 140)], profile, 1, new Date(DAY)).at(-1)!
    const without = fitnessFatigue([run(DAY, 30, 140)], hrProfile(settings, []), 1, new Date(DAY)).at(-1)!
    expect(withOverride.atl).not.toBeCloseTo(without.atl)
  })

  it('never sends the overrides to the demo', () => {
    const profile = hrProfile({ ...settings, restingHr: 50, maxHr: 200 }, [])
    const demo = withoutBirthDate(profile, DAY)
    expect(demo).toEqual({ birthDate: null, age: 30, recordedMax: 0 })
  })
})

describe('base building summary', () => {
  const PROFILE: HrProfile = { birthDate: '1996-01-01', age: null, recordedMax: 0 } // easy ≤ 150
  const NOW = new Date('2026-11-11T12:00:00') // a Wednesday
  // Mondays: Nov 9 (this week), Nov 2, Oct 26, Oct 19 …
  const acts = [
    run('2026-10-20T12:00:00', 30), run('2026-10-22T12:00:00', 30), run('2026-10-24T12:00:00', 40),
    run('2026-10-27T12:00:00', 30), run('2026-10-29T12:00:00', 30), run('2026-10-31T12:00:00', 45),
    run('2026-11-03T12:00:00', 35), run('2026-11-05T12:00:00', 30, 170), run('2026-11-07T12:00:00', 50),
    run('2026-11-10T12:00:00', 30),
  ]

  it('gives easy minutes, long run and run count per week, oldest first', () => {
    const { weeks } = baseBuilding(acts, PROFILE, 4, NOW)
    expect(weeks.map(w => w.weekStart)).toEqual(['2026-10-19', '2026-10-26', '2026-11-02', '2026-11-09'])
    expect(weeks.map(w => w.runs)).toEqual([3, 3, 3, 1])
    expect(weeks.map(w => Math.round(w.totalMin))).toEqual([100, 105, 115, 30])
    expect(weeks.map(w => Math.round(w.easyMin))).toEqual([100, 105, 85, 30]) // the 170-bpm run isn't easy
    expect(weeks[2].longKm).toBeCloseTo(50 / 8)
  })

  it('counts weeks in a row with 3+ runs, not breaking on the week in progress', () => {
    expect(baseBuilding(acts, PROFILE, 4, NOW).streak).toBe(3)
    expect(baseBuilding(acts.slice(3), PROFILE, 4, NOW).streak).toBe(2)
    expect(baseBuilding(acts.filter(a => !a.date.startsWith('2026-10-29')), PROFILE, 4, NOW).streak).toBe(1)
  })

  it('includes empty weeks', () => {
    const { weeks, streak } = baseBuilding([], PROFILE, 8, NOW)
    expect(weeks).toHaveLength(8)
    expect(weeks.every(w => w.totalMin === 0)).toBe(true)
    expect(streak).toBe(0)
  })
})
