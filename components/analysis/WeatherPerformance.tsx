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
import { efficiencyFactor, type AnalysisActivity } from '@/lib/analysis'
import type { Unit } from '@/lib/units'
import ChartCard, { ChartEmpty } from './ChartCard'

interface Point {
  ts: number
  name: string
  ef: number
  apparentC: number
  apparent: number // display units
  dewPointC: number
  hr: number
}

function toDisplayTemp(celsius: number, imperial: boolean): number {
  return imperial ? celsius * 1.8 + 32 : celsius
}

// Sequential single-hue ramp for dew point: sky-500 (dry) → sky-900 (muggy).
// Darker = more moisture in the air = less evaporative cooling available.
// Mapped over 0–24 °C dew point, clamped — ~24 °C is oppressive by any
// running standard, so the top of the ramp is a meaningful ceiling.
const DEW_MIN_C = 0
const DEW_MAX_C = 24

function dewColor(dewPointC: number) {
  const t = Math.min(1, Math.max(0, (dewPointC - DEW_MIN_C) / (DEW_MAX_C - DEW_MIN_C)))
  const from = [14, 165, 233] // #0ea5e9
  const to = [12, 74, 110] // #0c4a6e
  const [r, g, b] = from.map((f, i) => Math.round(f + (to[i] - f) * t))
  return `rgb(${r}, ${g}, ${b})`
}

export default function WeatherPerformance({
  activities,
  unit,
}: {
  activities: AnalysisActivity[]
  unit: Unit
}) {
  const imperial = unit === 'mi'
  const deg = imperial ? '°F' : '°C'

  const points: Point[] = activities
    .map(a => {
      if (
        a.weatherApparentTempC === null ||
        a.weatherApparentTempC === undefined ||
        a.weatherDewPointC === null ||
        a.weatherDewPointC === undefined
      ) {
        return null
      }
      const ef = efficiencyFactor(a)
      if (!ef) return null
      return {
        ts: new Date(a.date).getTime(),
        name: a.name,
        ef,
        apparentC: a.weatherApparentTempC,
        apparent: Math.round(toDisplayTemp(a.weatherApparentTempC, imperial) * 10) / 10,
        dewPointC: a.weatherDewPointC,
        hr: a.avgHeartRate as number,
      }
    })
    .filter((p): p is Point => p !== null)

  return (
    <ChartCard
      title="Performance vs. Weather"
      subtitle={`Aerobic efficiency vs. "feels like" temperature. Darker dots = muggier air (higher dew point). A downward drift to the right shows how much heat stress costs you.`}
    >
      {points.length < 3 ? (
        <ChartEmpty message="Need at least 3 runs with weather and heart rate data in this date range. Weather is fetched automatically for new and recent runs." />
      ) : (
        <ResponsiveContainer width="100%" height={280}>
          <ScatterChart margin={{ top: 8, right: 8, bottom: 4, left: -16 }}>
            <CartesianGrid stroke="#f4f4f5" />
            <XAxis
              type="number"
              dataKey="apparent"
              name="Feels like"
              unit={deg}
              tick={{ fontSize: 12, fill: '#a1a1aa' }}
              tickLine={false}
              axisLine={{ stroke: '#e4e4e7' }}
              domain={['auto', 'auto']}
            />
            <YAxis
              type="number"
              dataKey="ef"
              name="Efficiency"
              tick={{ fontSize: 12, fill: '#a1a1aa' }}
              tickLine={false}
              axisLine={{ stroke: '#e4e4e7' }}
              domain={['auto', 'auto']}
              tickFormatter={v => v.toFixed(2)}
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
                      Feels like {p.apparent}
                      {deg} · dew point{' '}
                      {Math.round(toDisplayTemp(p.dewPointC, imperial))}
                      {deg}
                    </p>
                    <p className="text-zinc-700">
                      {p.ef.toFixed(2)} m/min per bpm · {p.hr} bpm
                    </p>
                  </div>
                )
              }}
            />
            <Scatter data={points}>
              {points.map(p => (
                <Cell key={p.ts} fill={dewColor(p.dewPointC)} fillOpacity={0.85} />
              ))}
            </Scatter>
          </ScatterChart>
        </ResponsiveContainer>
      )}
    </ChartCard>
  )
}
