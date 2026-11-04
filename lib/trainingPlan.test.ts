import { describe, expect, it } from 'vitest'
import { addDaysToKey } from '@/lib/activitySummary'
import {
  acuteChronicRatio,
  fitnessFatigue,
  type AnalysisActivity,
  type HrProfile,
} from '@/lib/analysis'
import {
  HR_CAP,
  layoutWeek,
  planNextWeek,
  runsPerWeek,
  type LayoutContext,
  type PlanDay,
  type WeekPlan,
} from '@/lib/trainingPlan'

// Synthetic history only. Runs sit at noon UTC so their local day is the
// same in any test-runner time zone; plans use timeZone 'UTC'.

const PROFILE: HrProfile = { birthDate: '2002-07-23', age: null, recordedMax: 196 }
const MONDAY = '2026-11-02'
const PACE = 8 // min/km

let seq = 0
function run(day: string, min: number, hr = 150, id?: string): AnalysisActivity {
  return {
    id: id ?? `run-${seq++}`,
    name: 'Run',
    date: `${day}T12:00:00Z`,
    distance: min / PACE,
    duration: min * 60,
    avgPace: PACE,
    avgHeartRate: hr,
    maxHeartRate: null,
  }
}

/**
 * Weekly volumes, oldest first, ending the day before `start`. Each week's
 * minutes are split over three runs on days 1, 3 and 5 of the block, so
 * there is never a 7-day gap.
 */
function weeks(start: string, volumes: number[], hr = 150): AnalysisActivity[] {
  return volumes.flatMap((vol, i) => {
    const blockStart = addDaysToKey(start, -7 * (volumes.length - i))
    if (vol === 0) return []
    const each = vol / 3
    return [1, 3, 5].map(off => run(addDaysToKey(blockStart, off), each, hr))
  })
}

/**
 * A warmed-up history: 16 steady weeks (so CTL has settled and the load
 * ratio is meaningful) followed by the scenario's weeks.
 */
function hist(volumes: number[], base = 150) {
  return weeks(MONDAY, [...Array(16).fill(base), ...volumes])
}

function plan(activities: AnalysisActivity[], today = MONDAY) {
  return planNextWeek({ activities, profile: PROFILE, today, timeZone: 'UTC' })
}

const weekday = (d: string) => new Date(`${d}T00:00:00Z`).getUTCDay()
const runDays = (p: { days: PlanDay[] }) => p.days.filter(d => d.runMin > 0)
const labels = (p: WeekPlan) => p.calc.map(c => c.label)

describe('rule 1: HR cap', () => {
  it('caps every run at 156 and plans only easy / long / rest days', () => {
    const p = plan(hist([110, 150]))
    expect(p.hrCap).toBe(HR_CAP)
    expect(HR_CAP).toBe(156)
    for (const d of p.days) expect(['easy', 'long', 'rest']).toContain(d.type)
  })
})

describe('rule 2: at most +10% over last week', () => {
  it('builds 10% on the last full week, rounded down to 5', () => {
    const p = plan(hist([110, 150]))
    expect(p.phase).toEqual({ kind: 'build', week: 2 })
    expect(p.totalRunMin).toBe(165)
    expect(labels(p)).toContain('Build week 2 · +10% × 150')
  })

  it('never makes up missed time: a short week caps the next one', () => {
    // Planned ~150 the week before, but only 130 was run.
    const p = plan(hist([110, 130]))
    expect(p.totalRunMin).toBe(140)
    expect(p.totalRunMin).toBeLessThanOrEqual(1.1 * 130)
  })
})

describe('rule 3: cutback every 4th week', () => {
  it('cuts back to 75% after 3 build weeks', () => {
    const p = plan(hist([110, 130, 140, 150]))
    expect(p.phase).toEqual({ kind: 'cutback' })
    expect(p.tags).toContain('Cutback week')
    expect(p.totalRunMin).toBe(110) // 0.75 × 150 = 112.5
  })

  it('resets the count after a cutback in history', () => {
    const p = plan(hist([110, 150, 160]))
    expect(p.phase).toEqual({ kind: 'build', week: 3 })
    expect(p.totalRunMin).toBe(175)
  })

  it('resets the count after a layoff restart', () => {
    // 4 weeks before a 10-day gap, then 5 weeks back (ladder done after 4).
    const before = weeks(addDaysToKey(MONDAY, -35 - 10), [150, 150, 150, 150])
    const after = weeks(MONDAY, [100, 150, 150, 150, 150])
    const p = plan([...before, ...after])
    expect(p.phase.kind).toBe('build')
  })
})

describe('rule 4: projected load ratio ≤ 1.3', () => {
  const spike = () => hist([110, 280])

  it('trims a spiking week until the projection is ≤ 1.3', () => {
    const p = plan(spike())
    expect(p.trimmed).toBe(true)
    expect(p.projectedAcwr!).toBeLessThanOrEqual(1.3)
    expect(p.totalRunMin).toBeLessThan(305)
    expect(p.tags).toContain('Trimmed for load')
    expect(p.calc.some(c => c.kind === 'warn' && c.label.startsWith('Trimmed'))).toBe(true)
  })

  it('shortens easy runs first: the long run keeps its unscaled length unless the 30% cap binds', () => {
    const p = plan(spike())
    const long = p.days.find(d => d.type === 'long')!
    const lastLong = 280 / 3
    const unscaledLong = Math.floor(Math.min(0.3 * 305, lastLong + 10) / 5) * 5 // 90
    expect(long.runMin).toBe(Math.min(unscaledLong, Math.floor((0.3 * p.totalRunMin) / 5) * 5))
  })

  it('still builds exactly +10% when the ratio is below 0.8', () => {
    const history = hist([...Array(6).fill(260), 100], 260)
    const load = fitnessFatigue(history, PROFILE, 7, new Date(`${addDaysToKey(MONDAY, -1)}T12:00:00Z`))
    expect(acuteChronicRatio(load)!).toBeLessThan(0.8)
    const p = plan(history)
    expect(p.phase).toEqual({ kind: 'build', week: 1 })
    expect(p.totalRunMin).toBe(110) // 1.1 × 100
  })
})

describe('rule 5: long run', () => {
  it('is ≤ 30% of the week and ≤ last long run + 10', () => {
    const history = [
      ...weeks(addDaysToKey(MONDAY, -7), [...Array(16).fill(200), 140]),
      // last week: 5 × 42 min, so the last long run is 42
      ...[0, 1, 2, 4, 5].map(off => run(addDaysToKey(MONDAY, -7 + off), 42)),
    ]
    const p = plan(history)
    const long = p.days.find(d => d.type === 'long')!
    expect(long.runMin).toBe(50) // min(0.3 × 230, 42 + 10) → 52 → 50
    expect(long.runMin).toBeLessThanOrEqual(0.3 * p.totalRunMin)
  })
})

describe('rule 6: minimum week', () => {
  it('raises a too-small week to 3 × 30 min easy + 1 strength and says why', () => {
    const p = plan(hist([60, 40, 60], 60))
    expect(p.minimumWeek).toBe(true)
    expect(p.tags).toContain('Minimum week')
    expect(runDays(p).map(d => d.runMin)).toEqual([30, 30, 30])
    expect(runDays(p).map(d => weekday(d.date))).toEqual([2, 4, 6])
    expect(p.days.filter(d => d.strength)).toHaveLength(1)
    expect(labels(p)).toContain('Below the 90-min minimum → minimum week')
  })
})

describe('rule 7: return from a layoff', () => {
  // 4 pre-gap weeks of 200, 10 full days off, then a return.
  const gapStart = addDaysToKey(MONDAY, -60)
  // Blocks end the day after gapStart so the last pre-gap run lands on it.
  const preGap = weeks(addDaysToKey(gapStart, 2), [200, 200, 200, 200])
  const restart = addDaysToKey(gapStart, 11)

  it('treats 7 full days without a run as a gap, and 6 as not', () => {
    // The last run is Saturday MONDAY − 2.
    const six = plan(hist([110, 150]), addDaysToKey(MONDAY, 5))
    expect(six.phase.kind).not.toBe('return')
    const seven = plan(hist([110, 150]), addDaysToKey(MONDAY, 6))
    expect(seven.phase).toMatchObject({ kind: 'return', step: 1 })
  })

  it.each([
    [0, 1, '50% × 200'],
    [1, 2, '75% × 200'],
    [2, 3, '90% × 200'],
    [3, 4, '100% × 200'],
  ])('week %i after restarting is return step %i (%s)', (w, step, math) => {
    const today = addDaysToKey(restart, 7 * w)
    const back = Array.from({ length: w * 7 }, (_, i) => addDaysToKey(restart, i))
      .filter((_, i) => i % 2 === 0)
      .map(d => run(d, 30))
    const p = plan([...preGap, ...back], today)
    expect(p.phase).toMatchObject({ kind: 'return', step })
    if (p.phase.kind === 'return') expect(p.phase.preGapWeekMin).toBeCloseTo(200)
    expect(p.tags).toContain(`Return week ${step} of 4`)
    expect(labels(p)).toContain(`Return week ${step} of 4 · ${math}`)
    expect(labels(p).some(l => l.startsWith('Gap · '))).toBe(true)
    expect(p.calc.find(c => c.label.startsWith('Gap'))!.text).toBe('10 days off')
    expect(p.calc.find(c => c.label.startsWith('Pre-gap'))!.minutes).toBe(200)
  })

  it('resumes +10% builds after the 4 return weeks', () => {
    const today = addDaysToKey(restart, 28)
    const back = Array.from({ length: 28 }, (_, i) => addDaysToKey(restart, i))
      .filter((_, i) => i % 2 === 0)
      .map(d => run(d, 40))
    expect(plan([...preGap, ...back], today).phase.kind).toBe('build')
  })

  it('never goes below the minimum week', () => {
    const small = weeks(addDaysToKey(gapStart, 2), [80, 80, 80, 80])
    const p = plan(small, restart)
    expect(p.phase).toMatchObject({ kind: 'return', step: 1 })
    expect(p.totalRunMin).toBe(90)
    expect(p.minimumWeek).toBe(true)
  })
})

describe('rule 8: strides', () => {
  it('adds strides only after 12 gap-free weeks, never on a Friday', () => {
    const vols = Array(13).fill(140)
    vols[9] = 100 // keep the build count low so the week isn't a cutback
    const p = plan(weeks(MONDAY, vols))
    const strides = p.days.filter(d => d.strides)
    expect(strides).toHaveLength(1)
    expect(strides[0].type).toBe('easy')
    expect(weekday(strides[0].date)).not.toBe(5)
  })

  it('has no strides with under 12 weeks of history', () => {
    const p = plan(weeks(MONDAY, Array(10).fill(140)))
    expect(p.days.some(d => d.strides)).toBe(false)
  })
})

describe('choosing the days', () => {
  const ctx = (start: string, over: Partial<LayoutContext> = {}): LayoutContext => ({
    start,
    longCap: 999,
    lastLong: 999,
    movedLong: false,
    stridesOk: false,
    pace: PACE,
    ...over,
  })
  const starts = Array.from({ length: 7 }, (_, i) => addDaysToKey(MONDAY, i))

  it('picks 3 / 4 / 5 / 6 runs at 120, 180 and 260 min', () => {
    expect([90, 115, 119, 120, 179, 180, 259, 260, 400].map(runsPerWeek)).toEqual([
      3, 3, 3, 4, 4, 5, 5, 6, 6,
    ])
  })

  it.each([105, 140, 200, 300])('lays out %i min within every rule, from any start day', total => {
    for (const start of starts) {
      const days = layoutWeek(total, ctx(start))
      const runs = runDays({ days })
      expect(runs).toHaveLength(runsPerWeek(total))
      expect(runs.reduce((s, d) => s + d.runMin, 0)).toBeLessThanOrEqual(total)
      for (const d of runs) {
        expect(d.runMin % 5).toBe(0)
        expect(d.runMin).toBeGreaterThanOrEqual(20)
      }
      for (const d of days) {
        if (weekday(d.date) === 0) expect(d.runMin).toBe(0) // Sunday never runs
        if (d.type === 'long') expect(weekday(d.date)).toBe(6)
      }
      // strength: twice, ≥ 48 h apart, never Friday or Sunday
      const strength = days.filter(d => d.strength)
      expect(strength).toHaveLength(2)
      const gap = (Date.parse(strength[1].date) - Date.parse(strength[0].date)) / 86_400_000
      expect(gap).toBeGreaterThanOrEqual(2)
      for (const d of strength) expect([0, 5]).not.toContain(weekday(d.date))
      expect(days.filter(d => d.runMin === 0 && !d.strength).length).toBeGreaterThanOrEqual(1)
    }
  })

  it('makes 3-run weeks three equal easy runs with no long run', () => {
    const days = layoutWeek(105, ctx(MONDAY))
    expect(runDays({ days }).map(d => [d.type, d.runMin])).toEqual([
      ['easy', 35],
      ['easy', 35],
      ['easy', 35],
    ])
  })

  it('combines strength with an easy run on the same day', () => {
    const days = layoutWeek(140, ctx(MONDAY))
    expect(days.filter(d => d.strength).every(d => d.type === 'easy' && d.runMin > 0)).toBe(true)
  })

  it('makes Friday the shortest easy run in a 6-run week', () => {
    const days = layoutWeek(305, ctx(MONDAY, { longCap: 60, lastLong: 60 }))
    const easy = days.filter(d => d.type === 'easy')
    const friday = easy.find(d => weekday(d.date) === 5)!
    expect(friday.runMin).toBe(Math.min(...easy.map(d => d.runMin)))
  })

  it('moves a missed Saturday long run to Sunday, rests Monday, keeps next Saturday the same', () => {
    const sunday = addDaysToKey(MONDAY, 6)
    // Ran Mon–Fri last week (no Saturday): the plan on Sunday moves the long run.
    const history = [
      ...weeks(addDaysToKey(MONDAY, -1), [...Array(16).fill(150), 110]),
      ...[0, 1, 2, 3, 4].map(off => run(addDaysToKey(MONDAY, off), 30)),
    ]
    const p = plan(history, sunday)
    expect(p.days[0].type).toBe('long')
    expect(p.days[0].movedLong).toBe(true)
    expect(p.days[1].runMin).toBe(0)
    const saturday = p.days.find(d => weekday(d.date) === 6)!
    expect(saturday.type).toBe('long')
    expect(saturday.runMin).toBe(p.days[0].runMin)
  })
})

describe('edge cases', () => {
  it('shows the minimum week with no data', () => {
    const p = plan([])
    expect(p.flags).toContain('not-enough-data')
    expect(p.minimumWeek).toBe(true)
    expect(p.totalRunMin).toBe(90)
    expect(p.calc[0].text).toBe('not enough data yet')
  })

  it('shows the minimum week with under 14 days of history', () => {
    const p = plan([run(addDaysToKey(MONDAY, -10), 60), run(addDaysToKey(MONDAY, -5), 60)])
    expect(p.flags).toContain('not-enough-data')
    expect(p.totalRunMin).toBe(90)
  })

  it('flags load-high when even the minimum week projects above 1.3', () => {
    const p = plan(weeks(MONDAY, [30, 30, 600]))
    expect(p.minimumWeek).toBe(true)
    expect(p.flags).toContain('load-high')
    expect(p.projectedAcwr!).toBeGreaterThan(1.3)
    expect(p.calc.some(c => c.text === 'keep everything easy')).toBe(true)
  })

  it('recomputes after a missed day without adding the missed minutes back', () => {
    const history = hist([110, 150])
    const tuesday = addDaysToKey(MONDAY, 1)
    const planned = plan(history, tuesday)
    expect(planned.days[0].runMin).toBeGreaterThan(0) // Tuesday's run is planned…
    const next = plan(history, addDaysToKey(tuesday, 1)) // …and skipped
    expect(next.totalRunMin).toBeLessThanOrEqual(1.1 * next.lastWeekRunMin)
  })

  it('starts the plan tomorrow when today already has a run', () => {
    const history = [...hist([110, 150]), run(MONDAY, 40)]
    const p = plan(history)
    expect(p.startDate).toBe(addDaysToKey(MONDAY, 1))
    expect(p.lastWeekRunMin).toBeCloseTo(150 + 40) // last week's Tue–Sun runs + today
  })

  it('ignores the excluded 2026-05-09 run', () => {
    const history = hist([110, 150])
    const bad = run(addDaysToKey(MONDAY, -2), 500, 190, 'cmr6tqaci001fcaud052u0ayv')
    expect(plan([...history, bad])).toEqual(plan(history))
  })

  it('is deterministic', () => {
    const history = weeks(MONDAY, [100, 110, 70, 260])
    expect(plan(history)).toEqual(plan(history))
  })
})

describe('the working ("how this was set")', () => {
  it('uses actual distance for history and ≈ easy-pace distance for planned lines', () => {
    const p = plan(hist([110, 150]))
    const last = p.calc[0]
    expect(last.label).toBe('Last full week · Oct 26 – Nov 1')
    expect(last.minutes).toBe(150)
    expect(last.estimated).toBeUndefined()
    expect(last.distanceKm).toBeCloseTo(150 / PACE)
    const result = p.calc.find(c => c.kind === 'result')!
    expect(result).toMatchObject({ label: 'Rounded down to 5', minutes: 165, estimated: true })
    expect(result.distanceKm).toBeCloseTo(165 / PACE)
    expect(p.totalDistanceKm).toBeCloseTo(165 / PACE)
  })

  it('lists the cutback math', () => {
    expect(labels(plan(hist([110, 130, 140, 150])))).toEqual([
      'Last full week · Oct 26 – Nov 1',
      '3 build weeks in a row → cutback · 75% × 150',
      'Rounded down to 5',
    ])
  })
})
