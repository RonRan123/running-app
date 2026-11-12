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
const ctx = (start: string, over: Partial<LayoutContext> = {}): LayoutContext => ({
  start,
  maxRunMin: 999,
  strict: false,
  ranYesterday: false,
  ranDayBefore: true,
  stridesOk: false,
  pace: PACE,
  ...over,
})
const idx = (days: PlanDay[]) => days.flatMap((d, i) => (d.runMin > 0 ? [i] : []))
const backToBack = (days: PlanDay[]) =>
  days.some((d, i) => i > 0 && d.runMin > 0 && days[i - 1].runMin > 0)

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
    expect(p.totalRunMin).toBeLessThan(220)
    expect(p.tags).toContain('Trimmed for load')
    expect(p.calc.some(c => c.kind === 'warn' && c.label.startsWith('Trimmed'))).toBe(true)
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

describe('rule 5: long run and the single-run cap', () => {
  it('makes the long run ≤ 30% of the week', () => {
    const p = plan(hist([110, 150]))
    const long = p.days.find(d => d.type === 'long')!
    expect(long.runMin).toBe(45) // 0.3 × 165 = 49.5 → 45
    expect(long.runMin).toBeLessThanOrEqual(0.3 * p.totalRunMin)
  })

  it('never plans a run over 110% of the longest in the last 30 days', () => {
    // 6 weeks of 5 × 30 min, then a long layout would want 0.3 × 165 = 45.
    const history = Array.from({ length: 42 }, (_, i) => addDaysToKey(MONDAY, -42 + i))
      .filter(d => ![0, 5].includes(weekday(d)))
      .map(d => run(d, 30))
    const p = plan([...weeks(addDaysToKey(MONDAY, -42), Array(12).fill(150)), ...history])
    expect(p.maxRunMin).toBe(35) // max(1.1 × 30, 30 + 5)
    for (const d of p.days) expect(d.runMin).toBeLessThanOrEqual(35)
  })

  it('drops minutes the cap cannot place, and says so', () => {
    const days = layoutWeek(200, ctx(MONDAY, { maxRunMin: 30 }))
    expect(runDays({ days }).map(d => d.runMin)).toEqual([30, 30, 30, 30, 30])
    expect(days.some(d => d.type === 'long')).toBe(false) // no longer than the rest
    // 5 weeks off → nothing in the last 30 days → runs restart at 30 min.
    const p = plan(hist([0, 0, 0, 0, 0], 300))
    expect(p.maxRunMin).toBe(30)
    expect(p.totalRunMin).toBe(120) // 150 wanted, 4 alternate days × 30
    expect(p.calc.some(c => c.kind === 'warn' && c.label.startsWith('No run over 30 min'))).toBe(true)
    expect(p.calc.at(-1)).toMatchObject({ label: 'This week', minutes: 120, kind: 'result' })
  })
})

describe('rule 6: minimum week', () => {
  it('raises a too-small week to 3 × 30 min easy + 1 strength and says why', () => {
    const p = plan(hist([60, 40, 60], 60))
    expect(p.minimumWeek).toBe(true)
    expect(p.tags).toContain('Minimum week')
    expect(runDays(p).map(d => d.runMin)).toEqual([30, 30, 30])
    expect(runDays(p).map(d => weekday(d.date))).toEqual([2, 4, 6])
    expect(backToBack(p.days)).toBe(false)
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
      .map(d => run(d, 25))
    const p = plan([...preGap, ...back], today)
    expect(p.phase).toMatchObject({ kind: 'return', step, held: false })
    expect(backToBack(p.days)).toBe(false) // returning runners run on alternate days
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

  it('repeats a step when last week ran well over it', () => {
    // Week 1 back should be 100 min; 4 × 50 = 200 were run instead.
    const back = [0, 2, 4, 6].map(off => run(addDaysToKey(restart, off), 50))
    const p = plan([...preGap, ...back], addDaysToKey(restart, 7))
    expect(p.phase).toMatchObject({ kind: 'return', step: 1, held: true })
    expect(p.tags).toContain('Return week 1 of 4 (repeated)')
    expect(p.totalRunMin).toBe(100)
    expect(labels(p)).toContain('Last week ran over its 100-min step → repeat it')
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
  it('adds strides only after 12 gap-free weeks, never the day before a long run', () => {
    const vols = Array(13).fill(140)
    vols[9] = 100 // keep the build count low so the week isn't a cutback
    const p = plan(weeks(MONDAY, vols))
    const strides = p.days.filter(d => d.strides)
    expect(strides).toHaveLength(1)
    expect(strides[0].type).toBe('easy')
    const next = p.days[p.days.indexOf(strides[0]) + 1]
    expect(next?.type).not.toBe('long')
  })

  it('has no strides with under 12 weeks of history', () => {
    const p = plan(weeks(MONDAY, Array(10).fill(140)))
    expect(p.days.some(d => d.strides)).toBe(false)
  })
})

describe('choosing the days', () => {
  const starts = Array.from({ length: 7 }, (_, i) => addDaysToKey(MONDAY, i))

  it('picks 3 / 4 / 5 runs at 120 and 180 min, and never more than 5', () => {
    expect([90, 115, 119, 120, 179, 180, 259, 260, 400].map(runsPerWeek)).toEqual([
      3, 3, 3, 4, 4, 5, 5, 5, 5,
    ])
  })

  it.each([105, 140, 200, 300])('lays out %i min within every rule, from any start day', total => {
    for (const start of starts) {
      const days = layoutWeek(total, ctx(start))
      const runs = runDays({ days })
      expect(runs).toHaveLength(runsPerWeek(total))
      expect(runs.reduce((s, d) => s + d.runMin, 0)).toBe(total)
      for (const d of runs) {
        expect(d.runMin % 5).toBe(0)
        expect(d.runMin).toBeGreaterThanOrEqual(20)
      }
      days.forEach((d, i) => {
        if (d.type !== 'long') return
        expect([0, 6]).toContain(weekday(d.date)) // long runs sit on the weekend
        expect(days[i + 1]?.runMin ?? 0).toBe(0) // …with a rest day after
        expect(d.runMin).toBe(Math.max(...runs.map(r => r.runMin)))
      })
      // Up to 4 runs fit on alternate days; 5 need pairs but never 3 in a row.
      if (runs.length <= 4 && weekday(start) !== 0) expect(backToBack(days)).toBe(false)
      expect(days.some((d, i) => i > 1 && d.runMin && days[i - 1].runMin && days[i - 2].runMin)).toBe(false)
      // strength: up to twice, ≥ 48 h apart, with an easy run, never before the long run
      const strength = days.flatMap((d, i) => (d.strength ? [i] : []))
      expect(strength.length).toBeGreaterThanOrEqual(1)
      expect(strength.length).toBeLessThanOrEqual(2)
      if (strength.length === 2) expect(strength[1] - strength[0]).toBeGreaterThanOrEqual(2)
      for (const i of strength) {
        expect(days[i].type).toBe('easy')
        expect(days[i + 1]?.type).not.toBe('long')
      }
    }
  })

  it('keeps a 3-run week on Tue / Thu / Sat, equal easy runs with no long run', () => {
    for (const start of starts) {
      const days = layoutWeek(105, ctx(start))
      expect(runDays({ days }).map(d => [weekday(d.date), d.type, d.runMin]).sort()).toEqual([
        [2, 'easy', 35],
        [4, 'easy', 35],
        [6, 'easy', 35],
      ])
    }
  })

  it('never runs the day after a real run when strict', () => {
    for (const start of starts) {
      for (const total of [105, 140, 200]) {
        const days = layoutWeek(total, ctx(start, { strict: true, ranYesterday: true }))
        expect(days[0].runMin).toBe(0)
        expect(backToBack(days)).toBe(false)
        expect(runDays({ days })).toHaveLength(3) // only days 1, 3, 5 are left
      }
    }
  })

  it('fits 4 strict runs only on alternate days from day 1', () => {
    expect(idx(layoutWeek(140, ctx(MONDAY, { strict: true })))).toEqual([0, 2, 4, 6])
  })

  it('gives the 5-min leftovers to the earliest easy days, never the one before the long run', () => {
    // Fri is the day before Saturday's long run in this 5-run week.
    const days = layoutWeek(215, ctx(addDaysToKey(MONDAY, 1)))
    const long = days.findIndex(d => d.type === 'long')
    const easy = days.filter(d => d.type === 'easy')
    expect(days[long - 1].runMin).toBe(Math.min(...easy.map(d => d.runMin)))
  })

  it('keeps forced rest days free and marks them', () => {
    const days = layoutWeek(140, ctx(MONDAY, { strict: true, forcedRest: new Set([0, 1]) }))
    expect(idx(days)).toEqual([2, 4, 6])
    expect(days.map(d => d.loadRest)).toEqual([true, true, false, false, false, false, false])
  })

  it('makes Sunday the long run when Saturday was missed, and next Saturday too', () => {
    const sunday = addDaysToKey(MONDAY, 6)
    // Ran Mon / Wed / Fri last week (no Saturday).
    const history = [
      ...weeks(addDaysToKey(MONDAY, -1), [...Array(16).fill(150), 110]),
      ...[0, 2, 4].map(off => run(addDaysToKey(MONDAY, off), 50)),
    ]
    const p = plan(history, sunday)
    expect(p.days[0].type).toBe('long')
    expect(p.days[1].runMin).toBe(0)
    const saturday = p.days.find(d => weekday(d.date) === 6)!
    expect(saturday.type).toBe('long')
    expect(saturday.runMin).toBe(p.days[0].runMin)
  })
})

describe('load ratio steers the week', () => {
  // 16 steady weeks, a layoff, then a return run far over the ladder.
  const ratioToday = (history: AnalysisActivity[], today = MONDAY) =>
    acuteChronicRatio(fitnessFatigue(history, PROFILE, 7, new Date(`${today}T12:00:00Z`)))!

  it('reports the same ratio as the load-ratio card', () => {
    const history = hist([0, 0, 0, 0, 150, 330])
    expect(plan(history).currentAcwr).toBeCloseTo(ratioToday(history))
    const ranToday = [...history, run(MONDAY, 30)]
    expect(plan(ranToday).currentAcwr).toBeCloseTo(ratioToday(ranToday))
  })

  it('rests while the ratio is ≥ 1.5, then runs on alternate days', () => {
    const p = plan(hist([0, 0, 0, 0, 150, 330]))
    expect(p.currentAcwr!).toBeGreaterThanOrEqual(1.5)
    expect(p.loadState).toBe('high')
    expect(p.days[0]).toMatchObject({ runMin: 0, loadRest: true })
    expect(p.days.filter(d => d.loadRest).length).toBeGreaterThanOrEqual(1)
    expect(p.spaced).toBe(true)
    expect(backToBack(p.days)).toBe(false)
    expect(p.days.some(d => d.strides)).toBe(false)
    expect(labels(p)).toContain('Load ratio today')
    expect(labels(p)).toContain('Rest while the load ratio is ≥ 1.5')
    expect(p.calc.at(-1)!.kind).toBe('result')
    expect(p.calc.at(-1)!.minutes).toBe(p.totalRunMin)
  })

  it('lets the week drop to 3 × 20 and caps runs at the recent longest in the overreach zone', () => {
    const p = plan(hist([0, 0, 0, 0, 0, 0, 200, 400]))
    expect(p.loadState).toBe('high')
    expect(p.totalRunMin).toBeLessThan(90)
    expect(p.totalRunMin).toBeGreaterThanOrEqual(40)
    expect(p.maxRunMin).toBe(130) // longest in 30 days is 400 / 3, no +10%
  })

  it('holds instead of building, on alternate days, when the ratio is above 1.3', () => {
    // A layoff long enough ago that the ladder is done, then a big jump.
    const history = hist([0, 0, 75, 110, 135, 150, 150, 260])
    const p = plan(history)
    expect(p.phase.kind).toBe('build')
    expect(p.loadState).toBe('elevated')
    expect(p.totalRunMin).toBeLessThanOrEqual(p.lastWeekRunMin)
    expect(p.spaced).toBe(true)
    expect(backToBack(p.days)).toBe(false)
    expect(p.days.some(d => d.loadRest)).toBe(false)
  })

  it('leaves a normal week alone', () => {
    const p = plan(hist([110, 150]))
    expect(p.loadState).toBe('ok')
    expect(p.spaced).toBe(false)
    expect(p.days.some(d => d.loadRest)).toBe(false)
  })

  it('does not steer by the ratio in the first 12 weeks of history', () => {
    const p = plan(weeks(MONDAY, [60, 60, 60, 60, 60, 60, 300]))
    expect(p.currentAcwr!).toBeGreaterThan(1.5)
    expect(p.loadState).toBeNull()
    expect(p.days.some(d => d.loadRest)).toBe(false)
  })
})

describe('build cap', () => {
  it('never builds past 130% of the 4-week average', () => {
    const p = plan(hist([110, 280]))
    // +10% × 280 = 308, but the 4-week average is (150 + 150 + 110 + 280) / 4.
    expect(labels(p)).toContain('Capped · 130% × 173 (4-week average)')
    expect(p.totalRunMin).toBeLessThanOrEqual(1.3 * 172.5)
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
