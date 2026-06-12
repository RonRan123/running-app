'use client'

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { format } from 'date-fns'
import { efficiencyFactor, type AnalysisActivity } from '@/lib/analysis'
import ChartCard, { ChartEmpty } from './ChartCard'

interface Point {
  ts: number
  name: string
  ef: number
  hr: number
}

export default function EfficiencyTrend({ activities }: { activities: AnalysisActivity[] }) {
  const points: Point[] = activities
    .map(a => {
      const ef = efficiencyFactor(a)
      return ef
        ? { ts: new Date(a.date).getTime(), name: a.name, ef, hr: a.avgHeartRate as number }
        : null
    })
    .filter((p): p is Point => p !== null)
    .sort((a, b) => a.ts - b.ts)

  return (
    <ChartCard
      title="Aerobic Efficiency"
      subtitle="Meters per minute, per heartbeat (efficiency factor). A rising line means the same cardiovascular effort is producing faster running."
    >
      {points.length < 3 ? (
        <ChartEmpty message="Need at least 3 runs with heart rate data in this date range to show a trend." />
      ) : (
        <ResponsiveContainer width="100%" height={256}>
          <LineChart data={points} margin={{ top: 8, right: 8, bottom: 4, left: -16 }}>
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
              dataKey="ef"
              tick={{ fontSize: 12, fill: '#a1a1aa' }}
              tickLine={false}
              axisLine={{ stroke: '#e4e4e7' }}
              domain={['auto', 'auto']}
              tickFormatter={v => v.toFixed(2)}
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
                      {p.ef.toFixed(2)} m/min per bpm · {p.hr} bpm
                    </p>
                  </div>
                )
              }}
            />
            <Line
              type="monotone"
              dataKey="ef"
              stroke="#3b82f6"
              strokeWidth={2}
              dot={{ r: 3, fill: '#3b82f6', strokeWidth: 0 }}
              activeDot={{ r: 4 }}
            />
          </LineChart>
        </ResponsiveContainer>
      )}
    </ChartCard>
  )
}
