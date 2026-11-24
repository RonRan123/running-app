import { describe, expect, it } from 'vitest'
import { addDaysToKey } from '@/lib/activitySummary'
import { buildRacePlan, phaseLengths, sessionsFor, type CheckIn, type PlanRun, type RacePlanInput } from '@/lib/racePlan'
import { RULES, PRINCIPLES } from '@/lib/racePrinciples'

const TZ = 'UTC'
const MI = 1.609344
// NYC Half 2027 season: goal created Sun Nov 22, race Sun Mar 21 → 17 weeks from Mon Nov 23.
const RACE = { date: '2027-03-21', distanceKm: 21.0975, createdAt: '2026-11-22' }
const START = '2026-11-23'

let seq = 0
/** Runs Tue/Thu/Sat in the week starting `monday` totalling `km` (Sat = long, 35%). */
function week(monday: string, km: number): PlanRun[] {
  if (km <= 0) return []
  const long = km * 0.35
  const rest = (km - long) / 2
  return [
    [1, rest],
    [3, rest],
    [5, long],
  ].map(([d, k]) => ({
    id: `r${seq++}`,
    date: `${addDaysToKey(monday, d)}T12:00:00Z`,
    distanceKm: k,
    durationSec: Math.round(k * 6 * 60),
  }))
}

/** `kms[0]` is the week before `first`, kms[1] the one before that, … */
function history(first: string, kms: number[]): PlanRun[] {
  return kms.flatMap((k, i) => week(addDaysToKey(first, -7 * (i + 1)), k))
}

function plan(over: Partial<RacePlanInput> = {}) {
  return buildRacePlan({
    runs: history(START, [20 * MI, 20 * MI, 20 * MI, 20 * MI, 18 * MI, 18 * MI]),
    today: '2026-11-22',
    timeZone: TZ,
    race: RACE,
    checkIns: [],
    paces: { race: 5.5, threshold: 5.25, tenK: 5.2 },
    ...over,
  })!
}

describe('phases', () => {
  it('splits 17 weeks into 6 base, 6 build, 3 peak, 2 taper', () => {
    expect(phaseLengths(17)).toEqual({ base: 6, build: 6, peak: 3, taper: 2 })
    const p = plan()
    expect(p.weeks).toHaveLength(17)
    expect(p.phases.map(x => [x.phase, x.fromWeek, x.toWeek])).toEqual([
      ['base', 1, 6],
      ['build', 7, 12],
      ['peak', 13, 15],
      ['taper', 16, 17],
    ])
    expect(p.weeks[0].start).toBe(START)
    expect(p.weeks[16].end).toBe(RACE.date)
  })

  it('handles short seasons without crashing', () => {
    for (const n of [1, 2, 3, 5, 8]) {
      const L = phaseLengths(n)
      expect(L.base + L.build + L.peak + L.taper).toBe(n)
    }
  })
})

describe('season plan before it starts', () => {
  const p = plan()

  it('starts from the median of the last 4 weeks', () => {
    expect(p.baselineKm).toBeCloseTo(20 * MI, 1)
    expect(p.current).toBe(-1)
  })

  it('cuts back every 4th week in base and build only', () => {
    expect(p.weeks.filter(w => w.cutback).map(w => w.number)).toEqual([4, 8, 12])
    const w3 = p.weeks[2]
    expect(p.weeks[3].targetKm).toBeCloseTo(w3.targetKm * RULES.cutbackRate, 5)
  })

  it('never builds more than 8% a week and peaks at ≤ 1.5 × baseline', () => {
    for (let i = 1; i < p.weeks.length; i++) {
      const prevRef = Math.max(...p.weeks.slice(0, i).filter(w => !w.cutback).map(w => w.targetKm), p.baselineKm)
      expect(p.weeks[i].targetKm).toBeLessThanOrEqual(prevRef * (1 + RULES.buildRate) + 1e-9)
    }
    expect(p.peakKm).toBeLessThanOrEqual(1.5 * p.baselineKm + 1e-9)
  })

  it('holds volume the week a new workout type starts', () => {
    const holds = p.weeks.filter(w => w.hold).map(w => w.number)
    expect(holds).toContain(5) // hill sprints
    expect(holds).toContain(7) // fartlek
    for (const n of holds) {
      expect(p.weeks[n - 1].trail.some(t => t.rule === 'ONE_NEW_STRESSOR')).toBe(true)
    }
  })

  it('tapers to 70% of the peak, then race week is easy runs plus the race', () => {
    expect(p.weeks[15].targetKm).toBeCloseTo(p.peakKm * 0.7, 5)
    expect(p.weeks[16].targetKm).toBeCloseTo(p.peakKm * RULES.raceWeekEasyShare + RACE.distanceKm, 5)
    expect(p.weeks[16].longKm).toBe(RACE.distanceKm)
    expect(p.weeks[16].sessions.map(s => s.kind)).toEqual(['strides', 'race'])
  })

  it('race week always plans at least the race (the bar contains the race dot)', () => {
    const low = plan({ runs: history(START, [8 * MI, 8 * MI, 8 * MI, 8 * MI]) })
    for (const q of [p, low]) {
      const last = q.weeks[q.weeks.length - 1]
      expect(last.targetKm).toBeGreaterThan(last.longKm)
    }
  })

  it('keeps the long run ≤ 35% of the week and ≤ 13 mi, peaking before the taper', () => {
    for (const w of p.weeks.slice(0, -1)) {
      expect(w.longKm).toBeLessThanOrEqual(RULES.longShare * w.targetKm + 1e-9)
      expect(w.longKm).toBeLessThanOrEqual(RULES.longPeakKm + 1e-9)
    }
    expect(p.longestLong.week).toBeLessThanOrEqual(15)
  })

  it('progresses speed work by phase with at most one quality session a week', () => {
    const q = p.weeks.map(w => w.sessions.find(s => s.quality)?.kind ?? null)
    expect(q.slice(0, 6).every(k => k === null)).toBe(true) // base: strides + hills only
    expect(q[6]).toBe('fartlek')
    expect(q[8]).toBe('time-trial')
    expect(q[9]).toBe('tempo')
    expect(q[12]).toBe('tune-up')
    expect(q[13]).toBe('race-pace')
    for (const w of p.weeks) expect(w.sessions.filter(s => s.quality).length).toBeLessThanOrEqual(1)
    expect(p.weeks[4].sessions.some(s => s.kind === 'hills')).toBe(true)
  })

  it('caps tempo at 10% of the week', () => {
    for (const w of p.weeks) {
      const t = w.sessions.find(s => s.kind === 'tempo')
      if (!t) continue
      const reps = Number(t.detail.split(' ')[0])
      expect(reps).toBeLessThanOrEqual(Math.max(2, Math.floor((0.1 * w.targetKm) / MI)))
    }
  })

  it('every trail step names a real principle', () => {
    for (const w of p.weeks) for (const t of w.trail) expect(PRINCIPLES[t.rule]).toBeDefined()
    for (const w of p.weeks) for (const s of w.sessions) expect(PRINCIPLES[s.rule]).toBeDefined()
  })

  it('logs plan creation', () => {
    expect(p.changes.at(-1)?.title).toBe('Plan created')
  })

  it('is deterministic', () => {
    expect(plan()).toEqual(plan())
  })
})

describe('re-planning from what was run', () => {
  const pre = history(START, [20 * MI, 20 * MI, 20 * MI, 20 * MI])
  const base = plan()

  it('counts a week within ±10% as full and does not speed up on overshoot', () => {
    const runs = [...pre, ...week(START, base.weeks[0].targetKm * 1.3)]
    const p = plan({ runs, today: '2026-11-30' })
    expect(p.current).toBe(1)
    expect(p.weeks[0].onPlan).toBe(true)
    expect(p.weeks[1].targetKm).toBeCloseTo(base.weeks[1].targetKm, 5)
  })

  it('never makes up missed miles: a short week lowers the rest of the plan', () => {
    const runs = [...pre, ...week(START, base.weeks[0].targetKm * 0.7)]
    const p = plan({ runs, today: '2026-11-30' })
    expect(p.weeks[0].onPlan).toBe(false)
    expect(p.weeks[1].targetKm).toBeLessThan(base.weeks[1].targetKm)
    expect(p.weeks[1].trail.some(t => t.rule === 'NO_MAKEUP')).toBe(true)
    expect(p.changes.some(c => c.title.startsWith('Week 2 lowered'))).toBe(true)
  })

  it('a strong week after a short one climbs back to the earlier plan, never past it', () => {
    const runs = [
      ...pre,
      ...week(START, base.weeks[0].targetKm * 0.7),
      ...week('2026-11-30', base.weeks[1].targetKm * 1.5),
    ]
    const p = plan({ runs, today: '2026-12-07' })
    // Week 3 builds from week 1's planned volume again (week 2 had dropped).
    expect(p.weeks[2].targetKm).toBeLessThanOrEqual(base.weeks[2].targetKm + 1e-9)
    expect(p.weeks[2].targetKm).toBeGreaterThan(p.weeks[1].targetKm * 1.2)
    expect(p.weeks[2].trail.some(t => t.rule === 'FLEX_BAND' && t.out.includes('back up'))).toBe(true)
  })

  it('restarts at half after a broken week', () => {
    const p = plan({ runs: pre, today: '2026-11-30' }) // ran nothing in week 1
    expect(p.weeks[1].targetKm).toBeCloseTo(base.weeks[0].targetKm * RULES.restartShare, 5)
    expect(p.weeks[1].trail.some(t => t.rule === 'RESTART')).toBe(true)
  })

  it('two empty weeks restart the ladder instead of halving twice', () => {
    const p = plan({ runs: pre, today: '2026-12-07' }) // nothing in weeks 1 and 2
    const w1 = base.weeks[0].targetKm
    expect(p.weeks[1].targetKm).toBeCloseTo(w1 * 0.5, 5)
    expect(p.weeks[2].targetKm).toBeCloseTo(w1 * 0.5, 5) // not 25%
    expect(p.weeks[3].targetKm).toBeCloseTo(w1 * 0.75, 5)
    expect(p.weeks[4].targetKm).toBeCloseTo(w1 * 0.9, 5)
    expect(p.weeks[5].targetKm).toBeCloseTo(w1, 5)
    expect(p.weeks[6].targetKm).toBeGreaterThanOrEqual(w1) // week 7 holds: fartlek starts
  })

  it('tapers from the peak the plan actually reaches', () => {
    const p = plan({ runs: pre, today: '2026-12-07' })
    const peakWeeks = p.weeks.filter(w => w.phase === 'peak').map(w => w.targetKm)
    for (const w of p.weeks.filter(w => w.phase === 'taper')) {
      expect(w.targetKm).toBeLessThan(Math.max(...peakWeeks))
    }
  })

  it('past weeks keep the plan they had at the time', () => {
    const runs = [...pre, ...week(START, base.weeks[0].targetKm), ...week('2026-11-30', base.weeks[1].targetKm * 0.6)]
    const p = plan({ runs, today: '2026-12-07' })
    expect(p.weeks[0].targetKm).toBeCloseTo(base.weeks[0].targetKm, 5)
    expect(p.weeks[1].targetKm).toBeCloseTo(base.weeks[1].targetKm, 5)
    expect(p.weeks[0].status).toBe('done')
    expect(p.weeks[2].status).toBe('current')
  })
})

describe('weekly check-ins', () => {
  const pre = history(START, [20 * MI, 20 * MI, 20 * MI, 20 * MI])
  const base = plan()
  const runs = [...pre, ...week(START, base.weeks[0].targetKm), ...week('2026-11-30', base.weeks[1].targetKm)]
  const ci = (weekStart: string, o: Partial<CheckIn>): CheckIn => ({
    weekStart,
    effort: 2,
    freshness: 2,
    soreness: 1,
    enjoyment: 2,
    ...o,
  })
  const at = (checkIns: CheckIn[]) => plan({ runs, today: '2026-12-07', checkIns })

  it('feeling easy and fresh changes nothing', () => {
    const p = at([ci('2026-11-30', { effort: 1, freshness: 3 })])
    expect(p.weeks[2].targetKm).toBeCloseTo(at([]).weeks[2].targetKm, 5)
  })

  it('a hard, drained week holds the next one', () => {
    const p = at([ci('2026-11-30', { effort: 3, freshness: 1 })])
    expect(p.weeks[2].targetKm).toBeCloseTo(p.weeks[1].targetKm, 5)
    expect(p.weeks[2].trail.some(t => t.rule === 'CHECKIN')).toBe(true)
  })

  it('two hard, drained weeks in a row bring the cutback forward', () => {
    const p = at([ci(START, { effort: 3, freshness: 1 }), ci('2026-11-30', { effort: 3, freshness: 1 })])
    expect(p.weeks[2].cutback).toBe(true)
  })

  it('pain in one spot cuts the week and drops all speed work', () => {
    const p = at([ci('2026-11-30', { soreness: 3 })])
    expect(p.weeks[2].targetKm).toBeLessThanOrEqual(p.weeks[1].targetKm * RULES.checkInPainCut + 1e-9)
    expect(p.weeks[2].sessions).toEqual([])
  })

  it('two low-enjoyment weeks swap a workout for a free run', () => {
    const s = sessionsFor({ i: 6, n: 17, phase: 'build', weekInPhase: 0, cutback: false, paces: null, targetKm: 40, noQuality: false, freeRun: true })
    expect(s.map(x => x.kind)).toEqual(['strides', 'free-run'])
  })

  it('asks for a check-in on the week just finished', () => {
    expect(at([]).checkInDue).toBe('2026-11-30')
    expect(at([ci('2026-11-30', {})]).checkInDue).toBe(null)
  })
})
