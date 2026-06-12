'use client'

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
import type { WeeklyLongRun } from '@/lib/analysis'
import { KM_PER_MILE, formatDistance, type Unit } from '@/lib/units'
import ChartCard, { ChartEmpty } from './ChartCard'

export default function LongRunProgression({
  weeks,
  unit,
}: {
  weeks: WeeklyLongRun[]
  unit: Unit
}) {
  const data = weeks.map(w => ({
    ...w,
    display: unit === 'mi' ? w.distance / KM_PER_MILE : w.distance,
  }))
  const hasRuns = weeks.some(w => w.distance > 0)

  return (
    <ChartCard
      title="Long Run Progression"
      subtitle="Longest single run of each week, last 16 weeks — the marathon-block view. Look for steady growth, not spikes."
    >
      {!hasRuns ? (
        <ChartEmpty message="No runs in the last 16 weeks." />
      ) : (
        <ResponsiveContainer width="100%" height={256}>
          <BarChart data={data} margin={{ top: 8, right: 8, bottom: 4, left: -16 }}>
            <CartesianGrid stroke="#f4f4f5" vertical={false} />
            <XAxis
              dataKey="weekStart"
              tickFormatter={w => format(parseISO(w), 'MMM d')}
              tick={{ fontSize: 12, fill: '#a1a1aa' }}
              tickLine={false}
              axisLine={{ stroke: '#e4e4e7' }}
              minTickGap={24}
            />
            <YAxis
              tick={{ fontSize: 12, fill: '#a1a1aa' }}
              tickLine={false}
              axisLine={{ stroke: '#e4e4e7' }}
              tickFormatter={v => `${v.toFixed(0)}`}
              unit={` ${unit}`}
              width={64}
            />
            <Tooltip
              cursor={{ fill: '#fafafa' }}
              content={({ active, payload, label }) => {
                const p = payload?.[0]?.payload as (typeof data)[number] | undefined
                if (!active || !p) return null
                return (
                  <div className="bg-white border border-zinc-200 rounded-lg shadow-sm px-3 py-2 text-xs">
                    <p className="font-medium text-zinc-900">
                      Week of {format(parseISO(label as string), 'MMM d, yyyy')}
                    </p>
                    <p className="text-zinc-700 mt-1">
                      {p.distance > 0
                        ? `Longest run: ${formatDistance(p.distance, unit)}`
                        : 'No runs'}
                    </p>
                  </div>
                )
              }}
            />
            <Bar dataKey="display" fill="#818cf8" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </ChartCard>
  )
}
