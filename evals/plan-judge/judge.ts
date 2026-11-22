import Anthropic from '@anthropic-ai/sdk'
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'
import type { z } from 'zod'
import { DIMENSIONS, JudgeVerdict, PairwiseVerdict, SYSTEM_PROMPT, type Dimension } from './rubric'

// One judge call = one Claude request with a structured output. Adaptive
// thinking at high effort: judging a season is a reasoning task. Server-side
// refusal fallback is on, so a rare safety decline is retried on another
// model instead of failing the run.

export const MODEL = 'claude-opus-5-5'

const client = new Anthropic()

export interface Usage {
  input: number
  output: number
}

async function ask<T extends z.ZodType>(schema: T, user: string): Promise<{ value: z.infer<T>; usage: Usage }> {
  const stream = client.beta.messages.stream({
    model: MODEL,
    max_tokens: 32000,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    thinking: { type: 'adaptive' },
    output_config: { effort: 'high', format: zodOutputFormat(schema) },
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: user }],
  })
  const msg = await stream.finalMessage()
  if (msg.stop_reason === 'refusal') throw new Error(`Judge refused: ${msg.stop_details?.category ?? 'unknown'}`)
  if (msg.stop_reason === 'max_tokens') throw new Error('Judge hit max_tokens')
  const text = msg.content.flatMap(b => (b.type === 'text' ? [b.text] : [])).join('')
  const value = schema.parse(JSON.parse(text))
  return { value, usage: { input: msg.usage.input_tokens, output: msg.usage.output_tokens } }
}

/** Absolute scoring of one season. */
export function judgeSeason(trace: string) {
  return ask(
    JudgeVerdict,
    `${trace}\n\nScore this plan for this runner on every dimension of the rubric. Evidence first, then the score.`,
  )
}

/**
 * Pairwise comparison on one dimension. Used to calibrate the judge against
 * plans with known, planted defects. Callers randomise which plan is A.
 */
export function judgePair(context: string, a: string, b: string, dimension: Dimension) {
  const d = DIMENSIONS[dimension]
  return ask(
    PairwiseVerdict,
    `${context}

Two versions of this runner's plan follow. Compare them only on ${d.title}: ${d.question}

<plan id="A">
${a}
</plan>

<plan id="B">
${b}
</plan>

Which plan is better on ${d.title} for this runner? Answer "tie" only if they are equivalent on this dimension.`,
  )
}
