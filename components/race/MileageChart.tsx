'use client'

import { useEffect, useRef } from 'react'
import { format, parseISO } from 'date-fns'
import type { PhaseSpan, PlanWeek } from '@/lib/racePlan'
import { KM_PER_MILE, type Unit } from '@/lib/units'
import { fmtDistance, fmtHalf } from '@/lib/raceFormat'

export const PHASE_STYLE = {
  base: { label: 'Base', band: 'bg-zinc-100 text-zinc-700', blurb: 'easy volume, strides, hill sprints' },
  build: { label: 'Build', band: 'bg-blue-50 text-blue-700', blurb: 'fartlek → tempo' },
  peak: { label: 'Peak', band: 'bg-orange-50 text-orange-800', blurb: 'race pace' },
  taper: { label: 'Taper', band: 'bg-emerald-50 text-emerald-700', blurb: '' },
} as const

const HEIGHT = 200
const HATCH = 'repeating-linear-gradient(45deg,#e4e4e7 0 3px,#ffffff 3px 6px)'

export function Legend() {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-600 items-center">
      <span className="flex items-center gap-1.5">
        <span className="w-3 h-3 rounded-sm bg-zinc-200 border border-zinc-400" />
        Planned week
      </span>
      <span className="flex items-center gap-1.5">
        <span className="w-3 h-3 rounded-sm bg-blue-600" />
        You ran
      </span>
      <span className="flex items-center gap-1.5">
        <span className="w-2.5 h-2.5 rounded-full bg-orange-600" />
        Long run that week
      </span>
      <span className="flex items-center gap-1.5">
        <span className="w-3 h-3 rounded-sm border border-zinc-400" style={{ background: HATCH }} />
        Cutback
      </span>
    </div>
  )
}

export default function MileageChart({
  weeks,
  phases,
  unit,
  selected,
  onSelect,
}: {
  weeks: PlanWeek[]
  phases: PhaseSpan[]
  unit: Unit
  selected: number | null
  onSelect: (index: number) => void
}) {
  const conv = (km: number) => (unit === 'mi' ? km / KM_PER_MILE : km)
  const max = Math.max(...weeks.map(w => Math.max(conv(w.targetKm), conv(w.actualKm ?? 0), conv(w.longKm))), 1)
  const step = max > 60 ? 20 : 10
  const top = Math.ceil((max * 1.08) / step) * step
  const px = (km: number) => (conv(km) / top) * HEIGHT
  const ticks = Array.from({ length: Math.floor(top / step) }, (_, i) => (i + 1) * step)
  const cols = { gridTemplateColumns: `repeat(${weeks.length}, minmax(0, 1fr))` }

  // On a phone the chart scrolls sideways; open it on this week.
  const scroller = useRef<HTMLDivElement>(null)
  const current = weeks.findIndex(w => w.status === 'current')
  useEffect(() => {
    const el = scroller.current
    if (!el || current < 0 || el.scrollWidth <= el.clientWidth) return
    el.scrollLeft = (current / weeks.length) * el.scrollWidth - el.clientWidth / 2
  }, [current, weeks.length])

  return (
    <div ref={scroller} className="overflow-x-auto -mx-1 px-1">
      <div className="min-w-[720px] pl-10 relative">
        <div className="grid gap-x-1.5 mb-2 text-[11px] font-semibold" style={cols}>
          {phases.map(p => (
            <div
              key={p.phase}
              className={`${PHASE_STYLE[p.phase].band} rounded-md px-2 py-1 truncate`}
              style={{ gridColumn: `${p.fromWeek} / span ${p.toWeek - p.fromWeek + 1}` }}
              title={`${PHASE_STYLE[p.phase].label}: ${format(parseISO(p.start), 'MMM d')} – ${format(parseISO(p.end), 'MMM d')}`}
            >
              {PHASE_STYLE[p.phase].label.toUpperCase()}
              {PHASE_STYLE[p.phase].blurb && p.toWeek - p.fromWeek >= 2 && (
                <span className="font-normal"> · {PHASE_STYLE[p.phase].blurb}</span>
              )}
            </div>
          ))}
        </div>

        <div className="relative" style={{ height: HEIGHT }}>
          {ticks.map(t => (
            <div
              key={t}
              className="absolute -left-10 right-0 border-t border-dashed border-zinc-200"
              style={{ bottom: (t / top) * HEIGHT }}
              aria-hidden="true"
            >
              <span className="absolute left-0 -top-2 text-[11px] text-zinc-500 tabular-nums">
                {t}
                {t === ticks[ticks.length - 1] ? ` ${unit}` : ''}
              </span>
            </div>
          ))}
          <div className="absolute inset-0 grid gap-x-1.5 border-b border-zinc-300" style={cols}>
            {weeks.map((w, i) => {
              const isCurrent = w.status === 'current'
              const isRace = i === weeks.length - 1
              const label = [
                `Week ${w.number}, ${format(parseISO(w.start), 'MMM d')}`,
                `planned ${fmtDistance(w.targetKm, unit)}`,
                w.actualKm != null ? `ran ${fmtDistance(w.actualKm, unit)}${isCurrent ? ' so far' : ''}` : null,
                isRace ? 'race week' : `long run ${fmtHalf(w.longKm, unit)}`,
                w.cutback ? 'cutback week' : null,
              ]
                .filter(Boolean)
                .join(', ')
              return (
                <button
                  key={w.start}
                  type="button"
                  onClick={() => onSelect(i)}
                  aria-label={`${label}. Show why.`}
                  aria-pressed={selected === i}
                  className={`relative rounded-t-md transition-colors focus-visible:outline-2 focus-visible:outline-blue-600 ${
                    selected === i ? 'bg-zinc-100' : isCurrent ? 'bg-blue-50' : 'hover:bg-zinc-50'
                  }`}
                >
                  <span
                    className="absolute left-[12%] right-[12%] bottom-0 rounded-t border border-b-0 border-zinc-400 bg-zinc-200"
                    style={{ height: px(w.targetKm), background: w.cutback ? HATCH : undefined }}
                  />
                  {w.actualKm != null && w.actualKm > 0 && (
                    <span
                      className={`absolute left-[28%] right-[28%] bottom-0 rounded-t-sm ${isCurrent ? 'bg-blue-400' : 'bg-blue-600'}`}
                      style={{ height: Math.min(px(w.actualKm), HEIGHT) }}
                    />
                  )}
                  <span
                    className="absolute left-1/2 w-2.5 h-2.5 -ml-[5px] -mb-[5px] rounded-full bg-orange-600 ring-2 ring-white"
                    style={{ bottom: px(w.longKm) }}
                  />
                  {(isCurrent || isRace) && (
                    <span className="absolute inset-x-0 top-1 text-[10px] font-semibold text-zinc-900">
                      {isCurrent ? 'Now' : 'Race'}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </div>

        <div className="grid gap-x-1.5 mt-1.5 text-[10px] text-center tabular-nums" style={cols}>
          {weeks.map((w, i) => (
            <span
              key={w.start}
              className={
                w.status === 'current'
                  ? 'font-semibold text-blue-700'
                  : i === weeks.length - 1
                  ? 'font-semibold text-zinc-900'
                  : 'text-zinc-500'
              }
            >
              {format(parseISO(w.start), 'MMM d')}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}
