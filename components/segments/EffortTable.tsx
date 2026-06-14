'use client'

import { useMemo, useState } from 'react'
import { format } from 'date-fns'
import { formatDuration, formatPace, type Unit } from '@/lib/units'
import type { SegmentEffortRow } from './SegmentsView'

type Column = 'date' | 'elapsed' | 'avgPace' | 'avgGap' | 'avgHr' | 'efficiency'

interface Row extends SegmentEffortRow {
  // Efficiency Factor: meters per minute per bpm — higher is fitter
  efficiency: number | null
}

const COLUMNS: { key: Column; label: string; title?: string }[] = [
  { key: 'date', label: 'Date' },
  { key: 'elapsed', label: 'Time' },
  { key: 'avgPace', label: 'Pace' },
  { key: 'avgGap', label: 'GAP' },
  { key: 'avgHr', label: 'Avg HR' },
  { key: 'efficiency', label: 'EF', title: 'Efficiency Factor — meters per minute per heartbeat. Higher = more speed for the same cardiovascular cost.' },
]

// For these columns the best value is the smallest; efficiency is best-largest.
const LOWER_IS_BETTER = new Set<Column>(['elapsed', 'avgPace', 'avgGap', 'avgHr'])

function value(row: Row, col: Column): number | null {
  if (col === 'date') return new Date(row.date).getTime()
  return row[col]
}

export default function EffortTable({
  efforts,
  unit,
  selectedId,
  onSelect,
}: {
  efforts: SegmentEffortRow[]
  unit: Unit
  selectedId: string | null
  onSelect: (id: string) => void
}) {
  const [sortCol, setSortCol] = useState<Column>('date')
  const [sortDesc, setSortDesc] = useState(true)

  const rows: Row[] = useMemo(
    () =>
      efforts.map(e => ({
        ...e,
        efficiency:
          e.avgPace != null && e.avgHr != null && e.avgPace > 0
            ? Math.round((1000 / e.avgPace / e.avgHr) * 100) / 100
            : null,
      })),
    [efforts],
  )

  const sorted = useMemo(() => {
    const out = [...rows]
    out.sort((a, b) => {
      const va = value(a, sortCol)
      const vb = value(b, sortCol)
      if (va === null && vb === null) return 0
      if (va === null) return 1 // null values sink regardless of direction
      if (vb === null) return -1
      return sortDesc ? vb - va : va - vb
    })
    return out
  }, [rows, sortCol, sortDesc])

  // Best value per column across rows that have one
  const best = useMemo(() => {
    const out = new Map<Column, number>()
    for (const col of ['elapsed', 'avgPace', 'avgGap', 'avgHr', 'efficiency'] as Column[]) {
      const values = rows.map(r => value(r, col)).filter((v): v is number => v !== null)
      if (values.length < 2) continue // one effort — "best" means nothing yet
      out.set(col, LOWER_IS_BETTER.has(col) ? Math.min(...values) : Math.max(...values))
    }
    return out
  }, [rows])

  function header(col: Column, label: string, title?: string) {
    const active = sortCol === col
    return (
      <th key={col} className="px-3 py-2 text-left font-medium whitespace-nowrap">
        <button
          onClick={() => {
            if (active) setSortDesc(d => !d)
            else {
              setSortCol(col)
              // Numbers where smaller = better read naturally ascending
              setSortDesc(col === 'date' || !LOWER_IS_BETTER.has(col))
            }
          }}
          title={title}
          className={`inline-flex items-center gap-1 transition-colors ${
            active ? 'text-zinc-900' : 'text-zinc-500 hover:text-zinc-900'
          }`}
        >
          {label}
          {active ? <span className="text-[10px]">{sortDesc ? '▼' : '▲'}</span> : null}
        </button>
      </th>
    )
  }

  function cell(row: Row, col: Column) {
    const v = value(row, col)
    const isBest = v !== null && best.get(col) === v
    const text =
      col === 'date'
        ? format(new Date(row.date), 'MMM d, yyyy')
        : v === null
          ? '—'
          : col === 'elapsed'
            ? formatDuration(row.elapsed)
            : col === 'avgHr'
              ? `${row.avgHr}`
              : col === 'efficiency'
                ? row.efficiency!.toFixed(2)
                : formatPace(v, unit)
    return (
      <td key={col} className="px-3 py-2 whitespace-nowrap">
        {isBest && col !== 'date' ? (
          <span className="inline-flex items-center rounded-full bg-amber-100 text-amber-800 font-semibold px-2 py-0.5">
            {text}
          </span>
        ) : (
          text
        )}
      </td>
    )
  }

  return (
    <div className="bg-white rounded-2xl border border-zinc-200 overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-zinc-100 text-xs text-zinc-500">
            {COLUMNS.map(c => header(c.key, c.label, c.title))}
          </tr>
        </thead>
        <tbody>
          {sorted.map(row => (
            <tr
              key={row.id}
              onClick={() => onSelect(row.id)}
              className={`border-b border-zinc-50 last:border-0 cursor-pointer transition-colors ${
                row.id === selectedId ? 'bg-zinc-100' : 'hover:bg-zinc-50'
              }`}
            >
              {COLUMNS.map(c => cell(row, c.key))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
