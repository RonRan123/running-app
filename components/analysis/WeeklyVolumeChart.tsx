'use client'

import { useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { format, parseISO } from 'date-fns'
import type { WeeklyVolume } from '@/lib/analysis'
import { KM_PER_MILE } from '@/lib/units'
import type { Unit } from '@/lib/units'
import { ChartEmpty } from './ChartCard'

type Metric = 'miles' | 'runs' | 'avg'

const METRIC_LABELS: Record<Metric, string> = {
  miles: 'Miles per week',
  runs: 'Runs per week',
  avg: 'Avg miles per run',
}

function toDisplayDistance(km: number, unit: Unit): number {
  return unit === 'mi' ? km / KM_PER_MILE : km
}

export default function WeeklyVolumeChart({
  weekly,
  unit,
}: {
  weekly: WeeklyVolume[]
  unit: Unit
}) {
  const [metric, setMetric] = useState<Metric>('miles')
  const unitLabel = unit === 'mi' ? 'mi' : 'km'

  const data = weekly.map(w => {
    const dist = parseFloat(toDisplayDistance(w.distanceKm, unit).toFixed(1))
    const avg = w.runCount > 0 ? parseFloat((dist / w.runCount).toFixed(1)) : 0
    return {
      weekStart: w.weekStart,
      miles: dist,
      runs: w.runCount,
      avg,
    }
  })

  const subtitles: Record<Metric, string> = {
    miles: `Total ${unitLabel} run each calendar week in the selected range.`,
    runs: 'Number of runs completed each calendar week in the selected range.',
    avg: `Average ${unitLabel} per run each calendar week in the selected range.`,
  }

  const yTickFormatter = (v: number) => {
    if (metric === 'runs') return String(v)
    return `${v}`
  }

  const barColor = '#38bdf8'

  return (
    <div className="bg-white rounded-2xl border border-zinc-200 p-5">
      <div className="flex items-start justify-between gap-3 mb-1">
        <h2 className="text-sm font-semibold text-zinc-900">Weekly Volume</h2>
        <select
          value={metric}
          onChange={e => setMetric(e.target.value as Metric)}
          className="text-xs rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-zinc-700 focus:outline-none focus:ring-2 focus:ring-zinc-300"
        >
          {(Object.entries(METRIC_LABELS) as [Metric, string][]).map(([key, label]) => (
            <option key={key} value={key}>{label}</option>
          ))}
        </select>
      </div>
      <p className="text-xs text-zinc-500 mb-4">{subtitles[metric]}</p>

      {weekly.length === 0 ? (
        <ChartEmpty message="No runs in this date range." />
      ) : (
        <ResponsiveContainer width="100%" height={256}>
          <BarChart data={data} margin={{ top: 8, right: 8, bottom: 4, left: -8 }}>
            <CartesianGrid stroke="#f4f4f5" vertical={false} />
            <XAxis
              dataKey="weekStart"
              tickFormatter={w => format(parseISO(w), 'MMM d')}
              tick={{ fontSize: 12, fill: '#a1a1aa' }}
              tickLine={false}
              axisLine={{ stroke: '#e4e4e7' }}
            />
            <YAxis
              tickFormatter={yTickFormatter}
              tick={{ fontSize: 12, fill: '#a1a1aa' }}
              tickLine={false}
              axisLine={{ stroke: '#e4e4e7' }}
            />
            <Tooltip
              cursor={{ fill: '#fafafa' }}
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null
                const val = payload[0]?.value as number | undefined
                return (
                  <div className="bg-white border border-zinc-200 rounded-lg shadow-sm px-3 py-2 text-xs">
                    <p className="font-medium text-zinc-900">
                      Week of {format(parseISO(label as string), 'MMM d, yyyy')}
                    </p>
                    <p className="text-zinc-700 mt-1">
                      {metric === 'runs'
                        ? `${val} ${val === 1 ? 'run' : 'runs'}`
                        : `${val} ${unitLabel}`}
                    </p>
                  </div>
                )
              }}
            />
            <Bar dataKey={metric} fill={barColor} radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}
