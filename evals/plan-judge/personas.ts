import { addDaysToKey, weekStartKey } from '@/lib/activitySummary'
import { buildRacePlan, type CheckIn, type PlanRun, type PlanWeek, type RacePlan } from '@/lib/racePlan'

// Closed-loop simulation: a persona follows (or doesn't follow) the plan week
// by week, the way a real runner would. Each Monday the plan is rebuilt from
// everything run so far, exactly as the race page does, so the judge sees
// how the plan reacts to real life, not just its opening draft.

export const MI = 1.609344
const PACE_MIN_PER_KM = 6.2

export interface WeekBehaviour {
  volume: number // share of the planned week actually run (1 = as planned)
  long?: number // share of the planned long run (defaults to `volume`)
  checkIn?: Omit<CheckIn, 'weekStart'>
  note?: string // what happened, shown to the judge
}

export interface Persona {
  id: string
  title: string
  /** What this runner does, in plain words, for the judge and the report. */
  story: string
  raceName: string
  raceDate: string // yyyy-MM-dd (a Sunday)
  raceKm: number
  goalCreated: string // yyyy-MM-dd the goal was added
  /** Weekly km for the weeks before the goal was added, oldest first. */
  history: number[]
  /** Behaviour in plan week i (0-based). */
  week: (i: number, w: PlanWeek) => WeekBehaviour
}

export interface Snapshot {
  monday: string
  plan: RacePlan
}

export interface SimResult {
  persona: Persona
  runs: PlanRun[]
  checkIns: CheckIn[]
  notes: Record<number, string> // plan week number → what happened
  snapshots: Snapshot[] // plan as of each Monday of the season
  final: RacePlan // plan as of race day
}

const TZ = 'UTC'
let seq = 0

/** Runs for one Mon–Sun week: Tue / Thu / Fri easy, Sat long. */
function weekRuns(monday: string, totalKm: number, longKm: number): PlanRun[] {
  if (totalKm <= 0.1) return []
  const long = Math.min(longKm, totalKm)
  const rest = Math.max(0, totalKm - long)
  const days: [number, number][] = rest > 0.1 ? [[1, rest * 0.4], [3, rest * 0.35], [4, rest * 0.25], [5, long]] : [[5, long]]
  return days
    .filter(([, k]) => k > 0.05)
    .map(([d, k]) => ({
      id: `sim-${seq++}`,
      date: `${addDaysToKey(monday, d)}T12:00:00Z`,
      distanceKm: k,
      durationSec: Math.round(k * PACE_MIN_PER_KM * 60),
    }))
}

export function simulate(p: Persona): SimResult {
  const season0 = weekStartKey(addDaysToKey(p.goalCreated, 1))
  // History fills the weeks right before the season starts.
  const firstHistory = addDaysToKey(season0, -7 * p.history.length)
  const runs: PlanRun[] = p.history.flatMap((km, i) => weekRuns(addDaysToKey(firstHistory, 7 * i), km, km * 0.3))
  const checkIns: CheckIn[] = []
  const notes: Record<number, string> = {}
  const snapshots: Snapshot[] = []
  const race = { date: p.raceDate, distanceKm: p.raceKm, createdAt: p.goalCreated }
  const plan = (today: string) =>
    buildRacePlan({ runs, today, timeZone: TZ, race, checkIns, paces: { race: 5.4, threshold: 5.15, tenK: 5.05 } })!

  const raceWeek = weekStartKey(p.raceDate)
  for (let monday = season0; monday <= raceWeek; monday = addDaysToKey(monday, 7)) {
    const snap = plan(monday)
    snapshots.push({ monday, plan: snap })
    const i = snap.current
    const w = snap.weeks[i]
    const b = p.week(i, w)
    if (b.note) notes[w.number] = b.note
    if (monday === raceWeek) {
      // Race week: run the easy part, then the race on Sunday.
      runs.push(...weekRuns(monday, Math.max(0, w.targetKm - p.raceKm) * b.volume, 0))
      runs.push({ id: `sim-${seq++}`, date: `${p.raceDate}T13:00:00Z`, distanceKm: p.raceKm, durationSec: p.raceKm * 330 })
    } else {
      runs.push(...weekRuns(monday, w.targetKm * b.volume, w.longKm * (b.long ?? b.volume)))
    }
    if (b.checkIn) checkIns.push({ weekStart: monday, ...b.checkIn })
  }
  return { persona: p, runs, checkIns, notes, snapshots, final: plan(p.raceDate) }
}

// ── The personas: what this user will plausibly do over a season ─────────

const NYC = { raceName: 'United Airlines NYC Half', raceDate: '2027-03-21', raceKm: 21.0975 }
const steadyHistory = [17, 18, 19, 18, 20, 19, 21, 20, 20, 21, 20, 20].map(m => m * MI)
const fine: Omit<CheckIn, 'weekStart'> = { effort: 2, freshness: 2, soreness: 1, enjoyment: 2 }
const asPlanned = (): WeekBehaviour => ({ volume: 1, checkIn: fine })

// Weeks by date for the NYC season starting Mon Nov 23, 2026.
const WEEK = (date: string) => Math.round((Date.parse(`${date}T00:00:00Z`) - Date.parse('2026-11-23T00:00:00Z')) / 604_800_000)

export const PERSONAS: Persona[] = [
  {
    id: 'steady',
    title: 'Follows the plan',
    story: 'Runs every week as planned and checks in "medium / okay / no soreness". The ideal case.',
    ...NYC,
    goalCreated: '2026-11-22',
    history: steadyHistory,
    week: asPlanned,
  },
  {
    id: 'holidays',
    title: 'Holiday weeks',
    story: 'Follows the plan, but travel over Christmas and New Year cuts those two weeks to 40% and 65%.',
    ...NYC,
    goalCreated: '2026-11-22',
    history: steadyHistory,
    week: i =>
      i === WEEK('2026-12-21')
        ? { volume: 0.4, note: 'Christmas travel' }
        : i === WEEK('2026-12-28')
        ? { volume: 0.65, note: 'New Year, partly travelling' }
        : asPlanned(),
  },
  {
    id: 'flu-in-peak',
    title: 'Flu in the peak',
    story: 'Follows the plan, then gets flu in mid-February (peak phase): one week off, one week at 30%, then back to the plan.',
    ...NYC,
    goalCreated: '2026-11-22',
    history: steadyHistory,
    week: i =>
      i === WEEK('2027-02-15')
        ? { volume: 0, note: 'Flu, no running' }
        : i === WEEK('2027-02-22')
        ? { volume: 0.3, note: 'Recovering from flu' }
        : asPlanned(),
  },
  {
    id: 'mostly-there',
    title: 'Consistently ~80%',
    story: 'Busy job: runs about 80% of every planned week, every week. Never misses a week outright. Feels fine.',
    ...NYC,
    goalCreated: '2026-11-22',
    history: steadyHistory,
    week: () => ({ volume: 0.8, long: 0.95, checkIn: fine }),
  },
  {
    id: 'overachiever',
    title: 'Overachiever',
    story: 'Enthusiastic: runs about 30% more than planned every week and checks in "easy / fresh".',
    ...NYC,
    goalCreated: '2026-11-22',
    history: steadyHistory,
    week: () => ({ volume: 1.3, long: 1.15, checkIn: { effort: 1, freshness: 3, soreness: 1, enjoyment: 3 } }),
  },
  {
    id: 'drained',
    title: 'Two drained weeks',
    story: 'Follows the plan; in weeks 9 and 10 (late January) work stress leaves them "hard / drained" after each week.',
    ...NYC,
    goalCreated: '2026-11-22',
    history: steadyHistory,
    week: i =>
      i === 8 || i === 9
        ? { volume: 1, checkIn: { effort: 3, freshness: 1, soreness: 2, enjoyment: 2 }, note: 'Hard, drained (work stress)' }
        : asPlanned(),
  },
  {
    id: 'niggle',
    title: 'Calf niggle',
    story: 'Follows the plan; after week 12 reports "pain in one spot" (calf), runs 75% the next week, then is fine.',
    ...NYC,
    goalCreated: '2026-11-22',
    history: steadyHistory,
    week: i =>
      i === 11
        ? { volume: 1, checkIn: { effort: 2, freshness: 2, soreness: 3, enjoyment: 2 }, note: 'Calf pain in one spot' }
        : i === 12
        ? { volume: 0.75, checkIn: fine, note: 'Easing back after calf' }
        : asPlanned(),
  },
  {
    id: 'bored',
    title: 'Losing interest',
    story: 'Follows the plan but rates weeks 6 and 7 "a chore" for enjoyment.',
    ...NYC,
    goalCreated: '2026-11-22',
    history: steadyHistory,
    week: i =>
      i === 5 || i === 6 ? { volume: 1, checkIn: { ...fine, enjoyment: 1 }, note: 'Felt like a chore' } : asPlanned(),
  },
  {
    id: 'late-start',
    title: 'Late start',
    story: 'Adds the race only 6 weeks before race day, from a 20 mi/wk base, then follows the plan.',
    ...NYC,
    goalCreated: '2027-02-07',
    history: steadyHistory,
    week: asPlanned,
  },
  {
    id: 'one-week-later',
    title: 'Adds the goal a week later',
    story: 'Same as "Follows the plan", but adds the race one week later (16-week season).',
    ...NYC,
    goalCreated: '2026-11-29',
    history: steadyHistory,
    week: asPlanned,
  },
  {
    id: 'low-base',
    title: 'Newer runner',
    story: 'Runs about 8 mi a week before adding the race; follows the plan.',
    ...NYC,
    goalCreated: '2026-11-22',
    history: [6, 7, 8, 7, 8, 8, 9, 8, 8, 7, 8, 8].map(m => m * MI),
    week: asPlanned,
  },
  {
    id: 'comeback',
    title: 'Coming back from a break',
    story: 'Was running 20 mi/wk, took 3 weeks off for an injury, and adds the race on the day they restart. Follows the plan.',
    ...NYC,
    goalCreated: '2026-11-22',
    history: [20, 21, 20, 22, 20, 21, 20, 21, 20, 0, 0, 0].map(m => m * MI),
    week: asPlanned,
  },
  {
    id: 'high-base',
    title: 'Experienced runner',
    story: 'Runs about 40 mi/wk before adding the race; follows the plan.',
    ...NYC,
    goalCreated: '2026-11-22',
    history: [38, 40, 41, 39, 40, 42, 40, 41, 40, 39, 41, 40].map(m => m * MI),
    week: asPlanned,
  },
  {
    id: 'marathon',
    title: 'Marathon goal',
    story: 'Adds a spring marathon (May 2) from a 25 mi/wk base and follows the plan. The goal form offers Marathon.',
    raceName: 'Spring marathon',
    raceDate: '2027-05-02',
    raceKm: 42.195,
    goalCreated: '2026-11-22',
    history: [24, 25, 26, 24, 25, 26, 25, 24, 25, 26, 25, 25].map(m => m * MI),
    week: asPlanned,
  },
  {
    id: 'five-k',
    title: '5K goal',
    story: 'Adds a 5K race 10 weeks out from 15 mi/wk and follows the plan.',
    raceName: 'Spring 5K',
    raceDate: '2027-01-31',
    raceKm: 5,
    goalCreated: '2026-11-22',
    history: [14, 15, 15, 16, 15, 14, 15, 16, 15, 15, 15, 15].map(m => m * MI),
    week: asPlanned,
  },
]
