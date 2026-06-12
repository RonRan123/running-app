'use client'

import ChartCard, { ChartEmpty } from '@/components/analysis/ChartCard'
import { KM_PER_MILE, formatDuration, type Unit } from '@/lib/units'
import type { Split } from '@/lib/runAnalysis'

const FEET_PER_METER = 3.28084

function formatSplitPace(minPerKm: number, unit: Unit) {
  const pace = unit === 'mi' ? minPerKm * KM_PER_MILE : minPerKm
  const m = Math.floor(pace)
  const s = Math.round((pace - m) * 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

export default function SplitsTable({ splits, unit }: { splits: Split[]; unit: Unit }) {
  const splitMeters = unit === 'mi' ? KM_PER_MILE * 1000 : 1000
  const maxPace = Math.max(...splits.map(s => s.paceMinPerKm), 0)
  const minPace = Math.min(...splits.map(s => s.paceMinPerKm), Infinity)

  return (
    <ChartCard
      title="Splits"
      subtitle={`Per-${unit === 'mi' ? 'mile' : 'kilometer'} breakdown. GAP is the grade-adjusted equivalent flat pace.`}
    >
      {splits.length === 0 ? (
        <ChartEmpty message="Not enough distance data to compute splits." />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-zinc-400 uppercase tracking-wide">
                <th className="text-left font-medium py-2 pr-4">{unit}</th>
                <th className="text-left font-medium py-2 pr-4 w-1/3">Pace</th>
                <th className="text-right font-medium py-2 pr-4">GAP</th>
                <th className="text-right font-medium py-2 pr-4">HR</th>
                <th className="text-right font-medium py-2 pr-4">Elev</th>
                <th className="text-right font-medium py-2">Time</th>
              </tr>
            </thead>
            <tbody>
              {splits.map(s => {
                const partial = s.distanceM < splitMeters * 0.98
                const barPct =
                  maxPace > minPace
                    ? 30 + ((maxPace - s.paceMinPerKm) / (maxPace - minPace)) * 70
                    : 100
                return (
                  <tr key={s.index} className="border-t border-zinc-100">
                    <td className="py-2 pr-4 text-zinc-500 tabular-nums">
                      {partial
                        ? (s.distanceM / splitMeters).toFixed(2)
                        : s.index}
                    </td>
                    <td className="py-2 pr-4">
                      <div className="flex items-center gap-2">
                        <span className="tabular-nums font-medium text-zinc-900 w-12">
                          {formatSplitPace(s.paceMinPerKm, unit)}
                        </span>
                        <div className="h-2 rounded-full bg-blue-500/80" style={{ width: `${barPct}%` }} />
                      </div>
                    </td>
                    <td className="py-2 pr-4 text-right tabular-nums text-zinc-500">
                      {s.gapMinPerKm != null ? formatSplitPace(s.gapMinPerKm, unit) : '—'}
                    </td>
                    <td className="py-2 pr-4 text-right tabular-nums text-zinc-500">
                      {s.avgHr != null ? s.avgHr : '—'}
                    </td>
                    <td className="py-2 pr-4 text-right tabular-nums text-zinc-500">
                      {s.elevGainM != null
                        ? unit === 'mi'
                          ? `${Math.round(s.elevGainM * FEET_PER_METER)} ft`
                          : `${s.elevGainM} m`
                        : '—'}
                    </td>
                    <td className="py-2 text-right tabular-nums text-zinc-500">
                      {formatDuration(Math.round(s.seconds))}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </ChartCard>
  )
}
