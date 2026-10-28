'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { format, parseISO } from 'date-fns'
import {
  addDaysToKey,
  addMonths,
  goalProgress,
  monthGrid,
  monthOf,
  recentWeeks,
  thisWeek,
  weekStreak,
  type DayMap,
  type DayRun,
  type WeeklyGoal,
} from '@/lib/activitySummary'
import { KM_PER_MILE, type Unit } from '@/lib/units'

const ACCENT = '#ea580c' // orange-600

function dist(km: number, unit: Unit, decimals = 1) {
  return (unit === 'mi' ? km / KM_PER_MILE : km).toFixed(decimals)
}

/** "3h 9m" / "52m". */
function hoursMinutes(seconds: number) {
  const h = Math.floor(seconds / 3600)
  const m = Math.round((seconds % 3600) / 60)
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

function runsLabel(runs: DayRun[], unit: Unit) {
  return runs.map(r => `${r.name} · ${dist(r.distanceKm, unit, 2)} ${unit}`).join('\n')
}

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <section className={`bg-white rounded-2xl border border-zinc-200 px-5 py-4 ${className}`}>
      {children}
    </section>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-zinc-500">{label}</div>
      <div className="text-base font-semibold text-zinc-900 tabular-nums">{value}</div>
    </div>
  )
}

function Flame({ count }: { count: number }) {
  return (
    <div className="flex flex-col items-center w-12 shrink-0">
      <div className="relative w-10 h-12">
        <svg width="40" height="48" viewBox="4 0 16 22" aria-hidden="true">
          <path
            d="M12 1c1.2 4.6 6.5 7.2 6.5 13.4A6.5 6.5 0 0 1 5.5 14.4c0-2.6 1.3-4.5 2.6-5.8 0 2.4 1.3 3.8 2.6 3.8 0-3.6-1.4-6.4 1.3-11.4z"
            fill={count > 0 ? ACCENT : '#d4d4d8'}
          />
        </svg>
        <span className="absolute inset-x-0 top-[21px] text-center text-white font-bold text-base leading-5 tabular-nums">
          {count}
        </span>
      </div>
      <span className={`text-xs font-semibold ${count > 0 ? 'text-orange-700' : 'text-zinc-500'}`}>
        {count === 1 ? 'Week' : 'Weeks'}
      </span>
    </div>
  )
}

function StreakCard({ days, todayKey, unit }: { days: DayMap; todayKey: string; unit: Unit }) {
  const streak = weekStreak(days, todayKey)
  const week = thisWeek(days, todayKey)
  return (
    <Card className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-zinc-900">Your streak</h2>
        <span className="text-xs text-zinc-500">
          {format(parseISO(week.startKey), 'MMM d')} – {format(parseISO(week.endKey), 'MMM d')}
        </span>
      </div>
      <div className="flex items-center gap-3">
        <Flame count={streak} />
        <ol className="flex-1 grid grid-cols-7 gap-1 text-center" aria-label="This week">
          {week.days.map(d => (
            <li key={d.key} className="flex flex-col items-center gap-1.5">
              <span className={`text-xs ${d.isToday ? 'font-semibold text-zinc-900' : 'text-zinc-500'}`}>
                {format(parseISO(d.key), 'EEEEE')}
              </span>
              {d.state === 'run' ? (
                <span
                  title={runsLabel(d.runs, unit)}
                  aria-label={`${format(parseISO(d.key), 'EEEE')}: ${runsLabel(d.runs, unit)}`}
                  className="w-7 h-7 rounded-full bg-zinc-900 flex items-center justify-center"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M3 17h13.5a4 4 0 0 0 4-4c0-.9-.6-1.6-1.5-1.8L14 10l-3-5H8l1 3.5-3 1-3-2z" />
                    <path d="M3 20.5h18" />
                  </svg>
                </span>
              ) : d.state === 'rest' ? (
                <span className="w-7 h-7 rounded-full bg-zinc-100 text-xs text-zinc-500 flex items-center justify-center tabular-nums">
                  {d.dayOfMonth}
                </span>
              ) : (
                <span
                  className={`w-7 h-7 rounded-full border text-xs flex items-center justify-center tabular-nums ${
                    d.isToday ? 'border-zinc-900 text-zinc-900' : 'border-zinc-300 text-zinc-600'
                  }`}
                >
                  {d.dayOfMonth}
                </span>
              )}
            </li>
          ))}
        </ol>
      </div>
      <div className="grid grid-cols-3 gap-2 border-t border-zinc-100 pt-3">
        <Stat label="This week" value={`${dist(week.distanceKm, unit)} ${unit}`} />
        <Stat label="Time" value={hoursMinutes(week.seconds)} />
        <Stat label="Runs" value={String(week.runs)} />
      </div>
    </Card>
  )
}

function GoalCard({
  goal,
  days,
  todayKey,
  unit,
}: {
  goal: WeeklyGoal | null
  days: DayMap
  todayKey: string
  unit: Unit
}) {
  if (!goal) {
    return (
      <Card className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-zinc-900">Weekly goal</h2>
          <p className="text-sm text-zinc-500">Set a runs or distance target for each week.</p>
        </div>
        <Link href="/goals#weekly-goal" className="text-sm font-medium text-zinc-900 hover:underline underline-offset-2 shrink-0">
          Set goal
        </Link>
      </Card>
    )
  }

  const p = goalProgress(goal, thisWeek(days, todayKey))
  const r = 30
  const circumference = 2 * Math.PI * r
  const done = p.type === 'runs' ? String(p.done) : dist(p.done, unit)
  const target = p.type === 'runs' ? String(p.target) : dist(p.target, unit)
  const suffix = p.type === 'runs' ? 'runs' : unit
  const remaining = p.target - p.done
  const status =
    remaining <= 0
      ? 'Goal reached'
      : p.type === 'runs'
        ? `${remaining} to go`
        : `${dist(remaining, unit)} ${unit} to go`

  return (
    <Card className="flex items-center gap-4">
      <svg width="64" height="64" viewBox="0 0 72 72" role="img" aria-label={`${done} of ${target} ${suffix} this week`}>
        <circle cx="36" cy="36" r={r} fill="none" stroke="#f4f4f5" strokeWidth="7" />
        <circle
          cx="36"
          cy="36"
          r={r}
          fill="none"
          stroke="#16a34a"
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={`${p.fraction * circumference} ${circumference}`}
          transform="rotate(-90 36 36)"
        />
      </svg>
      <div className="flex-1 min-w-0">
        <h2 className="text-sm font-semibold text-zinc-900">Weekly {p.type === 'runs' ? 'run' : 'distance'} goal</h2>
        <p className="text-sm text-zinc-500 tabular-nums">
          <span className="text-zinc-900 font-medium">
            {done} / {target} {suffix}
          </span>{' '}
          · {status}
        </p>
      </div>
      <Link href="/goals#weekly-goal" className="text-sm text-zinc-500 hover:text-zinc-900">
        Edit
      </Link>
    </Card>
  )
}

function MonthCard({ days, todayKey, unit }: { days: DayMap; todayKey: string; unit: Unit }) {
  const currentMonth = monthOf(todayKey)
  const firstMonth = useMemo(() => {
    const keys = Object.keys(days).filter(k => k <= todayKey).sort()
    return keys.length ? monthOf(keys[0]) : currentMonth
  }, [days, todayKey, currentMonth])
  const [month, setMonth] = useState(currentMonth)
  const grid = monthGrid(days, month, todayKey)

  return (
    <Card className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-zinc-900">{format(parseISO(`${month}-01`), 'MMMM yyyy')}</h2>
        <div className="flex gap-1">
          <button
            onClick={() => setMonth(m => addMonths(m, -1))}
            disabled={month <= firstMonth}
            aria-label="Previous month"
            className="w-8 h-8 rounded-lg border border-zinc-200 text-zinc-600 hover:bg-zinc-50 disabled:text-zinc-300 disabled:hover:bg-white"
          >
            ‹
          </button>
          <button
            onClick={() => setMonth(m => addMonths(m, 1))}
            disabled={month >= currentMonth}
            aria-label="Next month"
            className="w-8 h-8 rounded-lg border border-zinc-200 text-zinc-600 hover:bg-zinc-50 disabled:text-zinc-300 disabled:hover:bg-white"
          >
            ›
          </button>
        </div>
      </div>
      <div className="flex items-center gap-4">
        <div className="flex flex-col gap-0.5 min-w-[88px]">
          <span className="text-3xl font-semibold text-zinc-900 leading-none tabular-nums">{grid.runDays}</span>
          <span className="text-xs text-zinc-500">{grid.runDays === 1 ? 'run day' : 'run days'}</span>
          <span className="text-xs text-zinc-500 tabular-nums">
            {dist(grid.distanceKm, unit)} {unit} · {hoursMinutes(grid.seconds)}
          </span>
        </div>
        <div className="flex-1 grid grid-cols-7 gap-y-1.5 justify-items-center" aria-label="Run days this month">
          {Array.from({ length: grid.leadingBlanks }, (_, i) => (
            <span key={`b${i}`} className="w-4 h-4" />
          ))}
          {grid.cells.map(c => (
            <span
              key={c.key}
              title={c.state === 'run' ? `${format(parseISO(c.key), 'MMM d')}\n${runsLabel(c.runs, unit)}` : format(parseISO(c.key), 'MMM d')}
              className="w-4 h-4 flex items-center justify-center"
            >
              {c.state === 'run' ? (
                <span className="w-3.5 h-3.5 rounded-full" style={{ background: ACCENT }} />
              ) : (
                <span className={`w-1.5 h-1.5 rounded-full ${c.state === 'rest' ? 'bg-zinc-400' : 'bg-zinc-200'}`} />
              )}
            </span>
          ))}
        </div>
      </div>
    </Card>
  )
}

function TrendCard({ days, todayKey, unit }: { days: DayMap; todayKey: string; unit: Unit }) {
  const weeks = recentWeeks(days, todayKey, 12)
  const data = weeks.map(w => ({
    weekStart: w.weekStart,
    distance: parseFloat(dist(w.distanceKm, unit)),
    runs: w.runs,
    seconds: w.seconds,
  }))
  const avg = data.reduce((s, d) => s + d.distance, 0) / data.length

  return (
    <Card className="space-y-2">
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm font-semibold text-zinc-900">Past 12 weeks</h2>
        <span className="text-xs text-zinc-500 tabular-nums">
          avg {avg.toFixed(1)} {unit} / wk
        </span>
      </div>
      <ResponsiveContainer width="100%" height={96}>
        <AreaChart data={data} margin={{ top: 6, right: 4, bottom: 0, left: 4 }}>
          <XAxis dataKey="weekStart" hide />
          <YAxis hide domain={[0, 'dataMax']} />
          <Tooltip
            cursor={{ stroke: '#18181b', strokeWidth: 1 }}
            content={({ active, payload }) => {
              const d = active && payload?.[0]?.payload
              if (!d) return null
              const start = parseISO(d.weekStart)
              return (
                <div className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs shadow-sm">
                  <div className="font-medium text-zinc-900">
                    {format(start, 'MMM d')} – {format(parseISO(addDaysToKey(d.weekStart, 6)), 'MMM d')}
                  </div>
                  <div className="text-zinc-600 tabular-nums">
                    {d.distance.toFixed(1)} {unit} · {hoursMinutes(d.seconds)} · {d.runs} {d.runs === 1 ? 'run' : 'runs'}
                  </div>
                </div>
              )
            }}
          />
          <Area
            type="linear"
            dataKey="distance"
            stroke={ACCENT}
            strokeWidth={2}
            fill={ACCENT}
            fillOpacity={0.12}
            dot={{ r: 2.5, fill: '#fff', stroke: ACCENT, strokeWidth: 1.5 }}
            activeDot={{ r: 4, fill: ACCENT, stroke: '#fff' }}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
      <div className="flex justify-between text-[11px] text-zinc-500">
        <span>{format(parseISO(weeks[0].weekStart), 'MMM d')}</span>
        <span>This week</span>
      </div>
    </Card>
  )
}

/** Habit summary beside the runs table: streak, weekly goal, month and trend. */
export default function ActivitySidebar({
  days,
  todayKey,
  goal,
  unit,
}: {
  days: DayMap
  todayKey: string
  goal: WeeklyGoal | null
  unit: Unit
}) {
  return (
    <aside className="space-y-4" aria-label="Activity summary">
      <StreakCard days={days} todayKey={todayKey} unit={unit} />
      <GoalCard goal={goal} days={days} todayKey={todayKey} unit={unit} />
      <MonthCard days={days} todayKey={todayKey} unit={unit} />
      <TrendCard days={days} todayKey={todayKey} unit={unit} />
    </aside>
  )
}
