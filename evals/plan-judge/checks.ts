import { addDaysToKey } from '@/lib/activitySummary'
import type { PlanWeek, RacePlan } from '@/lib/racePlan'
import { MI, type SimResult } from './personas'

// Deterministic checks: the parts of "is this a good plan" that code can
// verify exactly. The LLM judge receives these results as facts and judges
// what code can't (specificity, fit, how it feels to follow). Every check
// cites the weeks that fail it, so a human can verify the finding.
//
//   gate — a violation makes the plan unsafe or broken for this runner
//   warn — a quality problem worth fixing, not dangerous on its own

export type Severity = 'gate' | 'warn'

export interface CheckResult {
  id: string
  severity: Severity
  title: string
  passed: boolean
  evidence: string[] // one line per failing week
}

const mi = (km: number) => `${(km / MI).toFixed(1)} mi`
const EPS = 0.05

export interface CheckInput {
  plan: RacePlan // the final plan (past weeks as they were planned at the time)
  sim?: SimResult // closed-loop data, when the plan came from a simulation
  raceKm: number
}

function weekActual(sim: SimResult | undefined, monday: string) {
  if (!sim) return null
  const end = addDaysToKey(monday, 7)
  return sim.runs.filter(r => r.date.slice(0, 10) >= monday && r.date.slice(0, 10) < end).reduce((s, r) => s + r.distanceKm, 0)
}

const quality = (w: PlanWeek) => w.sessions.filter(s => s.quality && s.kind !== 'race')
const isRaceWeek = (plan: RacePlan, w: PlanWeek) => w.number === plan.weeks.length

/** The minimum peak long run that prepares someone for the distance (consensus ranges). */
export function minPeakLongKm(raceKm: number) {
  if (raceKm >= 40) return 16 * MI
  if (raceKm >= 20) return 9 * MI
  if (raceKm >= 9) return 6 * MI
  return 4 * MI
}

export function runChecks({ plan, sim, raceKm }: CheckInput): CheckResult[] {
  const W = plan.weeks
  const nonTaper = W.filter(w => w.phase !== 'taper')
  const peak = Math.max(...nonTaper.map(w => w.targetKm), 0)
  const results: CheckResult[] = []
  const check = (id: string, severity: Severity, title: string, evidence: string[]) =>
    results.push({ id, severity, title, passed: evidence.length === 0, evidence })

  // SPIKE — no week asks for more than 1.3× the last 4 weeks actually run.
  {
    const ev: string[] = []
    if (sim) {
      for (const w of W) {
        if (isRaceWeek(plan, w)) continue
        const prior = [1, 2, 3, 4].map(k => weekActual(sim, addDaysToKey(w.start, -7 * k))!)
        const chronic = prior.reduce((a, b) => a + b, 0) / 4
        if (chronic > 0 && w.targetKm > 1.3 * chronic + EPS) {
          ev.push(`wk ${w.number}: plans ${mi(w.targetKm)} vs 4-wk average ${mi(chronic)} (${(w.targetKm / chronic).toFixed(2)}×)`)
        }
      }
    }
    check('SPIKE', 'gate', 'No week above 1.3× the 4-week average actually run', ev)
  }

  // LONG_SHARE — long run ≤ 35% of the week (race week excepted).
  check(
    'LONG_SHARE',
    'gate',
    'Long run at most 35% of the week',
    W.filter(w => !isRaceWeek(plan, w) && w.longKm > 0.35 * w.targetKm + EPS).map(
      w => `wk ${w.number}: long ${mi(w.longKm)} of ${mi(w.targetKm)} (${Math.round((w.longKm / w.targetKm) * 100)}%)`,
    ),
  )

  // LONG_STEP — the planned long run grows at most 1 mi over the longest of
  // (previous planned long, longest run actually done last week).
  {
    const ev: string[] = []
    for (let i = 1; i < W.length - 1; i++) {
      const prevPlanned = Math.max(...W.slice(0, i).filter(w => !w.cutback).map(w => w.longKm), 0)
      const prevRan = W[i - 1].longestKm ?? 0
      const ref = Math.max(prevPlanned, prevRan)
      if (ref > 0 && W[i].longKm > ref + MI + EPS) ev.push(`wk ${W[i].number}: long ${mi(W[i].longKm)} after ${mi(ref)}`)
    }
    check('LONG_STEP', 'gate', 'Long run grows at most 1 mi a week', ev)
  }

  // TAPER — volume drops in the last two weeks; the race is in the last.
  {
    const ev: string[] = []
    const taper = W.filter(w => w.phase === 'taper')
    if (W.length >= 6 && taper.length < 2) ev.push(`only ${taper.length} taper week(s) in a ${W.length}-week season`)
    for (const w of taper.filter(w => !isRaceWeek(plan, w))) {
      if (w.targetKm >= peak - EPS) ev.push(`wk ${w.number}: taper ${mi(w.targetKm)} not below peak ${mi(peak)}`)
    }
    const last = W[W.length - 1]
    if (last && last.targetKm - raceKm > 0.4 * peak + EPS) ev.push(`race week has ${mi(last.targetKm - raceKm)} besides the race, > 40% of peak ${mi(peak)}`)
    if (last && last.targetKm < raceKm - EPS) ev.push(`race week plans ${mi(last.targetKm)}, less than the race itself`)
    if (last && !last.sessions.some(s => s.kind === 'race')) ev.push('race week has no race session')
    check('TAPER', 'gate', 'Two-week taper below the peak, race in the last week', ev)
  }

  // TAPER_VS_RECENT — the taper never asks for more than was recently run.
  {
    const ev: string[] = []
    const first = W.find(w => w.phase === 'taper')
    if (first && sim) {
      const recent = Math.max(...[1, 2, 3, 4].map(k => weekActual(sim, addDaysToKey(first.start, -7 * k))!))
      if (recent > 0 && first.targetKm > recent * 1.05) {
        ev.push(`wk ${first.number}: taper plans ${mi(first.targetKm)} but the most run in the 4 weeks before was ${mi(recent)}`)
      }
    }
    check('TAPER_VS_RECENT', 'gate', 'Taper never exceeds what was recently run', ev)
  }

  // ONE_QUALITY — at most one hard session a week.
  check(
    'ONE_QUALITY',
    'gate',
    'At most one quality session a week',
    W.filter(w => quality(w).length > 1).map(w => `wk ${w.number}: ${quality(w).map(s => s.label).join(' + ')}`),
  )

  // CHECKINS — pain cuts the next week and drops speed work; drained never builds.
  {
    const ev: string[] = []
    for (let i = 0; i < W.length - 1; i++) {
      const ci = W[i].checkIn
      if (!ci) continue
      const next = W[i + 1]
      if (ci.soreness === 3) {
        if (next.sessions.some(s => s.kind !== 'race')) ev.push(`wk ${next.number}: speed work after a pain check-in`)
        if (next.targetKm > 0.8 * W[i].targetKm + EPS) ev.push(`wk ${next.number}: ${mi(next.targetKm)} after pain (> 80% of ${mi(W[i].targetKm)})`)
      }
      if (ci.effort === 3 && ci.freshness === 1 && next.targetKm > W[i].targetKm + EPS && !isRaceWeek(plan, next)) {
        ev.push(`wk ${next.number}: builds to ${mi(next.targetKm)} after a hard, drained week`)
      }
    }
    check('CHECKINS', 'gate', 'Check-ins respected (pain cuts, drained holds)', ev)
  }

  // NON_DEGENERATE — every week has real running in it.
  check(
    'NON_DEGENERATE',
    'gate',
    'Every week plans at least 5 mi',
    W.filter(w => !isRaceWeek(plan, w) && w.targetKm < 5 * MI).map(w => `wk ${w.number}: ${mi(w.targetKm)}`),
  )

  // NO_SPIRAL — a runner who does ≥ 75% every week should not see the plan
  // shrink below where they started.
  {
    const ev: string[] = []
    const done = W.filter(w => w.status === 'done' && !isRaceWeek(plan, w))
    const steady = done.length >= 4 && done.every(w => (w.actualKm ?? 0) >= 0.75 * w.targetKm)
    if (steady && peak < plan.baselineKm - EPS) ev.push(`ran ≥ 75% every week, yet the peak ${mi(peak)} is below the starting baseline ${mi(plan.baselineKm)}`)
    if (steady) {
      const late = nonTaper.slice(-3)
      if (late.length && late.every(w => w.targetKm < plan.baselineKm - EPS)) {
        ev.push(`last non-taper weeks (${late.map(w => mi(w.targetKm)).join(', ')}) all below the baseline ${mi(plan.baselineKm)}`)
      }
    }
    check('NO_SPIRAL', 'gate', 'Consistent partial adherence does not shrink the plan', ev)
  }

  // SPECIFICITY — the long run reaches a race-appropriate length, and the
  // workouts are named for this race distance.
  {
    const ev: string[] = []
    const longest = Math.max(...W.slice(0, -1).map(w => w.longKm), 0)
    const need = minPeakLongKm(raceKm)
    if (longest < need - EPS) ev.push(`longest planned long run ${mi(longest)}; a ${raceKm.toFixed(1)} km race needs ≥ ${mi(need)}`)
    if (Math.abs(raceKm - 21.0975) > 0.5) {
      const hm = W.filter(w => w.sessions.some(s => /half-marathon/i.test(s.label) || /half-marathon/i.test(s.detail)))
      if (hm.length) ev.push(`"half-marathon" workouts in a ${raceKm.toFixed(1)} km plan (wks ${hm.map(w => w.number).join(', ')})`)
    }
    check('SPECIFICITY', 'gate', 'Long run and workouts fit the race distance', ev)
  }

  // CUTBACK_SPACING — never more than 3 build weeks in a row.
  {
    const ev: string[] = []
    let run = 0
    for (let i = 1; i < W.length; i++) {
      run = W[i].targetKm > W[i - 1].targetKm + EPS ? run + 1 : 0
      if (run > 3) ev.push(`wk ${W[i].number}: ${run} increases in a row`)
    }
    check('CUTBACK_SPACING', 'warn', 'A down week at least every 4 weeks', ev)
  }

  // TUNE_UP — a season with a build phase of 4+ weeks includes a time trial.
  {
    const build = W.filter(w => w.phase === 'build')
    const tt = W.some(w => w.sessions.some(s => s.kind === 'time-trial'))
    check('TUNE_UP', 'warn', 'Build phase includes the 5K time trial', build.length >= 4 && !tt ? [`${build.length} build weeks, no time trial`] : [])
  }

  // NEW_IN_CUTBACK — a new workout type never debuts in a cutback week.
  {
    const ev: string[] = []
    for (let i = 1; i < W.length; i++) {
      const before = new Set(W.slice(0, i).flatMap(w => w.sessions.map(s => s.kind)))
      const fresh = W[i].sessions.filter(s => s.quality && !before.has(s.kind) && s.kind !== 'race')
      if (W[i].cutback && fresh.length) ev.push(`wk ${W[i].number}: ${fresh.map(s => s.label).join(', ')} starts in a cutback week`)
    }
    check('NEW_IN_CUTBACK', 'warn', 'New workout types start in normal weeks', ev)
  }

  // CHURN — future weeks shouldn't jump around when nothing happened.
  {
    const ev: string[] = []
    if (sim) {
      for (let k = 1; k < sim.snapshots.length; k++) {
        const prev = sim.snapshots[k - 1].plan
        const cur = sim.snapshots[k].plan
        const lastWeek = cur.weeks[cur.current - 1]
        const calm = !!lastWeek?.onPlan && lastWeek.checkIn?.soreness !== 3 && lastWeek.checkIn?.freshness !== 1
        if (!calm) continue
        for (let j = cur.current + 2; j < cur.weeks.length; j++) {
          const a = prev.weeks[j].targetKm
          const b = cur.weeks[j].targetKm
          if (a > 0 && Math.abs(b - a) / a > 0.15) {
            ev.push(`as of ${cur.weeks[cur.current].start}: wk ${j + 1} moved ${mi(a)} → ${mi(b)} after an on-plan week`)
            break
          }
        }
      }
    }
    check('CHURN', 'warn', 'Future weeks stay put after an on-plan week', ev)
  }

  return results
}
