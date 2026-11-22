import { mkdirSync, writeFileSync } from 'node:fs'
import { PERSONAS, simulate } from './personas'
import { runChecks } from './checks'
import { renderTrace } from './trace'
import { MUTATIONS } from './mutations'
import { applyCaps, DIMENSION_KEYS, weightedScore, type JudgeVerdict } from './rubric'
import { judgePair, judgeSeason, MODEL, type Usage } from './judge'

// LLM-as-judge over the simulated seasons.
//
//   npm run eval:plans:judge                    # dry run: prints calls and estimated cost
//   npm run eval:plans:judge -- --yes           # every persona, 3 samples each
//   npm run eval:plans:judge -- --yes --calibrate          # also the blind pairwise calibration
//   npm run eval:plans:judge -- --yes --personas steady,holidays --samples 1
//
// Method:
//  1. Deterministic checks run first; their results go to the judge as facts
//     and cap the related dimension scores in code (rubric.ts GATE_CAPS).
//  2. Each season is judged N times independently; we report the median per
//     dimension and flag spreads > 1 as unreliable.
//  3. --calibrate: before trusting the scores, the judge compares the steady
//     season with copies carrying one planted defect each, blind (no check
//     results, A/B order randomised). It must prefer the original on the
//     defect's dimension. Accuracy below 90% means the rubric or prompt needs
//     work before the absolute scores mean anything.

const args = process.argv.slice(2)
const flag = (name: string) => args.includes(`--${name}`)
const opt = (name: string) => {
  const i = args.indexOf(`--${name}`)
  return i >= 0 ? args[i + 1] : undefined
}
const samples = Number(opt('samples') ?? 3)
const only = opt('personas')?.split(',')
const personas = PERSONAS.filter(p => !only || only.includes(p.id))
const calibrate = flag('calibrate')

// Opus 5.5 list prices, $ per million tokens.
const PRICE = { input: 4, output: 20 }
const OUT_DIR = 'evals/plan-judge/results/judge'

function estimate() {
  const seasons = personas.map(p => renderTrace(simulate(p), runChecks({ plan: simulate(p).final, sim: simulate(p), raceKm: p.raceKm })))
  const avgIn = seasons.reduce((s, t) => s + t.length, 0) / seasons.length / 3.5 + 2500
  const outPer = 6000 // structured verdict plus adaptive thinking at high effort
  const calls = personas.length * samples + (calibrate ? MUTATIONS.length * 2 : 0)
  const cost = (calls * (avgIn * PRICE.input + outPer * PRICE.output)) / 1e6
  return { calls, avgIn: Math.round(avgIn), cost }
}

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b)
  return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2
}

async function main() {
  const est = estimate()
  console.log(`${MODEL}: ${est.calls} calls, ~${est.avgIn} input tokens each, est. $${est.cost.toFixed(2)}`)
  if (!flag('yes')) {
    console.log('Dry run. Add --yes to run it.')
    return
  }
  mkdirSync(OUT_DIR, { recursive: true })
  const used: Usage = { input: 0, output: 0 }
  const add = (u: Usage) => {
    used.input += u.input
    used.output += u.output
  }

  const rows: string[] = []
  for (const p of personas) {
    const sim = simulate(p)
    const checks = runChecks({ plan: sim.final, sim, raceKm: p.raceKm })
    const trace = renderTrace(sim, checks)
    const verdicts: { verdict: JudgeVerdict; capped: string[] }[] = []
    for (let k = 0; k < samples; k++) {
      const { value, usage } = await judgeSeason(trace)
      add(usage)
      verdicts.push(applyCaps(value, checks))
      process.stdout.write('.')
    }
    const dims = Object.fromEntries(
      DIMENSION_KEYS.map(d => {
        const scores = verdicts.map(v => v.verdict[d].score)
        return [d, { median: median(scores), spread: Math.max(...scores) - Math.min(...scores), scores }]
      }),
    )
    const overall = median(verdicts.map(v => weightedScore(v.verdict)))
    writeFileSync(`${OUT_DIR}/${p.id}.json`, JSON.stringify({ persona: p.id, checks, dims, overall, verdicts }, null, 2))
    rows.push(
      `| ${p.id} | ${DIMENSION_KEYS.map(d => `${dims[d].median}${dims[d].spread > 1 ? '⚠' : ''}`).join(' | ')} | ${overall.toFixed(2)} | ${checks.filter(c => !c.passed && c.severity === 'gate').map(c => c.id).join(', ')} |`,
    )
    console.log(` ${p.id} ${overall.toFixed(2)}`)
  }

  let calibration = ''
  if (calibrate) {
    const steady = simulate(PERSONAS.find(p => p.id === 'steady')!)
    const context = `Runner: ${steady.persona.story}`
    const original = renderTrace(steady, null)
    let right = 0
    const lines: string[] = []
    for (const [n, m] of MUTATIONS.entries()) {
      for (const swap of [false, true]) {
        const bad = renderTrace({ ...steady, final: m.apply(steady.final) }, null)
        const [a, b] = swap ? [bad, original] : [original, bad]
        const { value, usage } = await judgePair(context, a, b, m.dimension)
        add(usage)
        const correct = value.better === (swap ? 'B' : 'A')
        if (correct) right++
        lines.push(`| ${m.id} | ${m.dimension} | ${swap ? 'B' : 'A'} | ${value.better} | ${correct ? '✓' : '✗'} |`)
        process.stdout.write(n % 2 ? '+' : '-')
      }
    }
    const total = MUTATIONS.length * 2
    calibration = `\n## Calibration (blind pairwise, planted defects)\n\nAccuracy: ${right}/${total} (${Math.round((right / total) * 100)}%). Below 90% means fix the rubric before trusting the scores.\n\n| defect | dimension | original was | judge chose | |\n|---|---|---|---|---|\n${lines.join('\n')}\n`
  }

  const cost = (used.input * PRICE.input + used.output * PRICE.output) / 1e6
  const summary = `# Plan judge results\n\nModel ${MODEL}, ${samples} sample(s) per persona. Scores are medians (1–5); ⚠ = samples disagree by more than 1.\nActual usage: ${used.input} input / ${used.output} output tokens ≈ $${cost.toFixed(2)}.\n\n| persona | ${DIMENSION_KEYS.join(' | ')} | weighted | failed gates |\n|---|${DIMENSION_KEYS.map(() => '---').join('|')}|---|---|\n${rows.join('\n')}\n${calibration}`
  writeFileSync(`${OUT_DIR}/summary.md`, summary)
  console.log(`\n${summary}`)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
