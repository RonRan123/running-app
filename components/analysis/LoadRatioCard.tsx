'use client'

import { HelpLink } from './ChartCard'

const BANDS = [
  {
    max: 0.8,
    classes: 'text-sky-700 bg-sky-50 border-sky-200',
    label: 'Easing off',
    detail: 'This week is well below what you are used to. Fine for a recovery week.',
  },
  {
    max: 1.3,
    classes: 'text-emerald-700 bg-emerald-50 border-emerald-200',
    label: 'Steady',
    detail: 'This week is in line with your recent weeks.',
  },
  {
    max: 1.5,
    classes: 'text-amber-700 bg-amber-50 border-amber-200',
    label: 'Ramping up',
    detail: 'This week is noticeably heavier than your recent weeks.',
  },
  {
    max: Infinity,
    classes: 'text-rose-700 bg-rose-50 border-rose-200',
    label: 'Big jump',
    detail: 'This week is far heavier than your recent weeks. Check how your legs feel.',
  },
]

export default function LoadRatioCard({ ratio }: { ratio: number | null }) {
  const band = ratio === null ? null : BANDS.find(b => ratio < b.max)!

  return (
    <div className="bg-white rounded-2xl border border-zinc-200 p-5 flex flex-col">
      <h2 className="text-sm font-semibold text-zinc-900 flex items-center gap-1.5">
        Acute : Chronic Load
        <HelpLink id="load-ratio" label="Acute : Chronic Load" />
      </h2>
      <p className="text-xs text-zinc-500 mt-0.5">
        This week&apos;s load vs. your 6-week base: how fast you are ramping up. It describes
        your training; it is not an injury predictor and does not change the plan.
      </p>
      {ratio === null || !band ? (
        <div className="flex-1 flex items-center justify-center text-sm text-zinc-400 py-8">
          Not enough history to compute a ratio yet.
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center py-6">
          <span
            className={`text-5xl font-semibold tabular-nums rounded-2xl border px-6 py-3 ${band.classes}`}
          >
            {ratio.toFixed(2)}
          </span>
          <p className="text-sm font-medium text-zinc-900 mt-4">{band.label}</p>
          <p className="text-xs text-zinc-500 mt-1 text-center max-w-60">{band.detail}</p>
        </div>
      )}
    </div>
  )
}
