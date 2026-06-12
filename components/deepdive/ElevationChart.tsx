'use client'

import { useMemo } from 'react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import ChartCard, { ChartEmpty } from '@/components/analysis/ChartCard'
import { KM_PER_MILE, type Unit } from '@/lib/units'
import { integrateDistance, smoothSeries, type RunStreams } from '@/lib/runAnalysis'

const FEET_PER_METER = 3.28084

interface Point {
  d: number // distance in display unit
  ele: number // elevation in display unit (ft or m)
}

export default function ElevationChart({ streams, unit }: { streams: RunStreams; unit: Unit }) {
  const points: Point[] = useMemo(() => {
    const distance = streams.distance ?? integrateDistance(streams)
    if (!streams.altitude || !distance) return []
    const smoothAlt = smoothSeries(streams.time, streams.altitude, 15)
    return streams.time.map((_, i) => ({
      d: unit === 'mi' ? distance[i] / 1000 / KM_PER_MILE : distance[i] / 1000,
      ele: unit === 'mi' ? smoothAlt[i] * FEET_PER_METER : smoothAlt[i],
    }))
  }, [streams, unit])

  const eleUnit = unit === 'mi' ? 'ft' : 'm'

  return (
    <ChartCard title="Elevation" subtitle="Course profile along the run.">
      {points.length < 2 ? (
        <ChartEmpty message="No elevation data recorded for this run." />
      ) : (
        <ResponsiveContainer width="100%" height={256}>
          <AreaChart data={points} margin={{ top: 8, right: 8, bottom: 4, left: -8 }}>
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
              unit={` ${eleUnit}`}
              width={64}
            />
            <Tooltip
              content={({ active, payload }) => {
                const p = payload?.[0]?.payload as Point | undefined
                if (!active || !p) return null
                return (
                  <div className="bg-white border border-zinc-200 rounded-lg shadow-sm px-3 py-2 text-xs">
                    <p className="text-zinc-500">
                      {p.d.toFixed(2)} {unit}
                    </p>
                    <p className="font-medium text-zinc-900 mt-0.5">
                      {Math.round(p.ele)} {eleUnit}
                    </p>
                  </div>
                )
              }}
            />
            <Area
              type="monotone"
              dataKey="ele"
              stroke="#a1a1aa"
              strokeWidth={1.5}
              fill="#e4e4e7"
              fillOpacity={0.6}
            />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </ChartCard>
  )
}
