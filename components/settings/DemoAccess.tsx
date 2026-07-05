'use client'

import { useEffect, useState } from 'react'

// Defaults mirrored from lib/activities.ts — shown when no window is saved yet.
const DEFAULT_FROM = '2026-01-01'
const DEFAULT_TO = '2026-03-31'

function toDateInput(iso: string | null): string {
  return iso ? iso.slice(0, 10) : ''
}

export default function DemoAccess() {
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null)

  useEffect(() => {
    fetch('/api/settings')
      .then(res => (res.ok ? res.json() : null))
      .then(data => {
        setFrom(toDateInput(data?.demoFromDate) || DEFAULT_FROM)
        setTo(toDateInput(data?.demoToDate) || DEFAULT_TO)
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
        body: JSON.stringify({ demoFromDate: from, demoToDate: to }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        setMessage({ kind: 'error', text: data?.error ?? 'Failed to save' })
      } else {
        setMessage({ kind: 'ok', text: 'Saved — the demo account now sees only this window.' })
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
    <div className="space-y-4">
      <p className="text-sm text-zinc-500">
        The demo account can only see runs inside this date window. Everything outside it —
        including direct links to individual runs — behaves as if it doesn&apos;t exist.
      </p>
      <div className="flex items-end gap-3 flex-wrap">
        <label className="block">
          <span className="block text-xs font-medium text-zinc-500 mb-1">From</span>
          <input
            type="date"
            value={from}
            max={to || undefined}
            onChange={e => setFrom(e.target.value)}
            className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-300"
          />
        </label>
        <label className="block">
          <span className="block text-xs font-medium text-zinc-500 mb-1">To</span>
          <input
            type="date"
            value={to}
            min={from || undefined}
            onChange={e => setTo(e.target.value)}
            className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-300"
          />
        </label>
        <button
          onClick={save}
          disabled={saving || !from || !to}
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
