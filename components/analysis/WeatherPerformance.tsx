'use client'

import { useMemo } from 'react'
import {
  CartesianGrid,
  Cell,
  ReferenceLine,
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

const TREND_MIN_POINTS = 5

interface QuadraticFit {
  // `ef` matches the YAxis dataKey so the curve shares the scatter's scale.
  curve: { apparent: number; ef: number }[]
  // Apparent temp where fitted efficiency peaks — only set when the fit is
  // concave (heat hurts) and the peak falls inside the observed range.
  optimal: number | null
}

/**
 * Least-squares quadratic fit of efficiency vs. apparent temperature.
 * Quadratic (not linear) because heat-vs-performance is dome-shaped:
 * roughly flat around an optimal temperature, with an accelerating cost as
 * heat rises. x is mean-centered before solving for numerical stability.
 */
function fitQuadratic(points: { apparent: number; ef: number }[]): QuadraticFit | null {
  const n = points.length
  if (n < TREND_MIN_POINTS) return null

  const xs = points.map(p => p.apparent)
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  if (maxX - minX < 1e-6) return null

  const meanX = xs.reduce((s, x) => s + x, 0) / n
  let s1 = 0, s2 = 0, s3 = 0, s4 = 0, sy = 0, sxy = 0, sx2y = 0
  for (const p of points) {
    const x = p.apparent - meanX
    const x2 = x * x
    s1 += x
    s2 += x2
    s3 += x2 * x
    s4 += x2 * x2
    sy += p.ef
    sxy += x * p.ef
    sx2y += x2 * p.ef
  }

  // Solve the 3×3 normal equations [n s1 s2; s1 s2 s3; s2 s3 s4]·[a b c] = [sy sxy sx2y]
  // by Cramer's rule.
  const det =
    n * (s2 * s4 - s3 * s3) - s1 * (s1 * s4 - s3 * s2) + s2 * (s1 * s3 - s2 * s2)
  if (Math.abs(det) < 1e-9) return null
  const a =
    (sy * (s2 * s4 - s3 * s3) - s1 * (sxy * s4 - s3 * sx2y) + s2 * (sxy * s3 - s2 * sx2y)) / det
  const b =
    (n * (sxy * s4 - sx2y * s3) - sy * (s1 * s4 - s3 * s2) + s2 * (s1 * sx2y - sxy * s2)) / det
  const c =
    (n * (s2 * sx2y - s3 * sxy) - s1 * (s1 * sx2y - sxy * s2) + sy * (s1 * s3 - s2 * s2)) / det

  const SAMPLES = 50
  const curve = Array.from({ length: SAMPLES + 1 }, (_, i) => {
    const x = minX + ((maxX - minX) * i) / SAMPLES
    const xc = x - meanX
    return {
      apparent: Math.round(x * 10) / 10,
      ef: a + b * xc + c * xc * xc,
    }
  })

  let optimal: number | null = null
  if (c < 0) {
    const vertex = meanX - b / (2 * c)
    if (vertex > minX && vertex < maxX) optimal = Math.round(vertex)
  }

  return { curve, optimal }
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

  const fit = useMemo(() => fitQuadratic(points), [points])

  return (
    <ChartCard
      title="Performance vs. Weather"
      subtitle={`Aerobic efficiency vs. "feels like" temperature. Darker dots = muggier air (higher dew point). The gray curve is the quadratic best fit${
        fit?.optimal !== null && fit?.optimal !== undefined
          ? ` — it peaks near ${fit.optimal}°${imperial ? 'F' : 'C'}, your estimated optimal running temperature`
          : ''
      }.`}
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
                // Trend-curve samples have no run behind them — no tooltip.
                if (!active || !p?.name) return null
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
            {fit && (
              <Scatter
                data={fit.curve}
                line={{ stroke: '#71717a', strokeWidth: 2 }}
                shape={() => <g />}
                isAnimationActive={false}
              />
            )}
            {fit?.optimal !== null && fit?.optimal !== undefined && (
              <ReferenceLine
                x={fit.optimal}
                stroke="#10b981"
                strokeDasharray="4 4"
                label={{
                  value: `optimal ~${fit.optimal}°${imperial ? 'F' : 'C'}`,
                  position: 'insideTopLeft',
                  fontSize: 11,
                  fill: '#10b981',
                }}
              />
            )}
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
