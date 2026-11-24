'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { format, parseISO } from 'date-fns'

type Level = 1 | 2 | 3

const QUESTIONS = [
  { key: 'effort', q: 'How hard did the week feel?', options: ['Easy', 'Medium', 'Hard'], required: true },
  { key: 'freshness', q: 'How fresh do you feel now?', options: ['Drained', 'Okay', 'Fresh'], required: true },
  { key: 'soreness', q: 'Any soreness?', options: ['None', 'Normal muscle soreness', 'Pain in one spot'], required: true },
  { key: 'enjoyment', q: 'Did you enjoy it? (optional)', options: ['A chore', 'Fine', 'Loved it'], required: false },
] as const

type Answers = Partial<Record<(typeof QUESTIONS)[number]['key'], Level>>

/**
 * End-of-week check-in. Optional and quick: it can only make the plan
 * gentler (hold, cutback, drop the workout, swap in a free run), never harder.
 */
export default function CheckInCard({ weekStart, weekNumber }: { weekStart: string; weekNumber: number }) {
  const router = useRouter()
  const [answers, setAnswers] = useState<Answers>({})
  const [note, setNote] = useState('')
  const [hidden, setHidden] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (hidden) return null
  const ready = answers.effort && answers.freshness && answers.soreness

  async function save() {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/checkins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ weekStart, ...answers, enjoyment: answers.enjoyment ?? null, note }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Could not save')
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save')
      setSaving(false)
    }
  }

  return (
    <section className="bg-white rounded-2xl border border-zinc-200 p-5 space-y-4" aria-labelledby="checkin-title">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 id="checkin-title" className="text-sm font-semibold text-zinc-900">
            How did week {weekNumber} feel?
          </h2>
          <p className="text-xs text-zinc-500 mt-0.5">
            {format(parseISO(weekStart), 'MMM d')} week · 10 seconds, optional. Your answers can only make next week
            gentler, never harder.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setHidden(true)}
          className="text-xs text-zinc-500 hover:text-zinc-900 min-h-11 px-2"
        >
          Skip
        </button>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {QUESTIONS.map(({ key, q, options }) => (
          <fieldset key={key}>
            <legend className="text-sm text-zinc-700 mb-1.5">{q}</legend>
            <div className="flex flex-wrap gap-2">
              {options.map((label, i) => {
                const value = (i + 1) as Level
                const on = answers[key] === value
                return (
                  <button
                    key={label}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setAnswers(a => ({ ...a, [key]: on && key === 'enjoyment' ? undefined : value }))}
                    className={`min-h-11 rounded-lg border px-3 text-sm transition-colors ${
                      on ? 'border-zinc-900 bg-zinc-900 text-white' : 'border-zinc-300 bg-white text-zinc-700 hover:border-zinc-500'
                    }`}
                  >
                    {label}
                  </button>
                )
              })}
            </div>
          </fieldset>
        ))}
      </div>
      <div>
        <label htmlFor="checkin-note" className="text-sm text-zinc-700">
          Anything else? (optional)
        </label>
        <input
          id="checkin-note"
          value={note}
          onChange={e => setNote(e.target.value)}
          maxLength={500}
          placeholder="e.g. left calf tight after Thursday"
          className="mt-1.5 w-full rounded-lg border border-zinc-300 px-3 min-h-11 text-sm"
        />
      </div>
      {answers.soreness === 3 && (
        <p className="text-sm text-orange-800 bg-orange-50 rounded-lg px-3 py-2">
          Next week drops to 80% with no workout, hills or strides. If the pain changes how you run or lasts more than
          a few days, see a physio before pushing on.
        </p>
      )}
      {error && <p className="text-sm text-red-700">{error}</p>}
      <button
        type="button"
        onClick={save}
        disabled={!ready || saving}
        className="min-h-11 rounded-lg bg-zinc-900 px-4 text-sm font-medium text-white disabled:opacity-40"
      >
        {saving ? 'Saving…' : 'Save check-in'}
      </button>
    </section>
  )
}
