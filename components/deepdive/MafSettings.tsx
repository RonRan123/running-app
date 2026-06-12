'use client'

import { useState } from 'react'
import { mafTarget } from '@/lib/runAnalysis'

export default function MafSettings({
  age,
  onSaved,
}: {
  age: number | null
  onSaved: (age: number) => void
}) {
  const [editing, setEditing] = useState(age == null)
  const [value, setValue] = useState(age != null ? String(age) : '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function save() {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ age: Number(value) }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to save')
      onSaved(data.age)
      setEditing(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-zinc-200 px-5 py-4 flex items-center justify-between flex-wrap gap-3">
      <div>
        <p className="text-sm font-semibold text-zinc-900">Maffetone target (MAF)</p>
        <p className="text-xs text-zinc-500 mt-0.5">
          {age != null
            ? `180 − ${age} = ${mafTarget(age)} bpm — keep easy runs at or below this to build your aerobic engine.`
            : 'Enter your age to draw the 180 − age target band on the heart rate chart.'}
        </p>
        {error ? <p className="text-xs text-red-600 mt-1">{error}</p> : null}
      </div>
      {editing ? (
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={10}
            max={100}
            value={value}
            onChange={e => setValue(e.target.value)}
            placeholder="Age"
            className="w-20 rounded-lg border border-zinc-300 px-3 py-1.5 text-sm"
          />
          <button
            onClick={save}
            disabled={saving || value === ''}
            className="rounded-lg bg-zinc-900 text-white px-3 py-1.5 text-sm font-medium disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      ) : (
        <button
          onClick={() => setEditing(true)}
          className="text-sm text-zinc-500 hover:text-zinc-900 transition-colors"
        >
          Edit age
        </button>
      )}
    </div>
  )
}
