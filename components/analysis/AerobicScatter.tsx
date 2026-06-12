'use client'

import {
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { format } from 'date-fns'
import type { AnalysisActivity } from '@/lib/analysis'
import { KM_PER_MILE, formatDistance, formatPace, type Unit } from '@/lib/units'
import ChartCard, { ChartEmpty } from './ChartCard'

interface Point {
  ts: number
  name: string
  distanceKm: number
  distance: number
  hr: number
  pace: number | null
}

// Oldest runs render blue, newest orange-red — the drift of the cloud shows
// whether HR at a given distance is falling (improving) or rising.
function ageColor(t: number) {
  const from = [59, 130, 246]
  const to = [239, 68, 68]
  const [r, g, b] = from.map((f, i) => Math.round(f + (to[i] - f) * t))
  return `rgb(${r}, ${g}, ${b})`
}

export default function AerobicScatter({
  activities,
  unit,
}: {
  activities: AnalysisActivity[]
  unit: Unit
}) {
  const points: Point[] = activities
    .filter(a => a.avgHeartRate)
    .map(a => ({
      ts: new Date(a.date).getTime(),
      name: a.name,
      distanceKm: a.distance,
      distance: unit === 'mi' ? a.distance / KM_PER_MILE : a.distance,
      hr: a.avgHeartRate as number,
      pace: a.avgPace,
    }))
    .sort((a, b) => a.ts - b.ts)

  const minTs = points[0]?.ts ?? 0
  const maxTs = points[points.length - 1]?.ts ?? 1
  const span = Math.max(1, maxTs - minTs)

  return (
    <ChartCard
      title="Aerobic Development"
      subtitle={`Distance vs. average HR per run — blue = oldest in range, red = newest. A cloud drifting down means more distance at less cardiovascular cost.`}
    >
      {points.length === 0 ? (
        <ChartEmpty message="No runs with heart rate data in this date range." />
      ) : (
        <ResponsiveContainer width="100%" height={280}>
          <ScatterChart margin={{ top: 8, right: 8, bottom: 4, left: -16 }}>
            <CartesianGrid stroke="#f4f4f5" />
            <XAxis
              type="number"
              dataKey="distance"
              name="Distance"
              unit={` ${unit}`}
              tick={{ fontSize: 12, fill: '#a1a1aa' }}
              tickLine={false}
              axisLine={{ stroke: '#e4e4e7' }}
              domain={['auto', 'auto']}
            />
            <YAxis
              type="number"
              dataKey="hr"
              name="Avg HR"
              tick={{ fontSize: 12, fill: '#a1a1aa' }}
              tickLine={false}
              axisLine={{ stroke: '#e4e4e7' }}
              domain={['dataMin - 5', 'dataMax + 5']}
            />
            <Tooltip
              cursor={{ strokeDasharray: '3 3', stroke: '#d4d4d8' }}
              content={({ active, payload }) => {
                const p = payload?.[0]?.payload as Point | undefined
                if (!active || !p) return null
                return (
                  <div className="bg-white border border-zinc-200 rounded-lg shadow-sm px-3 py-2 text-xs">
                    <p className="font-medium text-zinc-900">{p.name}</p>
                    <p className="text-zinc-500 mt-0.5">{format(p.ts, 'MMM d, yyyy')}</p>
                    <p className="text-zinc-700 mt-1">
                      {formatDistance(p.distanceKm, unit)} · {p.hr} bpm
                      {p.pace ? ` · ${formatPace(p.pace, unit)}` : ''}
                    </p>
                  </div>
                )
              }}
            />
            <Scatter data={points}>
              {points.map(p => (
                <Cell key={p.ts} fill={ageColor((p.ts - minTs) / span)} fillOpacity={0.85} />
              ))}
            </Scatter>
          </ScatterChart>
        </ResponsiveContainer>
      )}
    </ChartCard>
  )
}
