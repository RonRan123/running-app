'use client'

import { useMemo, useState } from 'react'
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from 'recharts'
import { format } from 'date-fns'
import ChartCard, { ChartEmpty } from '@/components/analysis/ChartCard'
import { KM_PER_MILE, formatDuration, type Unit } from '@/lib/units'
import type { SegmentEffortRow } from './SegmentsView'

// Same age gradient as the Wave 5 aerobic scatter: oldest = blue, newest = red.
// The visual drift of the bundle shows adaptation at a glance.
function ageColor(t: number) {
  const from = [59, 130, 246]
  const to = [239, 68, 68]
  const [r, g, b] = from.map((f, i) => Math.round(f + (to[i] - f) * t))
  return `rgb(${r}, ${g}, ${b})`
}

function formatPaceTick(pace: number) {
  const m = Math.floor(pace)
  const s = Math.round((pace - m) * 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

interface Trace {
  id: string
  label: string
  color: string
  hr: { t: number; v: number }[]
  pace: { t: number; v: number }[]
  gap: { t: number; v: number }[]
}

export default function EffortCharts({
  efforts,
  unit,
  selectedId,
  onSelect,
}: {
  efforts: SegmentEffortRow[] // sorted oldest → newest
  unit: Unit
  selectedId: string | null
  onSelect: (id: string) => void
}) {
  const [showGap, setShowGap] = useState(false)

  const traces: Trace[] = useMemo(() => {
    const n = efforts.length
    const toUnit = unit === 'mi' ? KM_PER_MILE : 1
    return efforts.map((e, i) => ({
      id: e.id,
      label: format(new Date(e.date), 'MMM d, yyyy'),
      color: ageColor(n > 1 ? i / (n - 1) : 1),
      hr: e.series.filter(p => p.hr !== null).map(p => ({ t: p.t, v: p.hr! })),
      pace: e.series.filter(p => p.pace !== null).map(p => ({ t: p.t, v: p.pace! * toUnit })),
      gap: e.series.filter(p => p.gap !== null).map(p => ({ t: p.t, v: p.gap! * toUnit })),
    }))
  }, [efforts, unit])

  const hasHr = traces.some(t => t.hr.length > 1)
  const hasPace = traces.some(t => t.pace.length > 1)
  const hasGap = traces.some(t => t.gap.length > 1)
  const paceKey = showGap && hasGap ? 'gap' : 'pace'

  const lineProps = (trace: Trace) => ({
    type: 'monotone' as const,
    dataKey: 'v',
    stroke: trace.color,
    strokeWidth: trace.id === selectedId ? 2.5 : 1.5,
    strokeOpacity: selectedId === null ? 0.75 : trace.id === selectedId ? 1 : 0.25,
    dot: false,
    onClick: () => onSelect(trace.id),
    className: 'cursor-pointer',
  })

  const legend = (
    <div className="flex items-center gap-2 text-xs text-zinc-400 mb-3">
      <span>oldest</span>
      <span
        className="h-1.5 w-24 rounded-full"
        style={{ background: `linear-gradient(to right, ${ageColor(0)}, ${ageColor(1)})` }}
      />
      <span>newest</span>
    </div>
  )

  const axes = (
    <>
      <CartesianGrid stroke="#f4f4f5" />
      <XAxis
        dataKey="t"
        type="number"
        domain={[0, 'dataMax']}
        tickFormatter={t => formatDuration(t)}
        tick={{ fontSize: 12, fill: '#a1a1aa' }}
        tickLine={false}
        axisLine={{ stroke: '#e4e4e7' }}
        allowDuplicatedCategory={false}
      />
    </>
  )

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <ChartCard
        title="Heart Rate"
        subtitle="Every effort aligned from the segment start. Newer traces sitting lower at the same point = aerobic improvement."
      >
        {!hasHr ? (
          <ChartEmpty message="No heart rate data on the matched runs." />
        ) : (
          <>
            {legend}
            <ResponsiveContainer width="100%" height={280}>
              <LineChart margin={{ top: 8, right: 8, bottom: 4, left: -8 }}>
                {axes}
                <YAxis
                  domain={['dataMin - 5', 'dataMax + 5']}
                  tick={{ fontSize: 12, fill: '#a1a1aa' }}
                  tickLine={false}
                  axisLine={{ stroke: '#e4e4e7' }}
                  unit=" bpm"
                  width={64}
                />
                {traces.map(trace => (
                  <Line key={trace.id} data={trace.hr} {...lineProps(trace)} />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </>
        )}
      </ChartCard>

      <ChartCard
        title="Pace"
        subtitle="Smoothed over 30 s and aligned from the segment start. GAP normalizes for grade."
      >
        {!hasPace ? (
          <ChartEmpty message="No pace data on the matched runs." />
        ) : (
          <>
            <div className="flex items-center justify-between flex-wrap gap-2">
              {legend}
              {hasGap ? (
                <div className="inline-flex items-center rounded-lg border border-zinc-300 bg-white p-0.5 mb-3">
                  {(['pace', 'gap'] as const).map(mode => (
                    <button
                      key={mode}
                      onClick={() => setShowGap(mode === 'gap')}
                      aria-pressed={paceKey === mode}
                      className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                        paceKey === mode
                          ? 'bg-zinc-900 text-white'
                          : 'text-zinc-500 hover:text-zinc-900'
                      }`}
                    >
                      {mode === 'pace' ? 'Pace' : 'GAP'}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart margin={{ top: 8, right: 8, bottom: 4, left: -8 }}>
                {axes}
                <YAxis
                  reversed
                  domain={['auto', 'auto']}
                  tickFormatter={formatPaceTick}
                  tick={{ fontSize: 12, fill: '#a1a1aa' }}
                  tickLine={false}
                  axisLine={{ stroke: '#e4e4e7' }}
                  unit={`/${unit}`}
                  width={72}
                />
                {traces.map(trace => (
                  <Line key={trace.id} data={trace[paceKey]} {...lineProps(trace)} />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </>
        )}
      </ChartCard>
    </div>
  )
}
