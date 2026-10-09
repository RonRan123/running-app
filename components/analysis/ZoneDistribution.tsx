'use client'

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { useState } from 'react'
import { format, parseISO } from 'date-fns'
import type { WeeklyZones } from '@/lib/analysis'
import ChartCard, { ChartEmpty } from './ChartCard'

const EASY_TARGET_PCT = 75

type View = 'time' | 'pct'

const SERIES: Record<string, string> = {
  easyHrs: 'Easy',
  moderateHrs: 'Moderate',
  hardHrs: 'Hard',
  easyPct: 'Easy',
  moderatePct: 'Moderate',
  hardPct: 'Hard',
}

function hm(sec: number) {
  const h = Math.floor(sec / 3600)
  const m = Math.round((sec % 3600) / 60)
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

export default function ZoneDistribution({ weekly }: { weekly: WeeklyZones[] }) {
  const [view, setView] = useState<View>('time')
  const data = weekly.map(w => ({
    ...w,
    easyHrs: w.easySec / 3600,
    moderateHrs: w.moderateSec / 3600,
    hardHrs: w.hardSec / 3600,
  }))
  const key = view === 'time' ? 'Hrs' : 'Pct'

  return (
    <ChartCard
      title="Effort Distribution"
      subtitle={`Weekly time at easy / moderate / hard effort, classified second-by-second from heart rate. Marathon training wants the easy share at or above ~${EASY_TARGET_PCT}%.`}
    >
      {weekly.length === 0 ? (
        <ChartEmpty message="No runs with heart rate data in this date range." />
      ) : (
        <>
          <div className="flex justify-end -mt-2 mb-2">
            <div className="inline-flex items-center rounded-lg border border-zinc-300 bg-white p-0.5">
              {(['time', 'pct'] as const).map(v => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  aria-pressed={view === v}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                    view === v ? 'bg-zinc-900 text-white' : 'text-zinc-500 hover:text-zinc-900'
                  }`}
                >
                  {v === 'time' ? 'Hours' : '%'}
                </button>
              ))}
            </div>
          </div>
          <ResponsiveContainer width="100%" height={256}>
            <BarChart data={data} margin={{ top: 8, right: 8, bottom: 4, left: -16 }}>
              <CartesianGrid stroke="#f4f4f5" vertical={false} />
              <XAxis
                dataKey="weekStart"
                tickFormatter={w => format(parseISO(w), 'MMM d')}
                tick={{ fontSize: 12, fill: '#a1a1aa' }}
                tickLine={false}
                axisLine={{ stroke: '#e4e4e7' }}
              />
              <YAxis
                domain={view === 'pct' ? [0, 100] : [0, 'auto']}
                tickFormatter={v => (view === 'pct' ? `${v}%` : `${v}h`)}
                allowDecimals={view === 'time'}
                tick={{ fontSize: 12, fill: '#a1a1aa' }}
                tickLine={false}
                axisLine={{ stroke: '#e4e4e7' }}
              />
              <Tooltip
                cursor={{ fill: '#fafafa' }}
                content={({ active, payload, label }) => {
                  const p = payload?.[0]?.payload as WeeklyZones | undefined
                  if (!active || !p) return null
                  return (
                    <div className="bg-white border border-zinc-200 rounded-lg shadow-sm px-3 py-2 text-xs">
                      <p className="font-medium text-zinc-900">
                        Week of {format(parseISO(label as string), 'MMM d, yyyy')}
                      </p>
                      <p className="text-emerald-600 mt-1">
                        Easy {hm(p.easySec)} · {p.easyPct.toFixed(0)}%
                      </p>
                      <p className="text-amber-600">
                        Moderate {hm(p.moderateSec)} · {p.moderatePct.toFixed(0)}%
                      </p>
                      <p className="text-rose-600">
                        Hard {hm(p.hardSec)} · {p.hardPct.toFixed(0)}%
                      </p>
                      {p.easyPct < EASY_TARGET_PCT && (
                        <p className="text-zinc-500 mt-1">Below the {EASY_TARGET_PCT}% easy target</p>
                      )}
                      {p.fallbackRuns > 0 && (
                        <p className="text-zinc-400 mt-1">
                          {p.fallbackRuns} {p.fallbackRuns === 1 ? 'run' : 'runs'} without an HR
                          stream, classified by average HR
                        </p>
                      )}
                    </div>
                  )
                }}
              />
              <Legend formatter={value => SERIES[value] ?? value} wrapperStyle={{ fontSize: 12 }} />
              {view === 'pct' && (
                <ReferenceLine
                  y={EASY_TARGET_PCT}
                  stroke="#10b981"
                  strokeDasharray="4 4"
                  label={{
                    value: `${EASY_TARGET_PCT}% easy target`,
                    position: 'insideTopRight',
                    fontSize: 11,
                    fill: '#10b981',
                  }}
                />
              )}
              <Bar dataKey={`easy${key}`} stackId="zones" fill="#34d399" />
              <Bar dataKey={`moderate${key}`} stackId="zones" fill="#fbbf24" />
              <Bar dataKey={`hard${key}`} stackId="zones" fill="#fb7185" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </>
      )}
    </ChartCard>
  )
}
