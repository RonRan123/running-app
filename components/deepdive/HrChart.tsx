'use client'

import { useMemo } from 'react'
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import ChartCard, { ChartEmpty } from '@/components/analysis/ChartCard'
import { formatDuration } from '@/lib/units'
import {
  gaitSegments,
  gaitSummary,
  pctAtOrBelowMaf,
  smoothSeries,
  type Gait,
  type RunStreams,
} from '@/lib/runAnalysis'

const WALK_FILL = '#38bdf8'

interface Point {
  t: number // seconds elapsed
  hr: number
  gait: Gait | null
}

export default function HrChart({
  streams,
  maf,
  maxHr,
}: {
  streams: RunStreams
  maf: number | null
  maxHr: number
}) {
  const segments = useMemo(() => gaitSegments(streams), [streams])

  const points: Point[] = useMemo(() => {
    if (!streams.heartrate) return []
    const smooth = smoothSeries(streams.time, streams.heartrate, 10)
    let s = 0
    return streams.time
      .map((t, i) => {
        while (s < segments.length - 1 && t > segments[s].end) s++
        return { t, hr: Math.round(smooth[i]), gait: segments[s]?.gait ?? null }
      })
      .filter(p => p.hr > 0)
  }, [streams, segments])

  // Walking stretches, clamped to the plotted range so recharts doesn't drop them.
  const walkAreas = useMemo(() => {
    if (points.length < 2) return []
    const lo = points[0].t
    const hi = points[points.length - 1].t
    return segments
      .filter(s => s.gait === 'walk')
      .map(s => ({ x1: Math.max(lo, s.start), x2: Math.min(hi, s.end) }))
      .filter(a => a.x2 > a.x1)
  }, [segments, points])

  const gait = useMemo(
    () => (walkAreas.length ? gaitSummary(streams.time, streams.heartrate, segments) : null),
    [walkAreas, streams, segments],
  )

  const mafPct = useMemo(
    () =>
      maf != null && streams.heartrate
        ? pctAtOrBelowMaf(streams.time, streams.heartrate, maf)
        : null,
    [streams, maf],
  )

  const subtitle =
    maf != null
      ? `Green band = your MAF aerobic zone (${maf - 10}–${maf} bpm). ${
          mafPct != null ? `${Math.round(mafPct)}% of this run was at or below MAF.` : ''
        }`
      : 'Set your age above to draw the Maffetone (180 − age) target band.'

  const subtitleWithGait = walkAreas.length
    ? `${subtitle} Blue shading = walking or stopped.`
    : subtitle

  const totalGaitSec = gait ? gait.run.seconds + gait.walk.seconds : 0

  return (
    <ChartCard title="Heart Rate" subtitle={subtitleWithGait}>
      {points.length < 2 ? (
        <ChartEmpty message="No heart rate data recorded for this run." />
      ) : (
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={points} margin={{ top: 8, right: 8, bottom: 4, left: -8 }}>
            <CartesianGrid stroke="#f4f4f5" />
            {walkAreas.map(a => (
              <ReferenceArea
                key={a.x1}
                x1={a.x1}
                x2={a.x2}
                fill={WALK_FILL}
                fillOpacity={0.14}
                strokeOpacity={0}
              />
            ))}
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
              domain={[
                (dataMin: number) => Math.min(dataMin - 5, maf != null ? maf - 20 : dataMin - 5),
                (dataMax: number) => Math.max(dataMax + 5, maf != null ? maf + 10 : dataMax + 5),
              ]}
              tick={{ fontSize: 12, fill: '#a1a1aa' }}
              tickLine={false}
              axisLine={{ stroke: '#e4e4e7' }}
              unit=" bpm"
              width={64}
            />
            {maf != null ? (
              <>
                <ReferenceArea y1={maf - 10} y2={maf} fill="#22c55e" fillOpacity={0.12} />
                <ReferenceLine
                  y={maf}
                  stroke="#16a34a"
                  strokeDasharray="4 4"
                  label={{
                    value: `MAF ${maf}`,
                    position: 'insideTopRight',
                    fill: '#16a34a',
                    fontSize: 11,
                  }}
                />
              </>
            ) : null}
            <Tooltip
              content={({ active, payload }) => {
                const p = payload?.[0]?.payload as Point | undefined
                if (!active || !p) return null
                return (
                  <div className="bg-white border border-zinc-200 rounded-lg shadow-sm px-3 py-2 text-xs">
                    <p className="text-zinc-500">
                      {formatDuration(p.t)} elapsed
                      {walkAreas.length && p.gait ? ` · ${p.gait === 'walk' ? 'walking' : 'running'}` : ''}
                    </p>
                    <p className="font-medium text-zinc-900 mt-0.5">
                      {p.hr} bpm
                      {maf != null ? (
                        <span className={p.hr <= maf ? 'text-green-600' : 'text-amber-600'}>
                          {' '}
                          · {p.hr <= maf ? 'aerobic' : `${p.hr - maf} over MAF`}
                        </span>
                      ) : (
                        <span className="text-zinc-500"> · {Math.round((p.hr / maxHr) * 100)}% max</span>
                      )}
                    </p>
                  </div>
                )
              }}
            />
            <Line
              type="monotone"
              dataKey="hr"
              stroke="#ef4444"
              strokeWidth={1.5}
              dot={false}
              activeDot={{ r: 3 }}
            />
          </LineChart>
        </ResponsiveContainer>
      )}
      {gait && points.length >= 2 ? (
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1 mt-3 text-xs text-zinc-500">
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 rounded-sm border border-zinc-200 bg-white" />
            Running {formatDuration(Math.round(gait.run.seconds))} (
            {Math.round((gait.run.seconds / totalGaitSec) * 100)}%)
            {gait.run.avgHr != null ? ` · avg ${gait.run.avgHr} bpm` : ''}
          </span>
          <span className="flex items-center gap-1.5">
            <span
              className="inline-block w-3 h-3 rounded-sm"
              style={{ backgroundColor: WALK_FILL, opacity: 0.25 }}
            />
            Walking {formatDuration(Math.round(gait.walk.seconds))} (
            {Math.round((gait.walk.seconds / totalGaitSec) * 100)}%)
            {gait.walk.avgHr != null ? ` · avg ${gait.walk.avgHr} bpm` : ''}
          </span>
        </div>
      ) : null}
    </ChartCard>
  )
}
