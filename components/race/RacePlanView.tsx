'use client'

import { useCallback, useState } from 'react'
import Link from 'next/link'
import { format, parseISO } from 'date-fns'
import UnitToggle from '@/components/UnitToggle'
import { useUnit } from '@/lib/useUnit'
import type { RaceView } from '@/lib/raceServer'
import type { PlanWeek, Session } from '@/lib/racePlan'
import { RULES } from '@/lib/racePrinciples'
import { formatPace, type Unit } from '@/lib/units'
import { fillTokens, fmtClock, fmtDistance, fmtHalf, fmtRange } from '@/lib/raceFormat'
import MileageChart, { Legend, PHASE_STYLE } from './MileageChart'
import WhyDrawer, { type DrawerTarget } from './WhyDrawer'
import CheckInCard from './CheckInCard'

const card = 'bg-white rounded-2xl border border-zinc-200 p-5'
const CONF = { high: 'text-emerald-700', medium: 'text-amber-700', low: 'text-orange-700' } as const

function WhyButton({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} className="self-start text-sm font-medium text-blue-700 hover:underline min-h-8">
      {children} →
    </button>
  )
}

function ProjectionCard({ view, unit, onWhy }: { view: RaceView; unit: Unit; onWhy: () => void }) {
  const p = view.prediction
  const goal = view.goal
  const trend = view.trend.filter(t => t.seconds != null) as { weekStart: string; seconds: number }[]
  // Bars are scaled so 1% faster = 10% taller around the average: a minute
  // either way looks like a minute, not like a collapse.
  const mean = trend.reduce((s, t) => s + t.seconds, 0) / Math.max(1, trend.length)
  const barHeight = (s: number) => Math.max(12, Math.min(100, 55 + ((mean - s) / mean) * 1000))
  const delta = p ? p.seconds - goal.goalTime : null
  return (
    <section className={`${card} flex flex-col gap-3`}>
      <h2 className="text-sm font-semibold text-zinc-900">Projected finish</h2>
      {!p ? (
        <p className="text-sm text-zinc-500">
          Not enough data yet. Log a hard effort of 5K or more, or six runs with heart rate, and a projection appears
          here.
        </p>
      ) : (
        <>
          <div>
            <p className="text-xs uppercase tracking-wide font-medium text-zinc-500">If you raced today</p>
            <p className="text-3xl font-semibold tabular-nums text-zinc-900 mt-0.5">{fmtClock(p.seconds)}</p>
            <p className="text-sm text-zinc-600 mt-0.5">
              Range {fmtRange(p.low, p.high)} · {formatPace(p.seconds / 60 / goal.distanceKm, unit)} ·{' '}
              <span className={`font-medium ${CONF[p.confidence]}`}>
                {p.confidence[0].toUpperCase() + p.confidence.slice(1)} confidence
              </span>
            </p>
          </div>
          {trend.length >= 2 && (
            <div>
              <div
                className="flex items-end gap-1 h-11"
                role="img"
                aria-label={`Projection over the last ${trend.length} weeks: ${fmtClock(trend[0].seconds)} to ${fmtClock(trend[trend.length - 1].seconds)}`}
              >
                {trend.map(t => (
                  <div
                    key={t.weekStart}
                    className="flex-1 rounded-sm bg-blue-200"
                    style={{ height: `${barHeight(t.seconds)}%` }}
                  />
                ))}
              </div>
              <p className="text-xs text-zinc-500 mt-1">
                Last {trend.length} weeks: {fmtClock(trend[0].seconds)} → {fmtClock(trend[trend.length - 1].seconds)}{' '}
                (taller = faster)
              </p>
            </div>
          )}
          <div className="border-t border-zinc-100 pt-3 space-y-1 text-sm">
            <div className="flex justify-between gap-3">
              <span className="text-zinc-600">Goal</span>
              <span className="tabular-nums font-medium">
                {fmtClock(goal.goalTime)}{' '}
                {delta != null && (
                  <span className={delta <= 0 ? 'text-emerald-700' : 'text-amber-700'}>
                    ({delta <= 0 ? '−' : '+'}
                    {fmtClock(Math.abs(delta))})
                  </span>
                )}
              </span>
            </div>
            {p.raceDay && (
              <div className="flex justify-between gap-3">
                <span className="text-zinc-600">If training goes to plan</span>
                <span className="tabular-nums font-medium">≈{fmtRange(p.raceDay.low, p.raceDay.high)}</span>
              </div>
            )}
          </div>
        </>
      )}
      <WhyButton onClick={onWhy}>Why this number?</WhyButton>
    </section>
  )
}

function sessionLine(s: Session, unit: Unit) {
  return (
    <li key={s.kind + s.label} className="flex justify-between gap-3 py-2 border-t border-zinc-100">
      <span className={s.quality ? 'text-orange-700 font-medium' : 'text-zinc-600'}>{s.label}</span>
      <span className="text-right text-zinc-900">{fillTokens(s.detail, unit)}</span>
    </li>
  )
}

function ThisWeekCard({
  week,
  last,
  unit,
  beforeSeason,
  onWhy,
}: {
  week: PlanWeek
  last: boolean
  unit: Unit
  beforeSeason: boolean
  onWhy: () => void
}) {
  const done = week.actualKm ?? 0
  const pct = Math.min(100, Math.round((done / week.targetKm) * 100))
  const lo = week.targetKm * (1 - RULES.flexBand)
  const hi = week.targetKm * (1 + RULES.flexBand)
  return (
    <section className={`${card} flex flex-col gap-3`}>
      <h2 className="text-sm font-semibold text-zinc-900">
        {beforeSeason ? 'Week 1 starts' : 'This week'} · {format(parseISO(week.start), 'MMM d')}–
        {format(parseISO(week.end), 'MMM d')}
      </h2>
      <div>
        <p className="text-3xl font-semibold tabular-nums text-zinc-900">
          {beforeSeason ? '' : `${fmtDistance(done, unit).split(' ')[0]} `}
          <span className="text-base font-medium text-zinc-500">
            {beforeSeason ? '' : '/ '}
            {fmtDistance(week.targetKm, unit, 0)}
          </span>
        </p>
        {!beforeSeason && (
          <div className="h-2 rounded-full bg-zinc-100 mt-2" aria-hidden="true">
            <div className="h-2 rounded-full bg-blue-600" style={{ width: `${pct}%` }} />
          </div>
        )}
        <p className="text-xs text-zinc-500 mt-2">
          Anything from {fmtDistance(lo, unit, 0)} to {fmtDistance(hi, unit, 0)} counts as a full week.
        </p>
      </div>
      <ul className="text-sm">
        <li className="flex justify-between gap-3 py-2 border-t border-zinc-100">
          <span className="text-zinc-600">{last ? 'Race · Sun' : 'Long run · Sat'}</span>
          <span className="text-zinc-900">{last ? fmtDistance(week.longKm, unit) : `${fmtHalf(week.longKm, unit)} easy`}</span>
        </li>
        {week.sessions.filter(s => s.kind !== 'race').map(s => sessionLine(s, unit))}
        <li className="flex justify-between gap-3 py-2 border-t border-zinc-100">
          <span className="text-zinc-600">Easy runs</span>
          <span className="text-zinc-900">≤ {RULES.easyHrCap} bpm</span>
        </li>
      </ul>
      <WhyButton onClick={onWhy}>Why {fmtDistance(week.targetKm, unit, 0)}?</WhyButton>
    </section>
  )
}

function ChangesCard({ view, unit }: { view: RaceView; unit: Unit }) {
  const [all, setAll] = useState(false)
  const changes = view.plan!.changes
  const shown = all ? changes : changes.slice(0, 3)
  return (
    <section className={`${card} flex flex-col gap-3`}>
      <h2 className="text-sm font-semibold text-zinc-900">Plan changes</h2>
      <ol className="space-y-3 text-sm">
        {shown.map((c, i) => (
          <li key={i} className="space-y-0.5">
            <p className="text-xs text-zinc-500">{format(parseISO(c.weekStart), 'MMM d')}</p>
            <p>
              <strong className="font-semibold text-zinc-900">{fillTokens(c.title, unit)}.</strong>{' '}
              <span className="text-zinc-700">{fillTokens(c.why, unit)}</span>
            </p>
            <p className="text-xs text-zinc-500 font-mono">
              {c.rules.map((r, j) => (
                <span key={r}>
                  {j > 0 && ', '}
                  <Link href={`/guide#rule-${r}`} className="hover:underline">
                    {r}
                  </Link>
                </span>
              ))}
            </p>
          </li>
        ))}
      </ol>
      {changes.length > 3 && (
        <button type="button" onClick={() => setAll(a => !a)} className="self-start text-sm font-medium text-blue-700 hover:underline">
          {all ? 'Show fewer' : `Full change log (${changes.length}) →`}
        </button>
      )}
    </section>
  )
}

function SpeedWork({ view, unit }: { view: RaceView; unit: Unit }) {
  const plan = view.plan!
  return (
    <section className={card}>
      <h2 className="text-sm font-semibold text-zinc-900">Speed work by phase</h2>
      <p className="text-xs text-zinc-500 mt-0.5 mb-4">
        One new thing at a time, one quality session a week. Paces come from your projection, not your goal. Workout
        days are exempt from the {RULES.easyHrCap} bpm cap.
      </p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {plan.phases.map(ph => {
          const weeks = plan.weeks.slice(ph.fromWeek - 1, ph.toWeek)
          const now = weeks.some(w => w.status === 'current')
          const past = weeks.every(w => w.status === 'done')
          // First week each session type appears in this phase.
          const seen = new Map<string, { s: Session; week: number }>()
          for (const w of weeks) for (const s of w.sessions) if (!seen.has(s.label)) seen.set(s.label, { s, week: w.number })
          return (
            <div
              key={ph.phase}
              className={`rounded-xl p-3.5 space-y-1.5 ${now ? 'border-2 border-blue-600' : 'border border-zinc-200'}`}
            >
              <p className={`text-[11px] font-semibold ${PHASE_STYLE[ph.phase].band.split(' ')[1]}`}>
                {PHASE_STYLE[ph.phase].label.toUpperCase()} · {format(parseISO(ph.start), 'MMM d').toUpperCase()} –{' '}
                {format(parseISO(ph.end), 'MMM d').toUpperCase()}
                {now && ' · NOW'}
              </p>
              {[...seen.values()].map(({ s, week }) => (
                <p key={s.label} className="text-sm text-zinc-800">
                  <strong className="font-semibold">{s.label}</strong> · from wk {week}
                  <span className="block text-xs text-zinc-500">{fillTokens(s.detail, unit)}</span>
                </p>
              ))}
              {past && <p className="text-xs font-medium text-emerald-700">✓ Done</p>}
            </div>
          )
        })}
      </div>
    </section>
  )
}

export default function RacePlanView({ view }: { view: RaceView }) {
  const { unit, changeUnit } = useUnit()
  const [drawer, setDrawer] = useState<DrawerTarget | null>(null)
  const closeDrawer = useCallback(() => setDrawer(null), [])
  const plan = view.plan
  const goal = view.goal

  const header = (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className="text-sm text-zinc-500">
          <Link href="/goals" className="hover:text-zinc-900">
            Goals
          </Link>{' '}
          / Race plan
        </p>
        <h1 className="text-2xl font-semibold text-zinc-900 mt-1">{goal.name}</h1>
        <p className="text-sm text-zinc-600 mt-1">
          {format(parseISO(goal.date), 'EEE, MMM d, yyyy')} · {fmtDistance(goal.distanceKm, unit)} ·{' '}
          <strong className="text-zinc-900">
            {view.daysOut > 0 ? `${view.daysOut} days out` : view.daysOut === 0 ? 'Race day!' : 'Done'}
          </strong>
        </p>
      </div>
      <UnitToggle unit={unit} onChange={changeUnit} />
    </div>
  )

  if (!plan) {
    return (
      <div className="space-y-6">
        {header}
        <div className={card}>
          <p className="text-sm text-zinc-600">This race is over, so there is no plan to show.</p>
        </div>
      </div>
    )
  }

  const before = plan.current < 0
  const after = plan.current >= plan.weeks.length
  const index = before ? 0 : after ? plan.weeks.length - 1 : plan.current
  const week = plan.weeks[index]
  const dueWeek = plan.checkInDue ? plan.weeks.find(w => w.start === plan.checkInDue) : null

  return (
    <div className="space-y-5">
      {header}
      <div className="flex flex-wrap gap-2 text-sm -mt-2">
        <span className={`rounded-full px-3 py-1 font-medium ${PHASE_STYLE[week.phase].band}`}>
          {PHASE_STYLE[week.phase].label} phase
        </span>
        <span className="rounded-full px-3 py-1 font-medium bg-zinc-100 text-zinc-700">
          {before ? `Starts ${format(parseISO(plan.weeks[0].start), 'MMM d')}` : `Week ${week.number} of ${plan.weeks.length}`}
        </span>
        {week.cutback && <span className="rounded-full px-3 py-1 font-medium bg-emerald-50 text-emerald-700">Cutback week</span>}
        {week.hold && <span className="rounded-full px-3 py-1 font-medium bg-zinc-100 text-zinc-700">Hold week</span>}
      </div>

      {dueWeek && <CheckInCard weekStart={dueWeek.start} weekNumber={dueWeek.number} />}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <ThisWeekCard
          week={week}
          last={index === plan.weeks.length - 1}
          unit={unit}
          beforeSeason={before}
          onWhy={() => setDrawer({ kind: 'week', index })}
        />
        <ProjectionCard view={view} unit={unit} onWhy={() => setDrawer({ kind: 'projection' })} />
        <ChangesCard view={view} unit={unit} />
      </div>

      <section className={card}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-zinc-900">Weekly mileage to race day</h2>
            <p className="text-xs text-zinc-500 mt-0.5 max-w-xl">
              Grey bar = the week&apos;s planned total. Blue bar inside it = what you ran. Orange dot = that week&apos;s
              planned long run, on the same scale. Re-planned every Monday from what you ran. Select a week to see the
              rules that set it.
            </p>
          </div>
          <Legend />
        </div>
        <div className="mt-4">
          <MileageChart
            weeks={plan.weeks}
            phases={plan.phases}
            unit={unit}
            selected={drawer?.kind === 'week' ? drawer.index : null}
            onSelect={i => setDrawer({ kind: 'week', index: i })}
          />
        </div>
        <dl className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mt-4 pt-4 border-t border-zinc-100 text-sm">
          <div>
            <dt className="text-xs text-zinc-500">Baseline</dt>
            <dd className="font-semibold mt-0.5">{fmtDistance(plan.baselineKm, unit, 0)}/wk</dd>
          </div>
          <div>
            <dt className="text-xs text-zinc-500">Planned peak</dt>
            <dd className="font-semibold mt-0.5">
              {fmtDistance(plan.peakKm, unit, 0)} · wk {plan.peakWeek}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-zinc-500">Longest run</dt>
            <dd className="font-semibold mt-0.5">
              {fmtHalf(plan.longestLong.km, unit)} · wk {plan.longestLong.week}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-zinc-500">Taper</dt>
            <dd className="font-semibold mt-0.5">
              {RULES.taperRates.map(r => `${Math.round(r * 100)}%`).join(' → ')} of peak
            </dd>
          </div>
          <div>
            <dt className="text-xs text-zinc-500">On plan so far</dt>
            <dd className="font-semibold mt-0.5">
              {plan.onPlanPct == null ? '—' : `${Math.round(plan.onPlanPct * 100)}% of planned`}
            </dd>
          </div>
        </dl>
      </section>

      <SpeedWork view={view} unit={unit} />

      <p className="text-xs text-zinc-500">
        Every number here comes from a written rule with its source and how solid the evidence is.{' '}
        <Link href="/guide#race-rules" className="text-blue-700 hover:underline">
          See all the rules
        </Link>
        .
      </p>

      {drawer && (
        <WhyDrawer
          target={drawer}
          weeks={plan.weeks}
          prediction={view.prediction}
          unit={unit}
          onClose={closeDrawer}
          onTarget={setDrawer}
        />
      )}
    </div>
  )
}
