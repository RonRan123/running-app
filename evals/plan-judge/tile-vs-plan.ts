// Compares the 7-day tile with the race plan for the steady runner, week by week.
// Finding F7 in docs/race-plan-review.md. Run: npx tsx evals/plan-judge/tile-vs-plan.ts
import { PERSONAS, simulate, MI } from './personas'
import { planNextWeek } from '@/lib/trainingPlan'
const sim = simulate(PERSONAS.find(p => p.id === 'steady')!)
const acts = sim.runs.map(r => ({ id: r.id, name: 'Run', date: r.date, distance: r.distanceKm, duration: r.durationSec, avgPace: null, avgHeartRate: 145, maxHeartRate: 175 }))
const profile = { birthDate: '2002-07-23', age: null, recordedMax: 196 }
for (const s of sim.snapshots.slice(0, 16)) {
  const w = s.plan.weeks[s.plan.current]
  const pace = 6.2
  const race = { label: `wk ${w.number}`, targetMin: w.targetKm * pace, longMin: w.longKm * pace, workout: null, hills: null }
  const past = acts.filter(a => a.date.slice(0, 10) < s.monday)
  const t = planNextWeek({ activities: past, profile, today: s.monday, timeZone: 'UTC', race })
  const tileMi = (t.totalRunMin / pace / MI).toFixed(1)
  const flag = (w.cutback ? 'C' : '-') + '/' + (t.phase.kind === 'cutback' ? 'C' : t.phase.kind[0])
  console.log(`wk ${String(w.number).padStart(2)} race ${(w.targetKm / MI).toFixed(1).padStart(5)} mi  tile ${tileMi.padStart(5)} mi  cutback race/tile ${flag}  ${t.tags.join(' · ')}`)
}
