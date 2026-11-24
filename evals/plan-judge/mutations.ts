import type { RacePlan } from '@/lib/racePlan'
import { MI } from './personas'
import type { Dimension } from './rubric'

// Known-bad plans for calibration. Each takes a good plan and plants one
// defect a coach would object to. The deterministic checks must flag it
// (checks.test.ts), and the LLM judge must prefer the original on the named
// dimension (run-judge.ts --calibrate) before its scores are trusted.

export interface Mutation {
  id: string
  defect: string
  dimension: Dimension // where the judge should see it
  check: string | null // the deterministic check that must fail, if any
  apply: (plan: RacePlan) => RacePlan
}

const clone = (p: RacePlan): RacePlan => structuredClone(p)
const mid = (p: RacePlan) => p.weeks.findIndex(w => w.phase === 'build' && !w.cutback && w.number > 8)

export const MUTATIONS: Mutation[] = [
  {
    id: 'spike',
    defect: 'One build week jumps to 1.7× the week before.',
    dimension: 'safety',
    check: 'SPIKE',
    apply: p => {
      const q = clone(p)
      const i = mid(q)
      q.weeks[i].targetKm = q.weeks[i - 1].targetKm * 1.7
      q.weeks[i].longKm = Math.min(q.weeks[i].longKm, 0.35 * q.weeks[i].targetKm)
      return q
    },
  },
  {
    id: 'no-taper',
    defect: 'No taper: the last two weeks stay at peak volume.',
    dimension: 'specificity',
    check: 'TAPER',
    apply: p => {
      const q = clone(p)
      for (const w of q.weeks.filter(w => w.phase === 'taper')) w.targetKm = q.peakKm
      return q
    },
  },
  {
    id: 'long-heavy',
    defect: 'Long runs are half of every week in the build.',
    dimension: 'safety',
    check: 'LONG_SHARE',
    apply: p => {
      const q = clone(p)
      for (const w of q.weeks.filter(w => w.phase === 'build')) w.longKm = 0.5 * w.targetKm
      return q
    },
  },
  {
    id: 'two-quality',
    defect: 'Two hard sessions a week through the peak (tempo + race pace).',
    dimension: 'safety',
    check: 'ONE_QUALITY',
    apply: p => {
      const q = clone(p)
      for (const w of q.weeks.filter(w => w.phase === 'peak'))
        w.sessions.push({ kind: 'tempo', label: 'Tempo', detail: '4 × 1 mi at threshold', rule: 'THRESHOLD_CAP', quality: true })
      return q
    },
  },
  {
    id: 'short-long',
    defect: 'The long run never goes past 6 mi.',
    dimension: 'specificity',
    check: 'SPECIFICITY',
    apply: p => {
      const q = clone(p)
      for (const w of q.weeks.slice(0, -1)) w.longKm = Math.min(w.longKm, 6 * MI)
      return q
    },
  },
  {
    id: 'no-cutbacks',
    defect: 'No down weeks: every base and build week rises.',
    dimension: 'safety',
    check: 'CUTBACK_SPACING',
    apply: p => {
      const q = clone(p)
      for (let i = 1; i < q.weeks.length; i++) {
        const w = q.weeks[i]
        if (w.phase === 'taper') break
        w.cutback = false
        w.targetKm = Math.max(w.targetKm, q.weeks[i - 1].targetKm * 1.05)
      }
      return q
    },
  },
  {
    id: 'flatline',
    defect: 'No progression: every week before the taper is the baseline.',
    dimension: 'specificity',
    check: null,
    apply: p => {
      const q = clone(p)
      for (const w of q.weeks.filter(w => w.phase !== 'taper')) {
        w.targetKm = q.baselineKm
        w.longKm = Math.min(w.longKm, 0.3 * q.baselineKm)
      }
      return q
    },
  },
]
