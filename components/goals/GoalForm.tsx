'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { KM_PER_MILE } from '@/lib/units'

const DISTANCE_PRESETS = [
  { label: '5K', km: 5 },
  { label: '10K', km: 10 },
  { label: 'Half Marathon', km: 21.0975 },
  { label: 'Marathon', km: 42.195 },
]

function parseTimeToSeconds(value: string): number | null {
  const parts = value.split(':').map(p => Number(p))
  if (parts.some(p => isNaN(p) || p < 0)) return null
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2]
  if (parts.length === 2) return parts[0] * 60 + parts[1]
  return null
}

export default function GoalForm() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [date, setDate] = useState('')
  const [distanceKm, setDistanceKm] = useState<number | 'custom'>(42.195)
  const [customMiles, setCustomMiles] = useState('')
  const [time, setTime] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    const goalTime = parseTimeToSeconds(time)
    if (goalTime == null) {
      setError('Goal time must look like 3:30:00 or 45:00')
      return
    }
    const distance =
      distanceKm === 'custom' ? Number(customMiles) * KM_PER_MILE : distanceKm
    if (!(distance > 0)) {
      setError('Enter a custom distance in miles')
      return
    }

    setSaving(true)
    try {
      const res = await fetch('/api/goals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, date, distance, goalTime }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to save goal')
      setOpen(false)
      setName('')
      setDate('')
      setTime('')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save goal')
    } finally {
      setSaving(false)
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-lg border border-dashed border-zinc-300 text-sm text-zinc-500 hover:text-zinc-900 hover:border-zinc-400 transition-colors px-4 py-3 w-full"
      >
        + Add race goal
      </button>
    )
  }

  return (
    <form onSubmit={submit} className="bg-white rounded-2xl border border-zinc-200 p-5 space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="text-xs text-zinc-500 font-medium">Race name</span>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            required
            placeholder="NYC Marathon"
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
          />
        </label>
        <label className="block">
          <span className="text-xs text-zinc-500 font-medium">Race date</span>
          <input
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            required
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
          />
        </label>
        <label className="block">
          <span className="text-xs text-zinc-500 font-medium">Distance</span>
          <select
            value={distanceKm === 'custom' ? 'custom' : String(distanceKm)}
            onChange={e =>
              setDistanceKm(e.target.value === 'custom' ? 'custom' : Number(e.target.value))
            }
            className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm"
          >
            {DISTANCE_PRESETS.map(d => (
              <option key={d.label} value={d.km}>
                {d.label}
              </option>
            ))}
            <option value="custom">Custom…</option>
          </select>
        </label>
        {distanceKm === 'custom' ? (
          <label className="block">
            <span className="text-xs text-zinc-500 font-medium">Custom distance (miles)</span>
            <input
              type="number"
              step="0.1"
              min="0.1"
              value={customMiles}
              onChange={e => setCustomMiles(e.target.value)}
              required
              className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
            />
          </label>
        ) : null}
        <label className="block">
          <span className="text-xs text-zinc-500 font-medium">Goal time (h:mm:ss)</span>
          <input
            value={time}
            onChange={e => setTime(e.target.value)}
            required
            placeholder="3:30:00"
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
          />
        </label>
      </div>
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-zinc-900 text-white px-4 py-2 text-sm font-medium disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save goal'}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-sm text-zinc-500 hover:text-zinc-900 transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  )
}
