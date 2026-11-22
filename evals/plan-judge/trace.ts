import type { PlanWeek, RacePlan } from '@/lib/racePlan'
import { fillTokens } from '@/lib/raceFormat'
import { MI, type SimResult } from './personas'
import type { CheckResult } from './checks'

// Renders a simulated season as plain text for the judge: who the runner
// is, the plan as it stood each week next to what they ran, each week's
// rules, the change log, and the deterministic check results.

const mi = (km: number | null | undefined) => (km == null ? '—' : (km / MI).toFixed(1))
const levels = (w: PlanWeek) => {
  const c = w.checkIn
  if (!c) return ''
  return [
    ['easy', 'medium', 'hard'][c.effort - 1],
    ['drained', 'okay', 'fresh'][c.freshness - 1],
    ['no soreness', 'sore', 'PAIN'][c.soreness - 1],
    c.enjoyment ? ['chore', 'fine', 'loved it'][c.enjoyment - 1] : '',
  ]
    .filter(Boolean)
    .join('/')
}

export function weekTable(plan: RacePlan, notes: Record<number, string> = {}) {
  const rows = plan.weeks.map(w => {
    const flags = [w.cutback && 'cutback', w.hold && 'hold'].filter(Boolean).join(',')
    const sessions = w.sessions.map(s => `${s.label}: ${fillTokens(s.detail, 'mi')}`).join('; ')
    return `| ${w.number} | ${w.start} | ${w.phase}${flags ? ` (${flags})` : ''} | ${mi(w.targetKm)} | ${mi(w.actualKm)} | ${mi(w.longKm)} | ${mi(w.longestKm)} | ${sessions} | ${levels(w)} | ${notes[w.number] ?? ''} |`
  })
  return [
    '| wk | Monday | phase | planned mi | ran mi | long planned | longest ran | sessions | check-in | what happened |',
    '|---|---|---|---|---|---|---|---|---|---|',
    ...rows,
  ].join('\n')
}

export function trailText(plan: RacePlan) {
  return plan.weeks
    .map(w => `wk ${w.number}: ${w.trail.map(t => `${t.rule}[${fillTokens(t.inputs, 'mi')} → ${fillTokens(t.out, 'mi')}]`).join('; ')}`)
    .join('\n')
}

export function checksText(checks: CheckResult[]) {
  return checks
    .map(c => `- ${c.passed ? 'PASS' : 'FAIL'} [${c.severity}] ${c.id} — ${c.title}${c.passed ? '' : `\n  ${c.evidence.join('\n  ')}`}`)
    .join('\n')
}

export function renderTrace(sim: SimResult, checks: CheckResult[] | null) {
  const p = sim.persona
  const plan = sim.final
  return `# Persona: ${p.title} (${p.id})

${p.story}

Race: ${p.raceName}, ${p.raceDate}, ${(p.raceKm / MI).toFixed(1)} mi. Goal added ${p.goalCreated}.
Weekly miles in the 12 weeks before: ${p.history.map(k => (k / MI).toFixed(0)).join(', ')}.
Baseline used by the plan: ${mi(plan.baselineKm)} mi/wk. Planned peak: ${mi(plan.peakKm)} mi (wk ${plan.peakWeek}). Longest planned long run: ${mi(plan.longestLong.km)} mi (wk ${plan.longestLong.week}).

## Season, week by week
Past weeks show the plan as it stood at the start of that week (it is re-planned every Monday).

${weekTable(plan, sim.notes)}

## Change log (newest first)
${plan.changes.map(c => `- ${c.weekStart}: ${fillTokens(c.title, 'mi')}. ${fillTokens(c.why, 'mi')} [${c.rules.join(', ')}]`).join('\n')}

## Rules applied each week
${trailText(plan)}

${checks ? `## Deterministic checks\n${checksText(checks)}\n` : ''}`
}
