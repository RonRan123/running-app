'use client'

import { useMemo, useState } from 'react'
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Scatter,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { format } from 'date-fns'
import type { AnalysisActivity } from '@/lib/analysis'
import ChartCard, { ChartEmpty } from './ChartCard'

const ROLLING_DAYS = 28
const DAY_MS = 86_400_000

const COLORS = { running: '#6366f1', walking: '#fb923c', stopped: '#a1a1aa' }

type View = 'pct' | 'time'

interface Point {
  ts: number
  name: string
  runningSec: number
  walkingSec: number
  stoppedSec: number
  runningPct: number
  walkingPct: number
  stoppedPct: number
  runningMin: number
  walkingMin: number
  stoppedMin: number
  longestRunMin: number
  breaks: number
  runningPctAvg: number // time-weighted over the rolling window
  longestRunAvg: number
}

function hm(sec: number) {
  const h = Math.floor(sec / 3600)
  const m = Math.round((sec % 3600) / 60)
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

const axisProps = {
  tick: { fontSize: 12, fill: '#a1a1aa' },
  tickLine: false,
  axisLine: { stroke: '#e4e4e7' },
} as const

function SplitTooltip({ p }: { p: Point }) {
  return (
    <div className="bg-white border border-zinc-200 rounded-lg shadow-sm px-3 py-2 text-xs">
      <p className="font-medium text-zinc-900">{p.name}</p>
      <p className="text-zinc-500 mt-0.5">{format(p.ts, 'MMM d, yyyy')}</p>
      <p className="text-indigo-600 mt-1">
        Running {hm(p.runningSec)} · {p.runningPct.toFixed(0)}%
      </p>
      <p className="text-orange-500">
        Walking {hm(p.walkingSec)} · {p.walkingPct.toFixed(0)}%
      </p>
      <p className="text-zinc-500">
        Stopped {hm(p.stoppedSec)} · {p.stoppedPct.toFixed(0)}%
      </p>
      <p className="text-zinc-700 mt-1">
        Longest continuous run {hm(p.longestRunMin * 60)} · {p.breaks}{' '}
        {p.breaks === 1 ? 'break' : 'breaks'}
      </p>
      <p className="text-zinc-400 mt-1">
        {ROLLING_DAYS}-day running share {p.runningPctAvg.toFixed(0)}%
      </p>
    </div>
  )
}

export default function RunWalkSplit({ activities }: { activities: AnalysisActivity[] }) {
  const [view, setView] = useState<View>('pct')

  const points = useMemo(() => {
    const raw = activities
      .filter(a => a.movement)
      .map(a => {
        const m = a.movement!
        const total = m.runningSec + m.walkingSec + m.stoppedSec
        return {
          ts: new Date(a.date).getTime(),
          name: a.name,
          runningSec: m.runningSec,
          walkingSec: m.walkingSec,
          stoppedSec: m.stoppedSec,
          runningPct: (m.runningSec / total) * 100,
          walkingPct: (m.walkingSec / total) * 100,
          stoppedPct: (m.stoppedSec / total) * 100,
          runningMin: m.runningSec / 60,
          walkingMin: m.walkingSec / 60,
          stoppedMin: m.stoppedSec / 60,
          longestRunMin: m.longestRunSec / 60,
          breaks: m.breaks,
        }
      })
      .sort((a, b) => a.ts - b.ts)
    return raw.map((p, i): Point => {
      const window = raw.slice(0, i + 1).filter(q => q.ts > p.ts - ROLLING_DAYS * DAY_MS)
      const sum = (f: (q: (typeof raw)[number]) => number) => window.reduce((s, q) => s + f(q), 0)
      const elapsed = sum(q => q.runningSec + q.walkingSec + q.stoppedSec)
      return {
        ...p,
        runningPctAvg: (sum(q => q.runningSec) / elapsed) * 100,
        longestRunAvg: sum(q => q.longestRunMin) / window.length,
      }
    })
  }, [activities])

  const totals = useMemo(() => {
    const run = points.reduce((s, p) => s + p.runningSec, 0)
    const walk = points.reduce((s, p) => s + p.walkingSec, 0)
    const stop = points.reduce((s, p) => s + p.stoppedSec, 0)
    return { run, walk, stop, pct: (run / (run + walk + stop || 1)) * 100 }
  }, [points])

  const suffix = view === 'pct' ? 'Pct' : 'Min'

  return (
    <ChartCard
      title="Run / Walk Split"
      help="run-walk-split"
      subtitle={`Each run's full elapsed time classified second-by-second from cadence and speed as running, walking or stopped. Stops like traffic lights stay in. The line is the ${ROLLING_DAYS}-day running share.`}
    >
      {points.length === 0 ? (
        <ChartEmpty message="No runs with cadence or speed data in this date range." />
      ) : (
        <>
          <div className="flex items-start justify-between flex-wrap gap-3 -mt-2 mb-4">
            <dl className="flex flex-wrap gap-x-6 gap-y-2 text-xs">
              <div>
                <dt className="text-zinc-500">Running share</dt>
                <dd className="text-lg font-semibold text-zinc-900">{totals.pct.toFixed(0)}%</dd>
              </div>
              <div>
                <dt className="text-zinc-500">Running</dt>
                <dd className="text-lg font-semibold text-indigo-600">{hm(totals.run)}</dd>
              </div>
              <div>
                <dt className="text-zinc-500">Walking</dt>
                <dd className="text-lg font-semibold text-orange-500">{hm(totals.walk)}</dd>
              </div>
              <div>
                <dt className="text-zinc-500">Stopped</dt>
                <dd className="text-lg font-semibold text-zinc-500">{hm(totals.stop)}</dd>
              </div>
              <div>
                <dt className="text-zinc-500">Run : walk</dt>
                <dd className="text-lg font-semibold text-zinc-900">
                  {totals.walk > 0 ? `${(totals.run / totals.walk).toFixed(1)} : 1` : '—'}
                </dd>
              </div>
            </dl>
            <div className="inline-flex items-center rounded-lg border border-zinc-300 bg-white p-0.5">
              {(['pct', 'time'] as const).map(v => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  aria-pressed={view === v}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                    view === v ? 'bg-zinc-900 text-white' : 'text-zinc-500 hover:text-zinc-900'
                  }`}
                >
                  {v === 'pct' ? '%' : 'Minutes'}
                </button>
              ))}
            </div>
          </div>
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <p className="text-xs font-medium text-zinc-700 mb-1">Time split per run</p>
              <ResponsiveContainer width="100%" height={240}>
                <ComposedChart data={points} margin={{ top: 8, right: 8, bottom: 4, left: -8 }}>
                  <CartesianGrid stroke="#f4f4f5" vertical={false} />
                  <XAxis dataKey="ts" tickFormatter={ts => format(ts, 'MMM d')} {...axisProps} />
                  <YAxis
                    domain={view === 'pct' ? [0, 100] : [0, 'auto']}
                    // Shares can sum to 100.00001 in floating point.
                    allowDataOverflow={view === 'pct'}
                    ticks={view === 'pct' ? [0, 25, 50, 75, 100] : undefined}
                    tickFormatter={v => (view === 'pct' ? `${v}%` : `${Math.round(v)}m`)}
                    {...axisProps}
                  />
                  <Tooltip
                    cursor={{ fill: '#fafafa' }}
                    content={({ active, payload }) => {
                      const p = payload?.[0]?.payload as Point | undefined
                      return active && p ? <SplitTooltip p={p} /> : null
                    }}
                  />
                  <Legend itemSorter={null} wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey={`running${suffix}`} name="Running" stackId="split" fill={COLORS.running} />
                  <Bar dataKey={`walking${suffix}`} name="Walking" stackId="split" fill={COLORS.walking} />
                  <Bar
                    dataKey={`stopped${suffix}`}
                    name="Stopped"
                    stackId="split"
                    fill={COLORS.stopped}
                    radius={[3, 3, 0, 0]}
                  />
                  {view === 'pct' && (
                    <Line
                      dataKey="runningPctAvg"
                      name={`${ROLLING_DAYS}-day running share`}
                      stroke="#18181b"
                      strokeWidth={2}
                      dot={false}
                      activeDot={false}
                      type="monotone"
                    />
                  )}
                </ComposedChart>
              </ResponsiveContainer>
            </div>
            <div>
              <p className="text-xs font-medium text-zinc-700 mb-1">
                Longest continuous run (min)
              </p>
              <ResponsiveContainer width="100%" height={240}>
                <ComposedChart data={points} margin={{ top: 8, right: 8, bottom: 4, left: -8 }}>
                  <CartesianGrid stroke="#f4f4f5" />
                  <XAxis
                    dataKey="ts"
                    type="number"
                    domain={['dataMin', 'dataMax']}
                    tickFormatter={ts => format(ts, 'MMM d')}
                    {...axisProps}
                  />
                  <YAxis domain={[0, 'auto']} tickFormatter={v => `${Math.round(v)}`} {...axisProps} />
                  <Tooltip
                    content={({ active, payload }) => {
                      const p = payload?.[0]?.payload as Point | undefined
                      return active && p ? <SplitTooltip p={p} /> : null
                    }}
                  />
                  <Scatter dataKey="longestRunMin" fill={COLORS.running} fillOpacity={0.35} />
                  <Line
                    dataKey="longestRunAvg"
                    stroke={COLORS.running}
                    strokeWidth={2}
                    dot={false}
                    activeDot={false}
                    type="monotone"
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      )}
    </ChartCard>
  )
}
