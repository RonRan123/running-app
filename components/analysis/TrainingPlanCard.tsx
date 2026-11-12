'use client'

import { format, parseISO } from 'date-fns'
import type { CalcLine, PlanDay, WeekPlan } from '@/lib/trainingPlan'
import { KM_PER_MILE, formatPace, type Unit } from '@/lib/units'
import type { CheckIn, Level, TagKey } from '@/lib/checkIn'
import { HelpLink } from './ChartCard'
import CheckInTags from './CheckInTags'

function distance(km: number, unit: Unit) {
  return `${(unit === 'mi' ? km / KM_PER_MILE : km).toFixed(1)} ${unit}`
}

/** "213 min (15.0 mi)", "142 min/wk (10.7 mi)", "107 min (≈7.6 mi)". */
function minutesWithDistance(
  min: number,
  km: number | null | undefined,
  unit: Unit,
  { estimated = false, perWeek = false } = {},
) {
  const sign = min < 0 ? '−' : ''
  const head = `${sign}${Math.abs(min)} min${perWeek ? '/wk' : ''}`
  if (km == null || min < 0) return head
  return `${head} (${estimated ? '≈' : ''}${distance(km, unit)})`
}

function calcValue(line: CalcLine, unit: Unit) {
  if (line.minutes == null) return line.text ?? ''
  return minutesWithDistance(line.minutes, line.distanceKm, unit, {
    estimated: line.estimated,
    perWeek: line.perWeek,
  })
}

function DayRow({ day, unit }: { day: PlanDay; unit: Unit }) {
  const isRun = day.runMin > 0
  const long = day.type === 'long'
  const extras = [day.strength && '+ Strength', day.strides && '+ strides'].filter(Boolean)
  return (
    <div className="grid grid-cols-[6.5rem_1fr_auto] gap-3 items-baseline py-2 border-t border-zinc-100 text-sm">
      <span className="text-zinc-400 tabular-nums">{format(parseISO(day.date), 'EEE, MMM d')}</span>
      {isRun ? (
        <span className={`font-medium ${long ? 'text-blue-600' : 'text-emerald-600'}`}>
          {long && 'Long run '}
          {minutesWithDistance(day.runMin, day.distanceKm, unit, { estimated: true })}
        </span>
      ) : (
        <span className="text-zinc-400">
          Rest{day.restReason && <span className="text-amber-600"> · {day.restReason.toLowerCase()}</span>}
        </span>
      )}
      <span className="text-xs text-violet-600 text-right">{extras.join(' ')}</span>
    </div>
  )
}

export default function TrainingPlanCard({
  plan,
  unit,
  checkIn,
  onTag,
  saveFailed = false,
}: {
  plan: WeekPlan
  unit: Unit
  checkIn: CheckIn
  /** Omitted for the demo, which sees the plan without the check-in tags. */
  onTag?: (key: TagKey, level: Level) => void
  saveFailed?: boolean
}) {
  const paceLabel = plan.easyPaceMinPerKm == null ? null : formatPace(plan.easyPaceMinPerKm, unit)

  return (
    <div className="bg-white rounded-2xl border border-zinc-200 p-5 flex flex-col">
      <h2 className="text-sm font-semibold text-zinc-900 flex items-center gap-1.5">
        Next 7 days
        <HelpLink id="training-plan" label="the training plan" />
      </h2>
      <p className="text-sm text-zinc-500 mt-1">
        <span className="text-xl font-semibold text-zinc-900 tabular-nums">
          {plan.totalRunMin} min
        </span>
        {plan.totalDistanceKm != null && ` (≈${distance(plan.totalDistanceKm, unit)})`}
        {plan.changePct != null &&
          ` · ${plan.changePct > 0 ? '+' : plan.changePct < 0 ? '−' : ''}${Math.abs(plan.changePct)}% vs last week`}
        {plan.tags.length > 0 && ` · ${plan.tags.join(' · ')}`}
      </p>

      {onTag && <CheckInTags checkIn={checkIn} onTag={onTag} />}
      {saveFailed && (
        <p className="mt-2 text-xs text-rose-600">Couldn&apos;t save that change. Try again.</p>
      )}

      <details className="group mt-2">
        <summary className="inline-flex items-center gap-1 text-xs text-zinc-500 cursor-pointer select-none list-none [&::-webkit-details-marker]:hidden hover:text-zinc-700">
          <svg
            viewBox="0 0 16 16"
            className="w-3 h-3 transition-transform group-open:rotate-90"
            aria-hidden="true"
          >
            <path d="M6 4l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="1.5" />
          </svg>
          How this was set
        </summary>
        <div className="mt-2 rounded-lg bg-zinc-50 px-3 py-2 text-xs">
          {plan.calc.map((line, i) => (
            <div
              key={i}
              className={`flex justify-between gap-4 py-0.5 ${
                line.kind === 'result' ? 'border-t border-zinc-200 mt-1 pt-1.5 font-medium text-zinc-900' : 'text-zinc-500'
              }`}
            >
              <span>{line.label}</span>
              <span
                className={`tabular-nums text-right whitespace-nowrap ${
                  line.kind === 'warn' ? 'text-amber-600' : 'text-zinc-900'
                }`}
              >
                {calcValue(line, unit)}
              </span>
            </div>
          ))}
        </div>
      </details>

      <div className="mt-3">
        {plan.days.map(day => (
          <DayRow key={day.date} day={day} unit={unit} />
        ))}
      </div>

      <p className="text-xs text-zinc-400 mt-3">
        All runs easy, HR ≤ {plan.hrCap}. Walk to stay under.
        {paceLabel && ` Distances use your recent easy pace (${paceLabel}).`}
        {plan.maxRunKm != null && ` No run over ${distance(plan.maxRunKm, unit)} this week.`}
      </p>
    </div>
  )
}
