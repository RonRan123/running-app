'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import UnitToggle from '@/components/UnitToggle'
import { useUnit } from '@/lib/useUnit'
import { formatDistance, formatDuration, formatPace } from '@/lib/units'
import SegmentsMap from './SegmentsMap'
import { segmentColor } from './palette'

export interface SegmentSummary {
  id: string
  name: string
  pinned: boolean
  lengthM: number
  gainM: number | null
  geometry: { lat: number; lng: number }[]
  efforts: number
  runs: number
  bestSec: number
  latestSec: number
  latestDate: string
}

const paceOf = (sec: number, meters: number) => sec / 60 / (meters / 1000)

export default function SegmentsView({
  segments,
  isAdmin,
}: {
  segments: SegmentSummary[]
  isAdmin: boolean
}) {
  const router = useRouter()
  const { unit, changeUnit } = useUnit()
  const [selected, setSelected] = useState<string | null>(segments[0]?.id ?? null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  async function rediscover() {
    setBusy(true)
    setMessage(null)
    try {
      const res = await fetch('/api/segments/rediscover', { method: 'POST' })
      const data = await res.json()
      setMessage(res.ok ? `Found ${data.segments} segments` : (data.error ?? 'Rediscovery failed'))
      router.refresh()
    } catch {
      setMessage('Rediscovery failed — check connection')
    } finally {
      setBusy(false)
    }
  }

  const mapSegments = segments.map((s, i) => ({ ...s, color: segmentColor(i) }))

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900">Segments</h1>
          <p className="text-sm text-zinc-500 mt-0.5">
            The stretches you run most often, found automatically by overlaying all your runs.
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {message && <span className="text-sm text-zinc-500">{message}</span>}
          {isAdmin && (
            <button
              onClick={rediscover}
              disabled={busy}
              className="inline-flex items-center gap-2 bg-white border border-zinc-300 text-zinc-700 rounded-lg px-3 py-2 text-sm font-medium hover:bg-zinc-50 disabled:opacity-50 transition-colors"
            >
              {busy && (
                <span className="h-4 w-4 rounded-full border-2 border-zinc-300 border-t-zinc-700 animate-spin" />
              )}
              {busy ? 'Finding segments…' : 'Rediscover'}
            </button>
          )}
          <UnitToggle unit={unit} onChange={changeUnit} />
        </div>
      </div>

      {segments.length === 0 ? (
        <div className="bg-white rounded-2xl border border-zinc-200 p-12 text-center text-sm text-zinc-400">
          No segments yet.{' '}
          {isAdmin
            ? 'Press Rediscover to find the stretches you run most often.'
            : 'None of the discovered segments were run in this date range.'}
        </div>
      ) : (
        <>
          <SegmentsMap segments={mapSegments} selectedId={selected} onSelect={setSelected} />

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {mapSegments.map(s => (
              <div
                key={s.id}
                onClick={() => setSelected(s.id)}
                className={`bg-white rounded-2xl border p-4 cursor-pointer transition-colors ${
                  selected === s.id ? 'border-zinc-900' : 'border-zinc-200 hover:border-zinc-300'
                }`}
              >
                <div className="flex items-start gap-2">
                  <span className="mt-1.5 h-2.5 w-2.5 rounded-full shrink-0" style={{ background: s.color }} />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-zinc-900 truncate">
                      {s.name}
                      {s.pinned && <span className="ml-1.5 text-xs text-zinc-400">· pinned</span>}
                    </p>
                    <p className="text-xs text-zinc-500 mt-0.5">
                      {formatDistance(s.lengthM / 1000, unit)}
                      {s.gainM !== null && ` · ${unit === 'mi' ? Math.round(s.gainM * 3.28084) + ' ft' : s.gainM + ' m'} climb`}
                      {` · ${s.runs} ${s.runs === 1 ? 'run' : 'runs'}`}
                    </p>
                  </div>
                </div>
                <dl className="grid grid-cols-2 gap-2 mt-3 text-xs">
                  <div>
                    <dt className="text-zinc-400">Best</dt>
                    <dd className="text-zinc-900 font-medium">
                      {formatDuration(Math.round(s.bestSec))} · {formatPace(paceOf(s.bestSec, s.lengthM), unit)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-zinc-400">Latest · {format(new Date(s.latestDate), 'MMM d')}</dt>
                    <dd className="text-zinc-900 font-medium">
                      {formatDuration(Math.round(s.latestSec))} · {formatPace(paceOf(s.latestSec, s.lengthM), unit)}
                    </dd>
                  </div>
                </dl>
                <Link
                  href={`/segments/${s.id}`}
                  onClick={e => e.stopPropagation()}
                  className="inline-block mt-3 text-sm font-medium text-zinc-900 hover:underline"
                >
                  View efforts →
                </Link>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
