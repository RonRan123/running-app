'use client'

import { useMemo } from 'react'
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import ChartCard from '@/components/analysis/ChartCard'
import { KM_PER_MILE, type Unit } from '@/lib/units'
import {
  integrateDistance,
  normalizeCadence,
  smoothSeries,
  type RunStreams,
} from '@/lib/runAnalysis'

interface Point {
  d: number // distance in display unit
  spm: number | null // null while stopped, so the line breaks
}

export default function CadenceChart({ streams, unit }: { streams: RunStreams; unit: Unit }) {
  const points: Point[] = useMemo(() => {
    const distance = streams.distance ?? integrateDistance(streams)
    if (!streams.cadence || !distance) return []
    const spm = normalizeCadence(streams.cadence)
    const smooth = smoothSeries(streams.time, spm, 30)
    return streams.time.map((_, i) => ({
      d: unit === 'mi' ? distance[i] / 1000 / KM_PER_MILE : distance[i] / 1000,
      spm: spm[i] > 0 ? smooth[i] : null,
    }))
  }, [streams, unit])

  if (points.length < 2) return null

  return (
    <ChartCard title="Cadence" subtitle="Steps per minute (both feet), 30-second rolling average.">
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={points} margin={{ top: 8, right: 8, bottom: 4, left: -8 }}>
          <CartesianGrid stroke="#f4f4f5" />
          <XAxis
            dataKey="d"
            type="number"
            domain={['dataMin', 'dataMax']}
            tickFormatter={d => d.toFixed(1)}
            tick={{ fontSize: 12, fill: '#a1a1aa' }}
            tickLine={false}
            axisLine={{ stroke: '#e4e4e7' }}
            unit={` ${unit}`}
          />
          <YAxis
            domain={['auto', 'auto']}
            tickFormatter={(v: number) => Math.round(v).toString()}
            tick={{ fontSize: 12, fill: '#a1a1aa' }}
            tickLine={false}
            axisLine={{ stroke: '#e4e4e7' }}
            unit=" spm"
            width={72}
          />
          <Tooltip
            content={({ active, payload }) => {
              const p = payload?.[0]?.payload as Point | undefined
              if (!active || !p || p.spm === null) return null
              return (
                <div className="bg-white border border-zinc-200 rounded-lg shadow-sm px-3 py-2 text-xs">
                  <p className="text-zinc-500">
                    {p.d.toFixed(2)} {unit}
                  </p>
                  <p className="font-medium text-zinc-900 mt-0.5">{Math.round(p.spm)} spm</p>
                </div>
              )
            }}
          />
          <Line
            type="monotone"
            dataKey="spm"
            stroke="#8b5cf6"
            strokeWidth={1.5}
            dot={false}
            connectNulls={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </ChartCard>
  )
}
