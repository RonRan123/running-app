'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { KM_PER_MILE, type Unit } from '@/lib/units'
import type { WeeklyGoal, WeeklyGoalType } from '@/lib/activitySummary'

function toDisplay(goal: WeeklyGoal | null, unit: Unit): string {
  if (!goal) return ''
  if (goal.type === 'runs') return String(goal.target)
  const value = unit === 'mi' ? goal.target / KM_PER_MILE : goal.target
  return String(Math.round(value * 10) / 10)
}

/** Weekly run-count or distance target, shown as a ring in the runs-page sidebar. */
export default function WeeklyGoalCard({
  goal,
  unit,
  readOnly,
}: {
  goal: WeeklyGoal | null
  unit: Unit
  readOnly: boolean
}) {
  const router = useRouter()
  const [type, setType] = useState<WeeklyGoalType>(goal?.type ?? 'runs')
  const [value, setValue] = useState(() => toDisplay(goal, unit))
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null)

  async function put(body: object, okText: string) {
    setSaving(true)
    setMessage(null)
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        setMessage({ kind: 'error', text: data?.error ?? 'Failed to save' })
      } else {
        setMessage({ kind: 'ok', text: okText })
        router.refresh()
      }
    } catch {
      setMessage({ kind: 'error', text: 'Failed to save' })
    } finally {
      setSaving(false)
    }
  }

  function save() {
    const n = Number(value)
    // Distance goals are stored in km whatever unit they were entered in.
    const target = type === 'distance' && unit === 'mi' ? n * KM_PER_MILE : n
    put({ weeklyGoalType: type, weeklyGoalTarget: target }, 'Saved. Track it in the sidebar on the Runs page.')
  }

  function clear() {
    setValue('')
    put({ weeklyGoalType: null }, 'Weekly goal removed.')
  }

  const inputLabel = type === 'runs' ? 'runs per week' : `${unit} per week`

  return (
    <div id="weekly-goal" className="bg-white rounded-2xl border border-zinc-200 p-5 space-y-3 scroll-mt-24">
      <p className="text-sm text-zinc-500">
        A target for every Mon–Sun week, either a number of runs or a distance. Progress shows as a
        ring in the sidebar on the Runs page and resets each Monday.
      </p>
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex rounded-lg border border-zinc-200 p-0.5" role="group" aria-label="Goal type">
          {(['runs', 'distance'] as const).map(t => (
            <button
              key={t}
              onClick={() => setType(t)}
              disabled={readOnly}
              aria-pressed={type === t}
              className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                type === t ? 'bg-zinc-900 text-white' : 'text-zinc-500 hover:text-zinc-900'
              }`}
            >
              {t === 'runs' ? 'Runs' : 'Distance'}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-2 text-sm text-zinc-500">
          <input
            type="number"
            inputMode="decimal"
            min={type === 'runs' ? 1 : 0.1}
            max={type === 'runs' ? 14 : undefined}
            step={type === 'runs' ? 1 : 0.1}
            value={value}
            onChange={e => setValue(e.target.value)}
            disabled={readOnly}
            className="w-24 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-300"
          />
          {inputLabel}
        </label>
        <button
          onClick={save}
          disabled={readOnly || saving || value === '' || Number(value) <= 0}
          className="rounded-lg bg-zinc-900 text-white text-sm font-medium px-4 py-2 hover:bg-zinc-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
        {goal && !readOnly && (
          <button
            onClick={clear}
            disabled={saving}
            className="text-sm text-zinc-500 hover:text-zinc-900 underline underline-offset-2"
          >
            Remove goal
          </button>
        )}
      </div>
      {readOnly && <p className="text-xs text-zinc-400">The demo account can&apos;t change goals.</p>}
      {message && (
        <p className={`text-sm ${message.kind === 'ok' ? 'text-emerald-600' : 'text-rose-600'}`}>
          {message.text}
        </p>
      )}
    </div>
  )
}
