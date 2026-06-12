'use client'

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { format, parseISO } from 'date-fns'
import type { WeeklyZones } from '@/lib/analysis'
import ChartCard, { ChartEmpty } from './ChartCard'

const EASY_TARGET_PCT = 75

const SERIES: Record<string, string> = {
  easyPct: 'Easy',
  moderatePct: 'Moderate',
  hardPct: 'Hard',
}

export default function ZoneDistribution({ weekly }: { weekly: WeeklyZones[] }) {
  return (
    <ChartCard
      title="Effort Distribution"
      subtitle={`Share of weekly run time at easy / moderate / hard effort (runs classified by avg HR). Marathon training wants the easy share at or above ~${EASY_TARGET_PCT}%.`}
    >
      {weekly.length === 0 ? (
        <ChartEmpty message="No runs with heart rate data in this date range." />
      ) : (
        <ResponsiveContainer width="100%" height={256}>
          <BarChart data={weekly} margin={{ top: 8, right: 8, bottom: 4, left: -16 }}>
            <CartesianGrid stroke="#f4f4f5" vertical={false} />
            <XAxis
              dataKey="weekStart"
              tickFormatter={w => format(parseISO(w), 'MMM d')}
              tick={{ fontSize: 12, fill: '#a1a1aa' }}
              tickLine={false}
              axisLine={{ stroke: '#e4e4e7' }}
            />
            <YAxis
              domain={[0, 100]}
              tickFormatter={v => `${v}%`}
              tick={{ fontSize: 12, fill: '#a1a1aa' }}
              tickLine={false}
              axisLine={{ stroke: '#e4e4e7' }}
            />
            <Tooltip
              cursor={{ fill: '#fafafa' }}
              content={({ active, payload, label }) => {
                const p = payload?.[0]?.payload as WeeklyZones | undefined
                if (!active || !p) return null
                return (
                  <div className="bg-white border border-zinc-200 rounded-lg shadow-sm px-3 py-2 text-xs">
                    <p className="font-medium text-zinc-900">
                      Week of {format(parseISO(label as string), 'MMM d, yyyy')}
                    </p>
                    <p className="text-emerald-600 mt-1">Easy {p.easyPct.toFixed(0)}%</p>
                    <p className="text-amber-600">Moderate {p.moderatePct.toFixed(0)}%</p>
                    <p className="text-rose-600">Hard {p.hardPct.toFixed(0)}%</p>
                    {p.easyPct < EASY_TARGET_PCT && (
                      <p className="text-zinc-500 mt-1">Below the {EASY_TARGET_PCT}% easy target</p>
                    )}
                  </div>
                )
              }}
            />
            <Legend formatter={value => SERIES[value] ?? value} wrapperStyle={{ fontSize: 12 }} />
            <ReferenceLine
              y={EASY_TARGET_PCT}
              stroke="#10b981"
              strokeDasharray="4 4"
              label={{
                value: `${EASY_TARGET_PCT}% easy target`,
                position: 'insideTopRight',
                fontSize: 11,
                fill: '#10b981',
              }}
            />
            <Bar dataKey="easyPct" stackId="zones" fill="#34d399" />
            <Bar dataKey="moderatePct" stackId="zones" fill="#fbbf24" />
            <Bar dataKey="hardPct" stackId="zones" fill="#fb7185" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </ChartCard>
  )
}
