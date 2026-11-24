import { describe, expect, it } from 'vitest'
import { PERSONAS, simulate } from './personas'
import { runChecks } from './checks'
import { MUTATIONS } from './mutations'

// Calibrates the deterministic checks: they pass a known-good season and
// catch every planted defect. (Whether the real planner passes them for
// every persona is a finding of the eval, reported by run-checks.ts, not a
// test: those failures are the bugs the eval exists to surface.)

const steady = simulate(PERSONAS.find(p => p.id === 'steady')!)
const raceKm = steady.persona.raceKm

describe('deterministic plan checks', () => {
  it('pass the steady runner’s season', () => {
    const failed = runChecks({ plan: steady.final, sim: steady, raceKm }).filter(c => !c.passed)
    expect(failed.map(c => c.id)).toEqual([])
  })

  it.each(MUTATIONS.filter(m => m.check))('catch the planted defect: $id', m => {
    const checks = runChecks({ plan: m.apply(steady.final), sim: steady, raceKm })
    const hit = checks.find(c => c.id === m.check)!
    expect(hit.passed).toBe(false)
    expect(hit.evidence.length).toBeGreaterThan(0)
  })

  it('flag half-marathon workouts in a 5K plan', () => {
    const fiveK = simulate(PERSONAS.find(p => p.id === 'five-k')!)
    const c = runChecks({ plan: fiveK.final, sim: fiveK, raceKm: 5 }).find(c => c.id === 'SPECIFICITY')!
    expect(c.evidence.join(' ')).toMatch(/half-marathon/)
  })
})
