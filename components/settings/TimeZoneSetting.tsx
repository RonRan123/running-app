'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { DEFAULT_TIME_ZONE } from '@/lib/activitySummary'

export default function TimeZoneSetting() {
  const router = useRouter()
  const [saved, setSaved] = useState(DEFAULT_TIME_ZONE)
  const [value, setValue] = useState(DEFAULT_TIME_ZONE)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null)

  const zones = useMemo(() => {
    const all = Intl.supportedValuesOf('timeZone')
    // Some runtimes list "UTC" separately from the canonical zones.
    return all.includes(saved) ? all : [saved, ...all]
  }, [saved])
  const browserZone = useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone, [])

  useEffect(() => {
    fetch('/api/settings')
      .then(res => (res.ok ? res.json() : null))
      .then(data => {
        if (typeof data?.timeZone === 'string') {
          setSaved(data.timeZone)
          setValue(data.timeZone)
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
        body: JSON.stringify({ timeZone: value }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        setMessage({ kind: 'error', text: data?.error ?? 'Failed to save' })
      } else {
        setSaved(data.timeZone)
        setMessage({ kind: 'ok', text: 'Saved. The runs-page sidebar now uses this time zone.' })
        router.refresh()
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
        Decides which day, week and month a run belongs to in the activity sidebar on the Runs
        page (streak, this week, weekly goal, month calendar). A run at 11 pm counts on the day
        it was in this time zone.
      </p>
      <div className="flex items-center gap-3 flex-wrap">
        <select
          value={value}
          onChange={e => setValue(e.target.value)}
          aria-label="Time zone"
          className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-300 max-w-full"
        >
          {zones.map(z => (
            <option key={z} value={z}>
              {z.replaceAll('_', ' ')}
            </option>
          ))}
        </select>
        <button
          onClick={save}
          disabled={saving || value === saved}
          className="rounded-lg bg-zinc-900 text-white text-sm font-medium px-4 py-2 hover:bg-zinc-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
        {browserZone && browserZone !== value && (
          <button
            onClick={() => setValue(browserZone)}
            className="text-xs text-zinc-500 hover:text-zinc-900 underline underline-offset-2"
          >
            Use this device&apos;s ({browserZone.replaceAll('_', ' ')})
          </button>
        )}
      </div>
      {message && (
        <p className={`text-sm ${message.kind === 'ok' ? 'text-emerald-600' : 'text-rose-600'}`}>
          {message.text}
        </p>
      )}
    </div>
  )
}
