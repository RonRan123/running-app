'use client'

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { format, parseISO } from 'date-fns'
import type { LoadPoint } from '@/lib/analysis'
import ChartCard, { ChartEmpty } from './ChartCard'

const SERIES: Record<string, string> = {
  ctl: 'Fitness (CTL)',
  atl: 'Fatigue (ATL)',
  tsb: 'Form (TSB)',
}

export default function FitnessFatigue({ load }: { load: LoadPoint[] }) {
  return (
    <ChartCard
      title="Fitness & Fatigue"
      subtitle="TRIMP-based training load over the last 6 months. Fitness builds slowly (42-day average), fatigue moves fast (7-day average); form = fitness − fatigue. Positive form = fresh, ready to race."
    >
      {load.length < 14 ? (
        <ChartEmpty message="Not enough training history yet — sync more runs to build the load curves." />
      ) : (
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={load} margin={{ top: 8, right: 8, bottom: 4, left: -16 }}>
            <CartesianGrid stroke="#f4f4f5" />
            <XAxis
              dataKey="date"
              tickFormatter={d => format(parseISO(d), 'MMM')}
              tick={{ fontSize: 12, fill: '#a1a1aa' }}
              tickLine={false}
              axisLine={{ stroke: '#e4e4e7' }}
              minTickGap={40}
            />
            <YAxis
              tick={{ fontSize: 12, fill: '#a1a1aa' }}
              tickLine={false}
              axisLine={{ stroke: '#e4e4e7' }}
              tickFormatter={v => v.toFixed(0)}
            />
            <Tooltip
              content={({ active, payload, label }) => {
                const p = payload?.[0]?.payload as LoadPoint | undefined
                if (!active || !p) return null
                return (
                  <div className="bg-white border border-zinc-200 rounded-lg shadow-sm px-3 py-2 text-xs">
                    <p className="font-medium text-zinc-900">
                      {format(parseISO(label as string), 'MMM d, yyyy')}
                    </p>
                    <p className="text-blue-600 mt-1">Fitness {p.ctl.toFixed(1)}</p>
                    <p className="text-orange-600">Fatigue {p.atl.toFixed(1)}</p>
                    <p className="text-emerald-600">Form {p.tsb.toFixed(1)}</p>
                  </div>
                )
              }}
            />
            <Legend formatter={value => SERIES[value] ?? value} wrapperStyle={{ fontSize: 12 }} />
            <ReferenceLine y={0} stroke="#e4e4e7" />
            <Line type="monotone" dataKey="ctl" stroke="#3b82f6" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="atl" stroke="#f97316" strokeWidth={1.5} dot={false} />
            <Line type="monotone" dataKey="tsb" stroke="#10b981" strokeWidth={1.5} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      )}
    </ChartCard>
  )
}
