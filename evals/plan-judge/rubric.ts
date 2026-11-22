import { z } from 'zod'
import type { CheckResult } from './checks'

// The rubric the LLM judge scores against. Each dimension has anchored
// levels (what a 1, 3 and 5 look like), so two judges — or the same judge on
// two runs — mean the same thing by a score. Grounded in the same sources as
// lib/racePrinciples.ts, plus what a recreational runner needs to keep going.

export const DIMENSIONS = {
  safety: {
    weight: 0.25,
    title: 'Safety & load management',
    question: 'Is every week’s load defensible from what this runner actually ran, with recovery built in and red flags respected?',
    anchors: {
      5: 'Every week is defensible from recent actual running (no week far above the 4-week average or the most recently run); regular down weeks; pain or illness always lowers volume and removes intensity; returns from breaks are gradual.',
      3: 'Mostly conservative, but at least one week is not defensible from recent running, or one red flag gets a weak response.',
      1: 'Repeated spikes, long runs out of proportion, or pain/illness met with unchanged or higher load.',
    },
  },
  specificity: {
    weight: 0.2,
    title: 'Race specificity & periodization',
    question: 'Does the season prepare this runner for this race distance, course and pace?',
    anchors: {
      5: 'Clear base → build → peak → taper; the long run reaches a race-appropriate length (half: 10–13 mi); threshold and race-pace work in sensible doses that scale with the runner’s volume; tune-ups; a real taper.',
      3: 'Recognisable phases, but one key element is missing or off for this runner (long run short of race needs, workouts not scaled, taper oddly shaped).',
      1: 'Generic or wrong-distance training; the runner arrives without the long run or race-pace work the distance needs.',
    },
  },
  adaptivity: {
    weight: 0.2,
    title: 'Adaptivity to real life',
    question: 'When life happens (missed or partial weeks, overshooting, illness, check-ins), does the plan respond proportionately and recover?',
    anchors: {
      5: 'Responses are proportionate to the disruption: a short disruption costs about as long as it lasted; partial adherence converges to what the runner sustains; overshooting is neither rewarded nor ignored; the plan never spirals.',
      3: 'Responds in the right direction but over- or under-corrects at least once (e.g. a 2-week dip costs a month or the peak).',
      1: 'Ignores disruptions, or reacts so hard the season is lost (spiral, collapse, or jumps after a break).',
    },
  },
  sustainability: {
    weight: 0.15,
    title: 'Sustainability & enjoyment',
    question: 'Would a busy recreational runner who wants this to stay fun follow it without stress?',
    anchors: {
      5: 'Stable, predictable targets with a tolerance band; variety without overload; one clear message per week (no conflicting numbers across screens); flexes for enjoyment; never makes the runner feel behind.',
      3: 'Mostly followable, but targets churn, messages conflict, or the week asks for more decisions than needed.',
      1: 'Erratic or punishing; the runner would likely abandon it.',
    },
  },
  fit: {
    weight: 0.1,
    title: 'Fit to the runner & honest feasibility',
    question: 'Does the plan fit this runner’s level and history, and is it honest when the goal is a stretch?',
    anchors: {
      5: 'Volume and workouts suit the runner’s base; history (prior peaks, breaks) is used sensibly; when the race needs more than is reachable, the plan says so and offers options.',
      3: 'Suits the runner in general but silently under- or over-shoots what the race needs.',
      1: 'Plainly wrong for this runner (beginner given advanced work, or a plan that cannot prepare them, with no warning).',
    },
  },
  explainability: {
    weight: 0.1,
    title: 'Explainability & traceability',
    question: 'Can the runner see why each number is what it is, and are the explanations true and consistent?',
    anchors: {
      5: 'Every number traces to a named rule with honest evidence; the change log explains each change in plain words; nothing contradicts what the plan actually did.',
      3: 'Mostly traceable, but some explanations are generic, noisy, or slightly misleading.',
      1: 'Numbers appear without reasons, or the explanations contradict the plan.',
    },
  },
} as const

export type Dimension = keyof typeof DIMENSIONS
export const DIMENSION_KEYS = Object.keys(DIMENSIONS) as Dimension[]

// Failed deterministic gates cap these dimensions, enforced in code after the
// judge answers, so the judge cannot talk its way past a hard fact.
export const GATE_CAPS: Record<string, { dimension: Dimension; max: number }> = {
  SPIKE: { dimension: 'safety', max: 2 },
  TAPER_VS_RECENT: { dimension: 'safety', max: 2 },
  CHECKINS: { dimension: 'safety', max: 2 },
  LONG_SHARE: { dimension: 'safety', max: 3 },
  LONG_STEP: { dimension: 'safety', max: 3 },
  NON_DEGENERATE: { dimension: 'fit', max: 1 },
  NO_SPIRAL: { dimension: 'adaptivity', max: 1 },
  SPECIFICITY: { dimension: 'specificity', max: 2 },
  TAPER: { dimension: 'specificity', max: 2 },
  ONE_QUALITY: { dimension: 'safety', max: 3 },
}

const DimensionVerdict = z.object({
  evidence: z
    .array(z.string())
    .describe('Specific observations with week numbers and values, written before deciding the score. At least two.'),
  score: z.number().int().min(1).max(5),
  to_reach_5: z.string().describe('The concrete change that would make this a 5. Empty if already 5.'),
})

export const JudgeVerdict = z.object({
  safety: DimensionVerdict,
  specificity: DimensionVerdict,
  adaptivity: DimensionVerdict,
  sustainability: DimensionVerdict,
  fit: DimensionVerdict,
  explainability: DimensionVerdict,
  biggest_risk: z.string().describe('The single most important problem for this runner, in one or two sentences.'),
  what_works: z.string().describe('The single strongest aspect of this plan for this runner.'),
})
export type JudgeVerdict = z.infer<typeof JudgeVerdict>

export const PairwiseVerdict = z.object({
  reasoning: z.string().describe('Compare the two plans on the named dimension, citing weeks.'),
  better: z.enum(['A', 'B', 'tie']),
})
export type PairwiseVerdict = z.infer<typeof PairwiseVerdict>

export function rubricText() {
  return DIMENSION_KEYS.map(k => {
    const d = DIMENSIONS[k]
    return `### ${d.title} (\`${k}\`)\n${d.question}\n- 5: ${d.anchors[5]}\n- 3: ${d.anchors[3]}\n- 1: ${d.anchors[1]}\n(2 and 4 sit between the anchors.)`
  }).join('\n\n')
}

export const SYSTEM_PROMPT = `You are an experienced running coach and sports scientist reviewing a training plan produced by software for one recreational runner. You judge plans for a living, and you are careful: you score only what the evidence shows.

You will receive:
- who the runner is and what they did over the season (a simulation of their real behaviour),
- the plan week by week, with what they actually ran and how each week's numbers were set,
- the change log the runner saw,
- results of deterministic checks computed by code. Treat these as facts; do not re-litigate them, but do weigh how much they matter for this runner.

How to judge:
1. For each dimension, first write the evidence (week numbers and values), then pick the score using the anchors. Two or more evidence items per dimension.
2. Judge the plan for this runner, as they actually behaved, not an idealised one.
3. Be calibrated: a 5 means you would hand this to a client unchanged; a 3 means usable with a coach's edits; a 1 means you would stop the runner from following it.
4. Do not reward length, confidence or how scientific the explanations sound. Reward plans that would get this runner to the start line healthy, prepared and still enjoying running.
5. If something important falls outside the dimensions, put it in biggest_risk.

The rubric:

${rubricText()}`

/** Apply gate caps from the deterministic checks. Returns the capped verdict and what was capped. */
export function applyCaps(v: JudgeVerdict, checks: CheckResult[]) {
  const capped: string[] = []
  const out = structuredClone(v)
  for (const c of checks) {
    const cap = GATE_CAPS[c.id]
    if (!cap || c.passed) continue
    if (out[cap.dimension].score > cap.max) {
      capped.push(`${cap.dimension} ${out[cap.dimension].score} → ${cap.max} (${c.id})`)
      out[cap.dimension].score = cap.max
    }
  }
  return { verdict: out, capped }
}

export function weightedScore(v: JudgeVerdict) {
  return DIMENSION_KEYS.reduce((s, k) => s + v[k].score * DIMENSIONS[k].weight, 0)
}
