'use client'

import { useEffect, useState } from 'react'
import { mafTarget } from '@/lib/runAnalysis'

export default function AgeSetting() {
  const [age, setAge] = useState<number | null>(null)
  const [value, setValue] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null)

  useEffect(() => {
    fetch('/api/settings')
      .then(res => (res.ok ? res.json() : null))
      .then(data => {
        if (typeof data?.age === 'number') {
          setAge(data.age)
          setValue(String(data.age))
        }
      })
      .catch(() => null)
      .finally(() => setLoading(false))
  }, [])

  async function save() {
    setSaving(true)
    setMessage(null)
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ age: Number(value) }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        setMessage({ kind: 'error', text: data?.error ?? 'Failed to save' })
      } else {
        setAge(data.age)
        setMessage({ kind: 'ok', text: 'Saved.' })
      }
    } catch {
      setMessage({ kind: 'error', text: 'Failed to save' })
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <p className="text-sm text-zinc-400">Loading…</p>
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-zinc-500">
        Your age sets the Maffetone (MAF) aerobic target — 180 − age — drawn as a band on every
        run&apos;s heart rate chart.
        {age != null && (
          <span className="text-zinc-900 font-medium"> Current target: {mafTarget(age)} bpm.</span>
        )}
      </p>
      <div className="flex items-center gap-3">
        <input
          type="number"
          min={10}
          max={100}
          value={value}
          onChange={e => setValue(e.target.value)}
          placeholder="Age"
          className="w-24 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-300"
        />
        <button
          onClick={save}
          disabled={saving || value === ''}
          className="rounded-lg bg-zinc-900 text-white text-sm font-medium px-4 py-2 hover:bg-zinc-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
      {message && (
        <p className={`text-sm ${message.kind === 'ok' ? 'text-emerald-600' : 'text-rose-600'}`}>
          {message.text}
        </p>
      )}
    </div>
  )
}
