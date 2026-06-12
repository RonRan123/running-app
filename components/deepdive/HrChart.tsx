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
import { pctAtOrBelowMaf, smoothSeries, type RunStreams } from '@/lib/runAnalysis'

interface Point {
  t: number // seconds elapsed
  hr: number
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
  const points: Point[] = useMemo(() => {
    if (!streams.heartrate) return []
    const smooth = smoothSeries(streams.time, streams.heartrate, 10)
    return streams.time
      .map((t, i) => ({ t, hr: Math.round(smooth[i]) }))
      .filter(p => p.hr > 0)
  }, [streams])

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

  return (
    <ChartCard title="Heart Rate" subtitle={subtitle}>
      {points.length < 2 ? (
        <ChartEmpty message="No heart rate data recorded for this run." />
      ) : (
        <ResponsiveContainer width="100%" height={280}>
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
                    <p className="text-zinc-500">{formatDuration(p.t)} elapsed</p>
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
    </ChartCard>
  )
}
