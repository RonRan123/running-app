'use client'

import { useEffect, useState } from 'react'
import { DEFAULT_REST_HR } from '@/lib/analysis'

type Saved = { restingHr: number | null; maxHr: number | null }

export default function HeartRateSetting() {
  const [saved, setSaved] = useState<Saved>({ restingHr: null, maxHr: null })
  const [resting, setResting] = useState('')
  const [max, setMax] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null)

  function show(data: Saved) {
    setSaved({ restingHr: data.restingHr ?? null, maxHr: data.maxHr ?? null })
    setResting(data.restingHr?.toString() ?? '')
    setMax(data.maxHr?.toString() ?? '')
  }

  useEffect(() => {
    fetch('/api/settings')
      .then(res => (res.ok ? res.json() : null))
      .then(data => data && show(data))
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
        // An empty box clears the override.
        body: JSON.stringify({
          restingHr: resting === '' ? null : Number(resting),
          maxHr: max === '' ? null : Number(max),
        }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        setMessage({ kind: 'error', text: data?.error ?? 'Failed to save' })
      } else {
        show(data)
        setMessage({ kind: 'ok', text: 'Saved. Zones and training load now use these values.' })
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

  const unchanged =
    resting === (saved.restingHr?.toString() ?? '') && max === (saved.maxHr?.toString() ?? '')
  const input =
    'w-24 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-300'

  return (
    <div className="space-y-3">
      <p className="text-sm text-zinc-500">
        Optional. Left blank, training load uses a resting heart rate of {DEFAULT_REST_HR} bpm and a
        max of 220 − age (or your highest recorded max if that is higher). If you know your real
        numbers, enter them: max heart rate also moves where &ldquo;hard&rdquo; starts (87% of
        max). The easy and Zone 2 limits still come from your birthday.
      </p>
      <div className="flex items-end gap-3 flex-wrap">
        <label className="text-xs text-zinc-500">
          Resting (bpm)
          <input
            type="number"
            inputMode="numeric"
            min={30}
            max={100}
            value={resting}
            placeholder={String(DEFAULT_REST_HR)}
            onChange={e => setResting(e.target.value)}
            className={`${input} mt-1 block`}
          />
        </label>
        <label className="text-xs text-zinc-500">
          Max (bpm)
          <input
            type="number"
            inputMode="numeric"
            min={120}
            max={230}
            value={max}
            placeholder="auto"
            onChange={e => setMax(e.target.value)}
            className={`${input} mt-1 block`}
          />
        </label>
        <button
          onClick={save}
          disabled={saving || unchanged}
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
