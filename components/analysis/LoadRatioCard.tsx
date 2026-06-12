'use client'

const BANDS = [
  {
    max: 0.8,
    classes: 'text-sky-700 bg-sky-50 border-sky-200',
    label: 'Recovering / detraining',
    detail: 'Recent load is well below your fitness — fine for a taper or recovery week.',
  },
  {
    max: 1.3,
    classes: 'text-emerald-700 bg-emerald-50 border-emerald-200',
    label: 'Sustainable build',
    detail: 'Load is rising at a rate your body can absorb.',
  },
  {
    max: 1.5,
    classes: 'text-amber-700 bg-amber-50 border-amber-200',
    label: 'Pushing the limit',
    detail: 'Load is climbing fast — consider an easy day soon.',
  },
  {
    max: Infinity,
    classes: 'text-rose-700 bg-rose-50 border-rose-200',
    label: 'Overreach risk',
    detail: 'Acute load far exceeds your base — injury risk zone. Rest recommended.',
  },
]

export default function LoadRatioCard({ ratio }: { ratio: number | null }) {
  const band = ratio === null ? null : BANDS.find(b => ratio < b.max)!

  return (
    <div className="bg-white rounded-2xl border border-zinc-200 p-5 flex flex-col">
      <h2 className="text-sm font-semibold text-zinc-900">Acute : Chronic Load</h2>
      <p className="text-xs text-zinc-500 mt-0.5">
        This week&apos;s load vs. your 6-week base. 0.8–1.3 is the validated safe-build window.
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
