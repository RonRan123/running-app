'use client'

import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { format, parseISO } from 'date-fns'
import type { BaseBuilding } from '@/lib/analysis'
import { formatDistance, type Unit } from '@/lib/units'
import ChartCard, { ChartEmpty } from './ChartCard'

function Stat({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div>
      <p className="text-xs text-zinc-500">{label}</p>
      <p className="text-xl font-semibold text-zinc-900 tabular-nums mt-0.5">{value}</p>
      <p className="text-xs text-zinc-400 mt-0.5">{detail}</p>
    </div>
  )
}

export default function BaseBuildingCard({ base, unit }: { base: BaseBuilding; unit: Unit }) {
  const weeks = base.weeks
  const current = weeks[weeks.length - 1]
  const full = weeks.slice(0, -1) // completed weeks
  const last = full[full.length - 1]
  const prior = full.slice(-5, -1) // the 4 weeks before the last full one
  const avg = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0)
  const priorEasy = avg(prior.map(w => w.easyMin))
  const priorLong = Math.max(0, ...prior.map(w => w.longKm))
  const hasRuns = weeks.some(w => w.totalMin > 0)

  return (
    <ChartCard
      title="Base building"
      help="base-building"
      subtitle="What the plan is trying to grow: easy minutes per week and the long run. Last 8 weeks."
    >
      {!hasRuns ? (
        <ChartEmpty message="No runs in the last 8 weeks." />
      ) : (
        <>
          <div className="grid grid-cols-3 gap-4 mb-4">
            <Stat
              label="Easy minutes"
              value={`${Math.round(last?.easyMin ?? 0)}`}
              detail={`last full week · ${Math.round(priorEasy)} avg the 4 before`}
            />
            <Stat
              label="Long run"
              value={last && last.longKm > 0 ? formatDistance(last.longKm, unit, 1) : '—'}
              detail={`last full week · ${
                priorLong > 0 ? formatDistance(priorLong, unit, 1) : '—'
              } best of the 4 before`}
            />
            <Stat
              label="Consistency"
              value={`${base.streak} ${base.streak === 1 ? 'week' : 'weeks'}`}
              detail="in a row with 3+ runs"
            />
          </div>
          <ResponsiveContainer width="100%" height={176}>
            <BarChart data={weeks} margin={{ top: 8, right: 8, bottom: 4, left: -16 }}>
              <CartesianGrid stroke="#f4f4f5" vertical={false} />
              <XAxis
                dataKey="weekStart"
                tickFormatter={w => format(parseISO(w), 'MMM d')}
                tick={{ fontSize: 12, fill: '#a1a1aa' }}
                tickLine={false}
                axisLine={{ stroke: '#e4e4e7' }}
                minTickGap={24}
              />
              <YAxis
                tick={{ fontSize: 12, fill: '#a1a1aa' }}
                tickLine={false}
                axisLine={{ stroke: '#e4e4e7' }}
                unit=" min"
                width={72}
              />
              <Tooltip
                cursor={{ fill: '#fafafa' }}
                content={({ active, payload }) => {
                  const w = payload?.[0]?.payload as (typeof weeks)[number] | undefined
                  if (!active || !w) return null
                  return (
                    <div className="bg-white border border-zinc-200 rounded-lg shadow-sm px-3 py-2 text-xs">
                      <p className="font-medium text-zinc-900">
                        Week of {format(parseISO(w.weekStart), 'MMM d, yyyy')}
                        {w === current && ' (in progress)'}
                      </p>
                      <p className="text-zinc-700 mt-1">
                        {Math.round(w.easyMin)} easy min of {Math.round(w.totalMin)} · {w.runs}{' '}
                        {w.runs === 1 ? 'run' : 'runs'}
                      </p>
                      <p className="text-zinc-700">
                        Long run: {w.longKm > 0 ? formatDistance(w.longKm, unit, 1) : 'none'}
                      </p>
                    </div>
                  )
                }}
              />
              <Bar dataKey="easyMin" radius={[3, 3, 0, 0]}>
                {weeks.map(w => (
                  <Cell key={w.weekStart} fill="#10b981" fillOpacity={w === current ? 0.4 : 1} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <p className="text-xs text-zinc-400 mt-2">
            Bars are easy minutes per week (at or below your easy heart rate). The lighter bar is
            this week so far.
          </p>
        </>
      )}
    </ChartCard>
  )
}
