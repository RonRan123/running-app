'use client'

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { format, parseISO } from 'date-fns'
import type { WeeklyVolume } from '@/lib/analysis'
import { KM_PER_MILE } from '@/lib/units'
import type { Unit } from '@/lib/units'
import ChartCard, { ChartEmpty } from './ChartCard'

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
  const unitLabel = unit === 'mi' ? 'mi' : 'km'

  const data = weekly.map(w => ({
    weekStart: w.weekStart,
    miles: parseFloat(toDisplayDistance(w.distanceKm, unit).toFixed(1)),
    runs: w.runCount,
  }))

  return (
    <ChartCard
      title="Weekly Volume"
      subtitle={`Total ${unitLabel} and number of runs completed each week in the selected range.`}
    >
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
              tick={{ fontSize: 12, fill: '#a1a1aa' }}
              tickLine={false}
              axisLine={{ stroke: '#e4e4e7' }}
            />
            <Tooltip
              cursor={{ fill: '#fafafa' }}
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null
                const milesEntry = payload.find(p => p.dataKey === 'miles')
                const runsEntry = payload.find(p => p.dataKey === 'runs')
                return (
                  <div className="bg-white border border-zinc-200 rounded-lg shadow-sm px-3 py-2 text-xs">
                    <p className="font-medium text-zinc-900">
                      Week of {format(parseISO(label as string), 'MMM d, yyyy')}
                    </p>
                    <p className="text-zinc-700 mt-1">
                      {milesEntry?.value} {unitLabel}
                    </p>
                    <p className="text-zinc-500">
                      {runsEntry?.value} {Number(runsEntry?.value) === 1 ? 'run' : 'runs'}
                    </p>
                  </div>
                )
              }}
            />
            <Legend
              formatter={value => (value === 'miles' ? unitLabel : 'runs')}
              wrapperStyle={{ fontSize: 12 }}
            />
            <Bar dataKey="miles" stackId="vol" fill="#18181b" name="miles" />
            <Bar dataKey="runs" stackId="vol" fill="#a1a1aa" name="runs" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </ChartCard>
  )
}
