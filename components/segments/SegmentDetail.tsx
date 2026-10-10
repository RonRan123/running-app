'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Scatter,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import ChartCard, { ChartEmpty } from '@/components/analysis/ChartCard'
import UnitToggle from '@/components/UnitToggle'
import { useUnit } from '@/lib/useUnit'
import { formatDistance, formatDuration, formatPace, KM_PER_MILE, type Unit } from '@/lib/units'
import type { SpeedPoint } from '@/lib/segments/series'
import SegmentsMap from './SegmentsMap'
import { segmentColor, SEGMENT_COLORS } from './palette'

export interface EffortView {
  id: string
  activityId: string
  runName: string
  date: string
  elapsedSec: number
  avgHeartRate: number | null
  apparentTempC: number | null
  rank: number
  series: SpeedPoint[]
}

interface SegmentInfo {
  id: string
  name: string
  pinned: boolean
  lengthM: number
  gainM: number | null
  geometry: { lat: number; lng: number }[]
  elevation: number[] | null
}

const MAX_COMPARE = 5
const FT_PER_M = 3.28084

/** min per km (or mi) from m/s. */
const paceFromSpeed = (speed: number, unit: Unit) =>
  (1000 / (speed * 60)) * (unit === 'mi' ? KM_PER_MILE : 1)
const paceFromEffort = (sec: number, meters: number) => sec / 60 / (meters / 1000)

function paceTick(v: number) {
  const m = Math.floor(v)
  const s = Math.round((v - m) * 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

function defaultSelection(efforts: EffortView[]) {
  const latest = efforts.slice(-3).map(e => e.id)
  const best = efforts.find(e => e.rank === 1)?.id
  return [...new Set([...(best ? [best] : []), ...latest])].slice(0, MAX_COMPARE)
}

export default function SegmentDetail({
  segment,
  efforts,
  isAdmin,
}: {
  segment: SegmentInfo
  efforts: EffortView[]
  isAdmin: boolean
}) {
  const router = useRouter()
  const { unit, changeUnit } = useUnit()
  const [selected, setSelected] = useState<string[]>(() => defaultSelection(efforts))
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(segment.name)
  const [saving, setSaving] = useState(false)

  async function save(patch: { name?: string; pinned?: boolean }) {
    setSaving(true)
    try {
      const res = await fetch(`/api/segments/${segment.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      })
      if (res.ok) {
        setEditing(false)
        router.refresh()
      }
    } finally {
      setSaving(false)
    }
  }

  function toggle(id: string) {
    setSelected(cur =>
      cur.includes(id) ? cur.filter(x => x !== id) : cur.length >= MAX_COMPARE ? cur : [...cur, id],
    )
  }

  // Colors follow selection order so a run keeps its color while others toggle.
  const colorOf = (id: string) => SEGMENT_COLORS[selected.indexOf(id) % SEGMENT_COLORS.length]

  const trend = efforts.map(e => ({
    ts: new Date(e.date).getTime(),
    pace: paceFromEffort(e.elapsedSec, segment.lengthM) * (unit === 'mi' ? KM_PER_MILE : 1),
    hr: e.avgHeartRate,
    name: e.runName,
  }))

  // One row per 20 m bin: elevation behind, one pace column per compared effort.
  const overlay = useMemo(() => {
    const rows = new Map<number, Record<string, number>>()
    const toUnit = (m: number) => (unit === 'mi' ? m / 1000 / KM_PER_MILE : m / 1000)
    if (segment.elevation) {
      segment.elevation.forEach((ele, i) => {
        if (i % 2 !== 0) return // geometry is every 10 m; bins are 20 m
        rows.set(i * 10, { d: toUnit(i * 10), ele: unit === 'mi' ? ele * FT_PER_M : ele })
      })
    }
    for (const e of efforts) {
      if (!selected.includes(e.id)) continue
      for (const p of e.series) {
        if (p.speed < 0.5) continue // standing still — not a pace
        const row = rows.get(p.d) ?? { d: toUnit(p.d) }
        row[e.id] = paceFromSpeed(p.speed, unit)
        rows.set(p.d, row)
      }
    }
    return [...rows.entries()].sort(([a], [b]) => a - b).map(([, r]) => r)
  }, [efforts, selected, segment.elevation, unit])

  const eleUnit = unit === 'mi' ? 'ft' : 'm'
  const byRank = [...efforts].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

  return (
    <div className="space-y-6">
      <Link
        href="/segments"
        className="inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-900 transition-colors"
      >
        <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        All segments
      </Link>

      <div className="flex items-end justify-between flex-wrap gap-3">
        <div className="min-w-0">
          {editing ? (
            <form
              onSubmit={e => {
                e.preventDefault()
                save({ name })
              }}
              className="flex items-center gap-2 flex-wrap"
            >
              <input
                value={name}
                onChange={e => setName(e.target.value)}
                maxLength={80}
                autoFocus
                className="text-xl font-semibold text-zinc-900 border border-zinc-300 rounded-lg px-2 py-1 min-w-0"
              />
              <button disabled={saving} className="text-sm font-medium text-zinc-900 hover:underline">
                Save
              </button>
              <button
                type="button"
                onClick={() => {
                  setName(segment.name)
                  setEditing(false)
                }}
                className="text-sm text-zinc-500 hover:text-zinc-900"
              >
                Cancel
              </button>
            </form>
          ) : (
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-semibold text-zinc-900">{segment.name}</h1>
              {isAdmin && (
                <>
                  <button onClick={() => setEditing(true)} className="text-sm text-zinc-500 hover:text-zinc-900">
                    Rename
                  </button>
                  <button
                    onClick={() => save({ pinned: !segment.pinned })}
                    disabled={saving}
                    className="text-sm text-zinc-500 hover:text-zinc-900"
                    title="Pinned segments are kept when segments are rediscovered"
                  >
                    {segment.pinned ? 'Unpin' : 'Pin'}
                  </button>
                </>
              )}
            </div>
          )}
          <p className="text-sm text-zinc-500 mt-1">
            {formatDistance(segment.lengthM / 1000, unit)}
            {segment.gainM !== null &&
              ` · ${unit === 'mi' ? Math.round(segment.gainM * FT_PER_M) : segment.gainM} ${eleUnit} climb`}
            {` · ${efforts.length} ${efforts.length === 1 ? 'effort' : 'efforts'}`}
          </p>
        </div>
        <UnitToggle unit={unit} onChange={changeUnit} />
      </div>

      <SegmentsMap
        segments={[{ id: segment.id, name: segment.name, color: segmentColor(0), geometry: segment.geometry }]}
        selectedId={segment.id}
        height="h-64"
      />

      <ChartCard
        title="Speed vs. Elevation"
        subtitle={`Pace along the segment for up to ${MAX_COMPARE} efforts (pick them in the table below), with the elevation profile behind. Every effort is mapped onto the segment's own distance, so hills line up.`}
      >
        {selected.length === 0 ? (
          <ChartEmpty message="Select efforts in the table below to compare them." />
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <ComposedChart data={overlay} margin={{ top: 8, right: 0, bottom: 4, left: -8 }}>
              <CartesianGrid stroke="#f4f4f5" />
              <XAxis
                dataKey="d"
                type="number"
                domain={[0, 'dataMax']}
                tickFormatter={d => d.toFixed(1)}
                tick={{ fontSize: 12, fill: '#a1a1aa' }}
                tickLine={false}
                axisLine={{ stroke: '#e4e4e7' }}
                unit={` ${unit}`}
              />
              <YAxis
                yAxisId="pace"
                reversed
                domain={['auto', 'auto']}
                tickFormatter={paceTick}
                tick={{ fontSize: 12, fill: '#a1a1aa' }}
                tickLine={false}
                axisLine={{ stroke: '#e4e4e7' }}
                width={56}
              />
              <YAxis
                yAxisId="ele"
                orientation="right"
                domain={['dataMin - 5', 'dataMax + 20']}
                tickFormatter={(v: number) => `${Math.round(v)}`}
                tick={{ fontSize: 11, fill: '#d4d4d8' }}
                tickLine={false}
                axisLine={false}
                unit={` ${eleUnit}`}
                width={56}
              />
              <Tooltip
                content={({ active, payload, label }) => {
                  if (!active || !payload?.length) return null
                  return (
                    <div className="bg-white border border-zinc-200 rounded-lg shadow-sm px-3 py-2 text-xs space-y-0.5">
                      <p className="text-zinc-500">
                        {(label as number).toFixed(2)} {unit}
                      </p>
                      {payload
                        .filter(p => p.dataKey !== 'ele' && typeof p.value === 'number')
                        .map(p => {
                          const e = efforts.find(x => x.id === p.dataKey)
                          return (
                            <p key={String(p.dataKey)} style={{ color: p.color }}>
                              {e ? format(new Date(e.date), 'MMM d, yyyy') : ''}: {paceTick(p.value as number)} /{unit}
                            </p>
                          )
                        })}
                      {payload.find(p => p.dataKey === 'ele') && (
                        <p className="text-zinc-400">
                          Elevation {Math.round(payload.find(p => p.dataKey === 'ele')!.value as number)} {eleUnit}
                        </p>
                      )}
                    </div>
                  )
                }}
              />
              {segment.elevation && (
                <Area
                  yAxisId="ele"
                  dataKey="ele"
                  type="monotone"
                  stroke="#d4d4d8"
                  fill="#f4f4f5"
                  fillOpacity={1}
                  isAnimationActive={false}
                  connectNulls
                />
              )}
              {selected.map(id => (
                <Line
                  key={id}
                  yAxisId="pace"
                  dataKey={id}
                  type="monotone"
                  stroke={colorOf(id)}
                  strokeWidth={2}
                  dot={false}
                  connectNulls
                  isAnimationActive={false}
                />
              ))}
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </ChartCard>

      <ChartCard
        title="Efforts Over Time"
        subtitle="Pace for every effort on this segment, with average heart rate. Faster at the same or lower heart rate means the aerobic engine is growing."
      >
        {trend.length < 2 ? (
          <ChartEmpty message="Need at least 2 efforts to show a trend." />
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <ComposedChart data={trend} margin={{ top: 8, right: 0, bottom: 4, left: -8 }}>
              <CartesianGrid stroke="#f4f4f5" />
              <XAxis
                dataKey="ts"
                type="number"
                domain={['dataMin', 'dataMax']}
                tickFormatter={ts => format(ts, 'MMM d')}
                tick={{ fontSize: 12, fill: '#a1a1aa' }}
                tickLine={false}
                axisLine={{ stroke: '#e4e4e7' }}
              />
              <YAxis
                yAxisId="pace"
                reversed
                domain={['auto', 'auto']}
                tickFormatter={paceTick}
                tick={{ fontSize: 12, fill: '#a1a1aa' }}
                tickLine={false}
                axisLine={{ stroke: '#e4e4e7' }}
                width={56}
              />
              <YAxis
                yAxisId="hr"
                orientation="right"
                domain={['auto', 'auto']}
                tick={{ fontSize: 11, fill: '#fda4af' }}
                tickLine={false}
                axisLine={false}
                unit=" bpm"
                width={64}
              />
              <Tooltip
                content={({ active, payload }) => {
                  const p = payload?.[0]?.payload as (typeof trend)[number] | undefined
                  if (!active || !p) return null
                  return (
                    <div className="bg-white border border-zinc-200 rounded-lg shadow-sm px-3 py-2 text-xs">
                      <p className="font-medium text-zinc-900">{p.name}</p>
                      <p className="text-zinc-500 mt-0.5">{format(p.ts, 'MMM d, yyyy')}</p>
                      <p className="text-zinc-700 mt-1">
                        {paceTick(p.pace)} /{unit}
                        {p.hr ? ` · ${Math.round(p.hr)} bpm` : ''}
                      </p>
                    </div>
                  )
                }}
              />
              <Line
                yAxisId="pace"
                dataKey="pace"
                stroke="#2563eb"
                strokeWidth={2}
                dot={{ r: 3, fill: '#2563eb', strokeWidth: 0 }}
                isAnimationActive={false}
              />
              <Scatter yAxisId="hr" dataKey="hr" fill="#fb7185" isAnimationActive={false} />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </ChartCard>

      <div className="bg-white rounded-2xl border border-zinc-200 overflow-hidden">
        <div className="px-5 pt-5 pb-3">
          <h2 className="text-sm font-semibold text-zinc-900">All Efforts</h2>
          <p className="text-xs text-zinc-500 mt-0.5">
            Tick up to {MAX_COMPARE} to compare in the speed vs. elevation chart. Rank is by time.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs text-zinc-400 border-y border-zinc-100">
              <tr>
                <th className="px-5 py-2 text-left font-medium w-8" />
                <th className="py-2 text-left font-medium">Date</th>
                <th className="py-2 text-right font-medium">Time</th>
                <th className="py-2 text-right font-medium">Pace</th>
                <th className="py-2 text-right font-medium">Avg HR</th>
                <th className="py-2 text-right font-medium hidden sm:table-cell">Feels like</th>
                <th className="px-5 py-2 text-right font-medium">Rank</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-50">
              {byRank.map(e => {
                const on = selected.includes(e.id)
                return (
                  <tr key={e.id} className="hover:bg-zinc-50">
                    <td className="px-5 py-2">
                      <input
                        type="checkbox"
                        checked={on}
                        disabled={!on && selected.length >= MAX_COMPARE}
                        onChange={() => toggle(e.id)}
                        aria-label={`Compare effort on ${format(new Date(e.date), 'MMM d, yyyy')}`}
                        style={on ? { accentColor: colorOf(e.id) } : undefined}
                      />
                    </td>
                    <td className="py-2">
                      <Link href={`/runs/${e.activityId}`} className="text-zinc-900 hover:underline">
                        {format(new Date(e.date), 'MMM d, yyyy')}
                      </Link>
                    </td>
                    <td className="py-2 text-right tabular-nums">{formatDuration(Math.round(e.elapsedSec))}</td>
                    <td className="py-2 text-right tabular-nums">
                      {formatPace(paceFromEffort(e.elapsedSec, segment.lengthM), unit)}
                    </td>
                    <td className="py-2 text-right tabular-nums">
                      {e.avgHeartRate ? Math.round(e.avgHeartRate) : '—'}
                    </td>
                    <td className="py-2 text-right tabular-nums hidden sm:table-cell">
                      {e.apparentTempC === null
                        ? '—'
                        : unit === 'mi'
                          ? `${Math.round(e.apparentTempC * 1.8 + 32)}°F`
                          : `${Math.round(e.apparentTempC)}°C`}
                    </td>
                    <td className="px-5 py-2 text-right tabular-nums">
                      {e.rank === 1 ? <span className="text-amber-600 font-medium">🏆 1</span> : e.rank}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
