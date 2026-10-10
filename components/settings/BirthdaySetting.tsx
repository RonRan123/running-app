'use client'

import { useEffect, useState } from 'react'
import { format, parseISO } from 'date-fns'
import { ageOn, zonesOn, type HrProfile } from '@/lib/analysis'

export default function BirthdaySetting() {
  const [birthDate, setBirthDate] = useState<string | null>(null)
  const [legacyAge, setLegacyAge] = useState<number | null>(null)
  const [value, setValue] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null)

  useEffect(() => {
    fetch('/api/settings')
      .then(res => (res.ok ? res.json() : null))
      .then(data => {
        if (typeof data?.birthDate === 'string') {
          setBirthDate(data.birthDate)
          setValue(data.birthDate)
        }
        if (typeof data?.age === 'number') setLegacyAge(data.age)
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
        body: JSON.stringify({ birthDate: value }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        setMessage({ kind: 'error', text: data?.error ?? 'Failed to save' })
      } else {
        setBirthDate(data.birthDate)
        setMessage({ kind: 'ok', text: 'Saved. Zones for every run are recalculated from your age on that day.' })
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

  // Today's zones (recorded max doesn't affect the age-based thresholds shown).
  const profile: HrProfile = { birthDate, age: legacyAge, recordedMax: 0 }
  const age = ageOn(profile, new Date())
  const zones = age != null ? zonesOn(profile, new Date()) : null

  return (
    <div className="space-y-3">
      <p className="text-sm text-zinc-500">
        Your birthday sets every heart-rate zone in the app, using your age on the day of each
        run, so getting older never changes the zones of runs you&apos;ve already done. Easy is at
        or below your Maffetone (MAF) target of 180 − age (also drawn as a band on each run&apos;s
        heart rate chart), Zone 2 is the 10 beats below it, and hard starts at 87% of your
        age-predicted max (220 − age).
        {zones && (
          <span className="text-zinc-900 font-medium">
            {' '}
            Today (age {age}): easy ≤ {zones.easyMax} bpm, Zone 2 {zones.zone2Min}–{zones.easyMax}{' '}
            bpm, hard ≥ {zones.hardMin} bpm.
          </span>
        )}
      </p>
      {!birthDate && legacyAge != null && (
        <p className="text-sm text-amber-700">
          You&apos;ve set a fixed age ({legacyAge}), which applies to every run regardless of date.
          Add your birthday to have past runs use the age you were then.
        </p>
      )}
      <div className="flex items-center gap-3 flex-wrap">
        <input
          type="date"
          value={value}
          max={format(new Date(), 'yyyy-MM-dd')}
          onChange={e => setValue(e.target.value)}
          aria-label="Birthday"
          className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-300"
        />
        <button
          onClick={save}
          disabled={saving || value === '' || value === birthDate}
          className="rounded-lg bg-zinc-900 text-white text-sm font-medium px-4 py-2 hover:bg-zinc-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
        {birthDate && (
          <span className="text-xs text-zinc-400">Saved: {format(parseISO(birthDate), 'MMMM d, yyyy')}</span>
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
