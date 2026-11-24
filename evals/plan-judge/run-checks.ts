import { mkdirSync, writeFileSync } from 'node:fs'
import { PERSONAS, simulate } from './personas'
import { runChecks } from './checks'
import { renderTrace } from './trace'

// Free, offline: simulate every persona, run the deterministic checks, and
// write the traces the LLM judge reads. `npm run eval:plans:checks`.

const out = 'evals/plan-judge/results'
mkdirSync(`${out}/traces`, { recursive: true })
const summary: Record<string, { failed: string[] }> = {}
for (const p of PERSONAS) {
  const sim = simulate(p)
  const checks = runChecks({ plan: sim.final, sim, raceKm: p.raceKm })
  writeFileSync(`${out}/traces/${p.id}.md`, renderTrace(sim, checks))
  const failed = checks.filter(c => !c.passed)
  summary[p.id] = { failed: failed.map(c => `${c.severity.toUpperCase()} ${c.id}: ${c.evidence[0]}${c.evidence.length > 1 ? ` (+${c.evidence.length - 1} more)` : ''}`) }
  console.log(`\n${p.id} — ${p.title}`)
  if (!failed.length) console.log('  all checks pass')
  for (const f of summary[p.id].failed) console.log(`  ✗ ${f}`)
}
writeFileSync(`${out}/checks.json`, JSON.stringify(summary, null, 2))
