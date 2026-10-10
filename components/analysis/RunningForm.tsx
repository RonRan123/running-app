'use client'

import { useMemo, useState } from 'react'
import {
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Scatter,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { format } from 'date-fns'
import { classifyEffort, type AnalysisActivity, type HrZones } from '@/lib/analysis'
import type { Unit } from '@/lib/units'
import ChartCard, { ChartEmpty } from './ChartCard'

const ROLLING_DAYS = 28
const DAY_MS = 86_400_000
const FT_PER_M = 3.28084

interface Point {
  ts: number
  name: string
  cadence: number
  step: number // m or ft, per unit
  cadenceAvg: number
  stepAvg: number
}

function withRollingAverages(raw: Omit<Point, 'cadenceAvg' | 'stepAvg'>[]): Point[] {
  return raw.map((p, i) => {
    const window = raw.slice(0, i + 1).filter(q => q.ts > p.ts - ROLLING_DAYS * DAY_MS)
    const mean = (f: (q: (typeof raw)[number]) => number) =>
      window.reduce((sum, q) => sum + f(q), 0) / window.length
    return { ...p, cadenceAvg: mean(q => q.cadence), stepAvg: mean(q => q.step) }
  })
}

function FormChart({
  points,
  value,
  avg,
  color,
  format: fmt,
  label,
}: {
  points: Point[]
  value: 'cadence' | 'step'
  avg: 'cadenceAvg' | 'stepAvg'
  color: string
  format: (v: number) => string
  label: string
}) {
  return (
    <div>
      <p className="text-xs font-medium text-zinc-700 mb-1">{label}</p>
      <ResponsiveContainer width="100%" height={220}>
        <ComposedChart data={points} margin={{ top: 8, right: 8, bottom: 4, left: -8 }}>
          <CartesianGrid stroke="#f4f4f5" />
          <XAxis
            dataKey="ts"
            type="number"
            domain={['dataMin', 'dataMax']}
            tickFormatter={ts => format(ts, 'MMM d')}
            tick={{ fontSize: 12, fill: '#a1a1aa' }}
            tickLine={false}
            axisLine={{ stroke: '#e4e4e7' }}
          />
          <YAxis
            domain={['auto', 'auto']}
            tickFormatter={fmt}
            tick={{ fontSize: 12, fill: '#a1a1aa' }}
            tickLine={false}
            axisLine={{ stroke: '#e4e4e7' }}
          />
          <Tooltip
            content={({ active, payload }) => {
              const p = payload?.[0]?.payload as Point | undefined
              if (!active || !p) return null
              return (
                <div className="bg-white border border-zinc-200 rounded-lg shadow-sm px-3 py-2 text-xs">
                  <p className="font-medium text-zinc-900">{p.name}</p>
                  <p className="text-zinc-500 mt-0.5">{format(p.ts, 'MMM d, yyyy')}</p>
                  <p className="text-zinc-700 mt-1">
                    {label}: {fmt(p[value])} · {ROLLING_DAYS}-day avg {fmt(p[avg])}
                  </p>
                </div>
              )
            }}
          />
          <Scatter dataKey={value} fill={color} fillOpacity={0.35} />
          <Line
            dataKey={avg}
            stroke={color}
            strokeWidth={2}
            dot={false}
            activeDot={false}
            type="monotone"
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}

export default function RunningForm({
  activities,
  zones,
  unit,
}: {
  activities: AnalysisActivity[]
  zones: HrZones
  unit: Unit
}) {
  const [easyOnly, setEasyOnly] = useState(true)

  const points = useMemo(() => {
    const raw = activities
      .filter(a => a.cadenceSpm && a.stepLengthM)
      .filter(a => !easyOnly || (a.avgHeartRate && classifyEffort(a.avgHeartRate, zones) === 'easy'))
      .map(a => ({
        ts: new Date(a.date).getTime(),
        name: a.name,
        cadence: a.cadenceSpm as number,
        step: (a.stepLengthM as number) * (unit === 'mi' ? FT_PER_M : 1),
      }))
      .sort((a, b) => a.ts - b.ts)
    return withRollingAverages(raw)
  }, [activities, easyOnly, zones, unit])

  const stepUnit = unit === 'mi' ? 'ft' : 'm'

  return (
    <ChartCard
      title="Running Form"
      subtitle={`Average cadence (steps per minute) and step length per run, with a ${ROLLING_DAYS}-day rolling average. Both rise with pace, so compare easy runs with easy runs.`}
    >
      <label className="flex items-center justify-end gap-2 -mt-2 mb-2 text-xs text-zinc-600">
        <input
          type="checkbox"
          checked={easyOnly}
          onChange={e => setEasyOnly(e.target.checked)}
          className="rounded border-zinc-300"
        />
        Easy runs only
      </label>
      {points.length < 3 ? (
        <ChartEmpty message="Need at least 3 runs with cadence data in this date range to show a trend." />
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <FormChart
            points={points}
            value="cadence"
            avg="cadenceAvg"
            color="#8b5cf6"
            format={v => `${Math.round(v)}`}
            label="Cadence (spm)"
          />
          <FormChart
            points={points}
            value="step"
            avg="stepAvg"
            color="#0ea5e9"
            format={v => v.toFixed(2)}
            label={`Step length (${stepUnit})`}
          />
        </div>
      )}
    </ChartCard>
  )
}
