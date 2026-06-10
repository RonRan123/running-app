import { prisma } from '@/lib/prisma'
import { notFound } from 'next/navigation'
import { format } from 'date-fns'
import Link from 'next/link'

function formatDuration(seconds: number) {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${m}:${String(s).padStart(2, '0')}`
}

function formatPace(minPerKm: number) {
  const m = Math.floor(minPerKm)
  const s = Math.round((minPerKm - m) * 60)
  return `${m}:${String(s).padStart(2, '0')} /km`
}

export default async function RunDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const activity = await prisma.activity.findUnique({ where: { id } })
  if (!activity) notFound()

  const stats = [
    {
      label: 'Distance',
      value: `${activity.distance.toFixed(2)} km`,
    },
    {
      label: 'Duration',
      value: formatDuration(activity.duration),
    },
    {
      label: 'Avg Pace',
      value: activity.avgPace ? formatPace(activity.avgPace) : '—',
    },
    {
      label: 'Avg Heart Rate',
      value: activity.avgHeartRate ? `${activity.avgHeartRate} bpm` : '—',
    },
    {
      label: 'Max Heart Rate',
      value: activity.maxHeartRate ? `${activity.maxHeartRate} bpm` : '—',
    },
    {
      label: 'Sport',
      value: activity.sport,
    },
    {
      label: 'Source',
      value: activity.source === 'intervals' ? 'Intervals.icu' : 'Uploaded file',
    },
  ]

  return (
    <div className="space-y-6">
      {/* Back */}
      <Link
        href="/runs"
        className="inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-900 transition-colors"
      >
        <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        All runs
      </Link>

      {/* Header */}
      <div>
        <p className="text-sm text-zinc-500">
          {format(new Date(activity.date), 'EEEE, MMMM d, yyyy')}
        </p>
        <h1 className="text-2xl font-semibold text-zinc-900 mt-0.5">{activity.name}</h1>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {stats.map(stat => (
          <div
            key={stat.label}
            className="bg-white rounded-xl border border-zinc-200 px-4 py-4"
          >
            <p className="text-xs text-zinc-400 uppercase tracking-wide font-medium mb-1">
              {stat.label}
            </p>
            <p className="text-lg font-semibold text-zinc-900 tabular-nums">{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Map placeholder — removed in Wave 3 and replaced with actual map */}
      {Array.isArray(activity.coordinates) && (activity.coordinates as unknown[]).length > 0 ? (
        <div className="bg-white rounded-2xl border border-zinc-200 p-6">
          <p className="text-sm font-medium text-zinc-500 mb-1">Route</p>
          <div className="h-56 rounded-lg bg-zinc-50 flex items-center justify-center text-zinc-300 text-sm">
            Map coming in Wave 3
          </div>
        </div>
      ) : null}
    </div>
  )
}
