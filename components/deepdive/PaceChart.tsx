'use client'

import { useMemo, useState } from 'react'
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import ChartCard, { ChartEmpty } from '@/components/analysis/ChartCard'
import { KM_PER_MILE, formatDuration, type Unit } from '@/lib/units'
import { gradeAdjustedVelocity, smoothSeries, type RunStreams } from '@/lib/runAnalysis'

interface Point {
  t: number
  pace: number | null // min per display unit
  gap: number | null
}

function velocityToPace(v: number, unit: Unit): number | null {
  if (v < 0.5) return null // standing still — pace is meaningless
  const minPerKm = 1000 / v / 60
  const pace = unit === 'mi' ? minPerKm * KM_PER_MILE : minPerKm
  return pace > 20 ? null : pace
}

function formatPaceTick(pace: number) {
  const m = Math.floor(pace)
  const s = Math.round((pace - m) * 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

export default function PaceChart({ streams, unit }: { streams: RunStreams; unit: Unit }) {
  const [showGap, setShowGap] = useState(false)

  const { points, hasGap } = useMemo(() => {
    if (!streams.velocity) return { points: [] as Point[], hasGap: false }
    const smoothVel = smoothSeries(streams.time, streams.velocity, 30)
    const gapVelRaw = gradeAdjustedVelocity(streams)
    const gapVel = gapVelRaw ? smoothSeries(streams.time, gapVelRaw, 30) : null
    const points = streams.time.map((t, i) => ({
      t,
      pace: velocityToPace(smoothVel[i], unit),
      gap: gapVel ? velocityToPace(gapVel[i], unit) : null,
    }))
    return { points, hasGap: gapVel !== null }
  }, [streams, unit])

  const active = showGap && hasGap ? 'gap' : 'pace'

  return (
    <ChartCard
      title="Pace"
      subtitle={
        hasGap
          ? 'Smoothed over 30 s. GAP estimates the equivalent flat-ground pace — faster than actual uphill, slower downhill.'
          : 'Smoothed over 30 s. No elevation data, so grade-adjusted pace is unavailable.'
      }
    >
      {points.length < 2 ? (
        <ChartEmpty message="No pace data recorded for this run." />
      ) : (
        <>
          {hasGap ? (
            <div className="inline-flex items-center rounded-lg border border-zinc-300 bg-white p-0.5 mb-3">
              {(['pace', 'gap'] as const).map(mode => (
                <button
                  key={mode}
                  onClick={() => setShowGap(mode === 'gap')}
                  aria-pressed={active === mode}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                    active === mode ? 'bg-zinc-900 text-white' : 'text-zinc-500 hover:text-zinc-900'
                  }`}
                >
                  {mode === 'pace' ? 'Pace' : 'GAP'}
                </button>
              ))}
            </div>
          ) : null}
          <ResponsiveContainer width="100%" height={256}>
            <LineChart data={points} margin={{ top: 8, right: 8, bottom: 4, left: -8 }}>
              <CartesianGrid stroke="#f4f4f5" />
              <XAxis
                dataKey="t"
                type="number"
                domain={['dataMin', 'dataMax']}
                tickFormatter={t => formatDuration(t)}
                tick={{ fontSize: 12, fill: '#a1a1aa' }}
                tickLine={false}
                axisLine={{ stroke: '#e4e4e7' }}
              />
              <YAxis
                reversed
                domain={['auto', 'auto']}
                tickFormatter={formatPaceTick}
                tick={{ fontSize: 12, fill: '#a1a1aa' }}
                tickLine={false}
                axisLine={{ stroke: '#e4e4e7' }}
                unit={`/${unit}`}
                width={72}
              />
              <Tooltip
                content={({ active: tooltipActive, payload }) => {
                  const p = payload?.[0]?.payload as Point | undefined
                  if (!tooltipActive || !p) return null
                  return (
                    <div className="bg-white border border-zinc-200 rounded-lg shadow-sm px-3 py-2 text-xs">
                      <p className="text-zinc-500">{formatDuration(p.t)} elapsed</p>
                      {p.pace != null ? (
                        <p className="text-zinc-900 font-medium mt-0.5">
                          {formatPaceTick(p.pace)} /{unit}
                        </p>
                      ) : null}
                      {p.gap != null ? (
                        <p className="text-zinc-500 mt-0.5">GAP {formatPaceTick(p.gap)} /{unit}</p>
                      ) : null}
                    </div>
                  )
                }}
              />
              <Line
                type="monotone"
                dataKey={active}
                stroke="#3b82f6"
                strokeWidth={1.5}
                dot={false}
                connectNulls
                activeDot={{ r: 3 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </>
      )}
    </ChartCard>
  )
}
