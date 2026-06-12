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
import { format } from 'date-fns'
import ChartCard, { ChartEmpty } from '@/components/analysis/ChartCard'
import { formatDuration } from '@/lib/units'
import type { DistanceRecord } from '@/lib/records'

interface Point {
  ts: number
  seconds: number
  runningBest: number
  name: string
}

export default function PrProgression({ records }: { records: DistanceRecord[] }) {
  const [selected, setSelected] = useState(
    records.find(r => r.target.label === '5K')?.target.label ?? records[0]?.target.label ?? '',
  )

  const record = records.find(r => r.target.label === selected)

  const points: Point[] = useMemo(() => {
    if (!record) return []
    let best = Infinity
    return record.history.map(e => {
      best = Math.min(best, e.seconds)
      return {
        ts: new Date(e.date).getTime(),
        seconds: Math.round(e.seconds),
        runningBest: Math.round(best),
        name: e.name,
      }
    })
  }, [record])

  return (
    <ChartCard
      title="PR Progression"
      subtitle="Your best effort at this distance in every qualifying run — the stepped line is the record as it stood."
    >
      <div className="inline-flex items-center rounded-lg border border-zinc-300 bg-white p-0.5 mb-3 flex-wrap">
        {records.map(r => (
          <button
            key={r.target.label}
            onClick={() => setSelected(r.target.label)}
            aria-pressed={selected === r.target.label}
            className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
              selected === r.target.label
                ? 'bg-zinc-900 text-white'
                : 'text-zinc-500 hover:text-zinc-900'
            }`}
          >
            {r.target.label}
          </button>
        ))}
      </div>
      {points.length < 2 ? (
        <ChartEmpty message="Need at least 2 qualifying runs at this distance to chart progression." />
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
              reversed
              domain={['auto', 'auto']}
              tickFormatter={(s: number) => formatDuration(s)}
              tick={{ fontSize: 12, fill: '#a1a1aa' }}
              tickLine={false}
              axisLine={{ stroke: '#e4e4e7' }}
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
                      {formatDuration(p.seconds)} (record: {formatDuration(p.runningBest)})
                    </p>
                  </div>
                )
              }}
            />
            <Line
              type="monotone"
              dataKey="seconds"
              stroke="#d4d4d8"
              strokeWidth={1.5}
              dot={{ r: 3, fill: '#d4d4d8', strokeWidth: 0 }}
            />
            <Line
              type="stepAfter"
              dataKey="runningBest"
              stroke="#f59e0b"
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      )}
    </ChartCard>
  )
}
