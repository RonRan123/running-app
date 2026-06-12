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
import { isZone2, type AnalysisActivity } from '@/lib/analysis'
import { KM_PER_MILE, formatPace, type Unit } from '@/lib/units'
import ChartCard, { ChartEmpty } from './ChartCard'

interface Point {
  ts: number
  name: string
  paceKm: number // min/km
  pace: number // min per display unit
  hr: number
}

export default function Zone2PaceTrend({
  activities,
  maxHr,
  unit,
}: {
  activities: AnalysisActivity[]
  maxHr: number
  unit: Unit
}) {
  const points: Point[] = activities
    .filter(a => a.avgPace && a.avgHeartRate && isZone2(a.avgHeartRate, maxHr))
    .map(a => ({
      ts: new Date(a.date).getTime(),
      name: a.name,
      paceKm: a.avgPace as number,
      pace: unit === 'mi' ? (a.avgPace as number) * KM_PER_MILE : (a.avgPace as number),
      hr: a.avgHeartRate as number,
    }))
    .sort((a, b) => a.ts - b.ts)

  function formatTick(pace: number) {
    const m = Math.floor(pace)
    const s = Math.round((pace - m) * 60)
    return `${m}:${String(s).padStart(2, '0')}`
  }

  return (
    <ChartCard
      title="Aerobic Pace"
      subtitle="Average pace of easy (Zone 2) runs in the selected range. The axis is flipped so an upward trend = faster easy pace — the number that predicts marathon potential."
    >
      {points.length < 3 ? (
        <ChartEmpty message="Need at least 3 easy (Zone 2) runs with pace and HR data in this date range." />
      ) : (
        <ResponsiveContainer width="100%" height={256}>
          <LineChart data={points} margin={{ top: 8, right: 8, bottom: 4, left: -8 }}>
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
              dataKey="pace"
              reversed
              domain={['auto', 'auto']}
              tickFormatter={formatTick}
              tick={{ fontSize: 12, fill: '#a1a1aa' }}
              tickLine={false}
              axisLine={{ stroke: '#e4e4e7' }}
              unit={`/${unit}`}
              width={72}
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
                      {formatPace(p.paceKm, unit)} · {p.hr} bpm
                    </p>
                  </div>
                )
              }}
            />
            <Line
              type="monotone"
              dataKey="pace"
              stroke="#8b5cf6"
              strokeWidth={2}
              dot={{ r: 3, fill: '#8b5cf6', strokeWidth: 0 }}
              activeDot={{ r: 4 }}
            />
          </LineChart>
        </ResponsiveContainer>
      )}
    </ChartCard>
  )
}
