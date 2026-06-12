'use client'

import { addDays, differenceInCalendarDays, format, parseISO, startOfDay } from 'date-fns'

interface Props {
  min: Date
  max: Date
  from: Date
  to: Date
  onChange: (from: Date, to: Date) => void
}

export default function DateRangeSlider({ min, max, from, to, onChange }: Props) {
  const totalDays = Math.max(1, differenceInCalendarDays(max, min))
  const fromDay = differenceInCalendarDays(from, min)
  const toDay = differenceInCalendarDays(to, min)
  const fromPct = (fromDay / totalDays) * 100
  const toPct = (toDay / totalDays) * 100

  function setFromDay(day: number) {
    onChange(addDays(min, Math.min(day, toDay)), to)
  }
  function setToDay(day: number) {
    onChange(from, addDays(min, Math.max(day, fromDay)))
  }
  function parseInput(value: string, fallback: Date) {
    if (!value) return fallback
    const d = startOfDay(parseISO(value))
    if (isNaN(d.getTime()) || d < min || d > max) return fallback
    return d
  }

  return (
    <div className="bg-white rounded-2xl border border-zinc-200 px-5 py-4 flex items-center gap-6 flex-wrap">
      <div className="relative flex-1 min-w-56 h-5">
        <div className="absolute top-1/2 -translate-y-1/2 w-full h-1 rounded-full bg-zinc-200" />
        <div
          className="absolute top-1/2 -translate-y-1/2 h-1 rounded-full bg-zinc-900"
          style={{ left: `${fromPct}%`, width: `${toPct - fromPct}%` }}
        />
        <input
          type="range"
          className="dual-range"
          min={0}
          max={totalDays}
          value={fromDay}
          onChange={e => setFromDay(Number(e.target.value))}
          aria-label="Range start"
        />
        <input
          type="range"
          className="dual-range"
          min={0}
          max={totalDays}
          value={toDay}
          onChange={e => setToDay(Number(e.target.value))}
          aria-label="Range end"
        />
      </div>
      <div className="flex items-center gap-2 text-sm">
        <input
          type="date"
          value={format(from, 'yyyy-MM-dd')}
          min={format(min, 'yyyy-MM-dd')}
          max={format(to, 'yyyy-MM-dd')}
          onChange={e => onChange(parseInput(e.target.value, from), to)}
          className="border border-zinc-300 rounded-lg px-2.5 py-1.5 text-zinc-700 focus:outline-none focus:ring-2 focus:ring-zinc-900"
        />
        <span className="text-zinc-400">to</span>
        <input
          type="date"
          value={format(to, 'yyyy-MM-dd')}
          min={format(from, 'yyyy-MM-dd')}
          max={format(max, 'yyyy-MM-dd')}
          onChange={e => onChange(from, parseInput(e.target.value, to))}
          className="border border-zinc-300 rounded-lg px-2.5 py-1.5 text-zinc-700 focus:outline-none focus:ring-2 focus:ring-zinc-900"
        />
      </div>
    </div>
  )
}
