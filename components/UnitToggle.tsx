'use client'

import type { Unit } from '@/lib/units'

export default function UnitToggle({
  unit,
  onChange,
}: {
  unit: Unit
  onChange: (unit: Unit) => void
}) {
  return (
    <div className="inline-flex items-center rounded-lg border border-zinc-300 bg-white p-0.5">
      {(['mi', 'km'] as const).map(u => (
        <button
          key={u}
          onClick={() => onChange(u)}
          aria-pressed={unit === u}
          className={`px-2.5 py-1.5 text-sm font-medium rounded-md transition-colors ${
            unit === u ? 'bg-zinc-900 text-white' : 'text-zinc-500 hover:text-zinc-900'
          }`}
        >
          {u}
        </button>
      ))}
    </div>
  )
}
