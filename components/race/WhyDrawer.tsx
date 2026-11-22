'use client'

import { useEffect, useRef } from 'react'
import Link from 'next/link'
import { format, parseISO } from 'date-fns'
import type { PlanWeek } from '@/lib/racePlan'
import type { Prediction } from '@/lib/racePrediction'
import { PRINCIPLES } from '@/lib/racePrinciples'
import type { Unit } from '@/lib/units'
import { fillTokens, fmtClock, fmtDistance, fmtHalf, fmtRange } from '@/lib/raceFormat'
import EvidenceBadge from './EvidenceBadge'
import { PHASE_STYLE } from './MileageChart'

export type DrawerTarget = { kind: 'week'; index: number } | { kind: 'projection' }

const CONFIDENCE = {
  high: { label: 'High confidence', box: 'border-emerald-200 bg-emerald-50', head: 'text-emerald-800', body: 'text-emerald-900' },
  medium: { label: 'Medium confidence', box: 'border-amber-200 bg-amber-50', head: 'text-amber-800', body: 'text-amber-900' },
  low: { label: 'Low confidence', box: 'border-orange-200 bg-orange-50', head: 'text-orange-800', body: 'text-orange-900' },
} as const

function RuleStep({ n, rule, inputs, out, unit }: { n: number; rule: string; inputs: string; out: string; unit: Unit }) {
  const p = PRINCIPLES[rule]
  return (
    <li className="rounded-xl border border-zinc-200 px-4 py-3 space-y-1">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <span className="text-xs font-semibold font-mono text-zinc-700">
          {n}. {rule}
        </span>
        {p && <EvidenceBadge evidence={p.evidence} />}
      </div>
      {p && <p className="text-sm font-medium text-zinc-900">{p.says}</p>}
      <p className="text-sm text-zinc-600">{fillTokens(inputs, unit)}</p>
      <p className="text-sm font-semibold text-zinc-900">→ {fillTokens(out, unit)}</p>
      {p && (
        <Link href={`/guide#rule-${rule}`} className="text-xs text-blue-700 hover:underline">
          {p.sources.join(' · ')}
        </Link>
      )}
    </li>
  )
}

export default function WhyDrawer({
  target,
  weeks,
  prediction,
  unit,
  onClose,
  onTarget,
}: {
  target: DrawerTarget
  weeks: PlanWeek[]
  prediction: Prediction | null
  unit: Unit
  onClose: () => void
  onTarget: (t: DrawerTarget) => void
}) {
  const close = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    close.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = overflow
    }
  }, [onClose])

  const week = target.kind === 'week' ? weeks[target.index] : null
  const tab = (active: boolean) =>
    `h-11 px-3 text-sm font-semibold border-b-2 transition-colors ${
      active ? 'text-zinc-900 border-blue-600' : 'text-zinc-500 border-transparent hover:text-zinc-900'
    }`
  const current = weeks.findIndex(w => w.status === 'current')
  const weekIndex = target.kind === 'week' ? target.index : Math.max(0, current)

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-labelledby="why-title">
      <button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0 bg-zinc-900/30 cursor-default" />
      <div className="absolute inset-x-0 bottom-0 max-h-[85vh] rounded-t-2xl md:inset-y-0 md:left-auto md:right-0 md:max-h-none md:w-[520px] md:rounded-none bg-white shadow-xl flex flex-col">
        <div className="px-5 pt-5 flex items-start justify-between gap-3">
          <div>
            <p className="text-xs text-zinc-500">
              {week
                ? `Week ${week.number} · ${format(parseISO(week.start), 'MMM d')}–${format(parseISO(week.end), 'MMM d')} · ${PHASE_STYLE[week.phase].label}${week.cutback ? ' (cutback)' : ''}`
                : 'Projected finish'}
            </p>
            <h2 id="why-title" className="text-lg font-semibold text-zinc-900 mt-0.5">
              {week ? 'Why this week?' : 'Why this number?'}
            </h2>
          </div>
          <button
            ref={close}
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="h-11 w-11 shrink-0 rounded-xl border border-zinc-200 flex items-center justify-center hover:bg-zinc-50"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
              <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        <div className="flex gap-1 px-5 mt-3 border-b border-zinc-200" role="tablist">
          <button type="button" role="tab" aria-selected={!!week} className={tab(!!week)} onClick={() => onTarget({ kind: 'week', index: weekIndex })}>
            Weekly target
          </button>
          <button type="button" role="tab" aria-selected={!week} className={tab(!week)} onClick={() => onTarget({ kind: 'projection' })}>
            Projected time
          </button>
        </div>

        <div className="overflow-y-auto px-5 py-5 space-y-4">
          {week && (
            <>
              <div className="rounded-xl bg-zinc-50 px-4 py-3 flex items-baseline justify-between gap-3">
                <span className="text-sm text-zinc-600">Result</span>
                <span className="text-lg font-semibold text-zinc-900 text-right">
                  {fmtDistance(week.targetKm, unit, 0)} ·{' '}
                  {target.kind === 'week' && target.index === weeks.length - 1
                    ? 'race day'
                    : `long run ${fmtHalf(week.longKm, unit)}`}
                </span>
              </div>
              {week.actualKm != null && (
                <p className="text-sm text-zinc-600">
                  You ran <strong className="text-zinc-900">{fmtDistance(week.actualKm, unit)}</strong>
                  {week.status === 'current' ? ' so far' : ''}
                  {week.longestKm ? `, longest run ${fmtDistance(week.longestKm, unit)}` : ''}.
                  {week.onPlan === true && ' Within 10% of the plan, so it counts as a full week.'}
                </p>
              )}
              {week.checkIn && (
                <p className="text-sm text-zinc-600">
                  Check-in: felt {['easy', 'medium', 'hard'][week.checkIn.effort - 1]},{' '}
                  {['drained', 'okay', 'fresh'][week.checkIn.freshness - 1]},{' '}
                  {['no soreness', 'normal soreness', 'pain in one spot'][week.checkIn.soreness - 1]}.
                </p>
              )}
              <p className="text-sm text-zinc-500">
                Applied in order. Each step names the rule, the numbers it used and how solid its backing is.
              </p>
              <ol className="space-y-2.5">
                {week.trail.map((t, i) => (
                  <RuleStep key={i} n={i + 1} {...t} unit={unit} />
                ))}
              </ol>
              <div className="flex justify-between text-sm">
                <button
                  type="button"
                  disabled={weekIndex === 0}
                  onClick={() => onTarget({ kind: 'week', index: weekIndex - 1 })}
                  className="h-11 px-3 rounded-lg border border-zinc-200 disabled:opacity-40 hover:bg-zinc-50"
                >
                  ← Week {weekIndex}
                </button>
                <button
                  type="button"
                  disabled={weekIndex === weeks.length - 1}
                  onClick={() => onTarget({ kind: 'week', index: weekIndex + 1 })}
                  className="h-11 px-3 rounded-lg border border-zinc-200 disabled:opacity-40 hover:bg-zinc-50"
                >
                  Week {weekIndex + 2} →
                </button>
              </div>
            </>
          )}

          {!week && !prediction && (
            <p className="text-sm text-zinc-600">
              Not enough data yet. The projection needs either a hard effort of 5K or more in the last 90 days, or at
              least 6 runs with heart rate in the last 8 weeks.
            </p>
          )}

          {!week && prediction && (
            <>
              <div className="rounded-xl bg-zinc-50 px-4 py-3 flex items-baseline justify-between gap-3">
                <span className="text-sm text-zinc-600">If you raced today</span>
                <span className="text-lg font-semibold tabular-nums text-zinc-900">
                  {fmtClock(prediction.seconds)}{' '}
                  <span className="text-sm font-medium text-zinc-500">({fmtRange(prediction.low, prediction.high)})</span>
                </span>
              </div>
              <h3 className="text-sm font-semibold text-zinc-900">Methods blended</h3>
              <div className="rounded-xl border border-zinc-200 divide-y divide-zinc-100 text-sm">
                {prediction.methods.map(m => (
                  <div key={m.rule} className="px-4 py-3 space-y-1">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="font-semibold text-zinc-900">{m.label}</span>
                      <span className="tabular-nums font-medium">
                        {fmtClock(m.seconds)} · {Math.round(m.weight * 100)}%
                      </span>
                    </div>
                    <p className="text-zinc-600">{m.detail}</p>
                    {m.inputs.length > 0 && (
                      <ul className="text-zinc-600 space-y-0.5">
                        {m.inputs.map(r => (
                          <li key={r.runId}>
                            <Link href={`/runs/${r.runId}`} className="text-blue-700 hover:underline">
                              {format(parseISO(r.date), 'MMM d')}
                            </Link>{' '}
                            {r.text}
                          </li>
                        ))}
                      </ul>
                    )}
                    <div className="flex items-center gap-2 pt-1">
                      <EvidenceBadge evidence={PRINCIPLES[m.rule].evidence} />
                      <Link href={`/guide#rule-${m.rule}`} className="text-xs text-blue-700 hover:underline">
                        {PRINCIPLES[m.rule].sources.join(' · ')}
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
              {prediction.excluded.length > 0 && (
                <>
                  <h3 className="text-sm font-semibold text-zinc-900">Left out</h3>
                  <ul className="list-disc pl-5 text-sm text-zinc-700 space-y-1">
                    {prediction.excluded.map(r => (
                      <li key={r.runId}>
                        <Link href={`/runs/${r.runId}`} className="text-blue-700 hover:underline">
                          {r.name} ({format(parseISO(r.date), 'MMM d')})
                        </Link>
                        : {r.text}
                      </li>
                    ))}
                  </ul>
                </>
              )}
              <div className={`rounded-xl border px-4 py-3 ${CONFIDENCE[prediction.confidence].box}`}>
                <p className={`text-sm font-semibold ${CONFIDENCE[prediction.confidence].head}`}>
                  {CONFIDENCE[prediction.confidence].label}
                </p>
                <p className={`text-sm mt-0.5 ${CONFIDENCE[prediction.confidence].body}`}>
                  {prediction.confidenceReason} {prediction.sharpen}
                </p>
              </div>
              {prediction.raceDay && (
                <p className="text-sm text-zinc-600">
                  <strong className="text-zinc-900">If training goes to plan:</strong>{' '}
                  {fmtRange(prediction.raceDay.low, prediction.raceDay.high)}. {PRINCIPLES.PROJECTED_GAIN.says}
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
