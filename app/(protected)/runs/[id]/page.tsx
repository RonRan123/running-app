import { prisma } from '@/lib/prisma'
import { notFound } from 'next/navigation'
import { format } from 'date-fns'
import Link from 'next/link'
import RouteMap, { type RoutePoint } from '@/components/RouteMap'
import RunDetailStats from '@/components/RunDetailStats'
import { bestEfforts, type EffortActivity } from '@/lib/records'
import { formatDuration } from '@/lib/units'

function asNumberArray(value: unknown): number[] | null {
  return Array.isArray(value) && value.every(v => typeof v === 'number')
    ? (value as number[])
    : null
}

/** Labels of the PR targets this run currently holds the record for. */
async function currentPrLabels(activityId: string): Promise<string[]> {
  const activities = await prisma.activity.findMany({
    select: {
      id: true,
      name: true,
      date: true,
      distance: true,
      duration: true,
      stream: { select: { time: true, distance: true } },
    },
  })
  const effortActivities: EffortActivity[] = activities.map(a => {
    const time = a.stream ? asNumberArray(a.stream.time) : null
    const distance = a.stream ? asNumberArray(a.stream.distance) : null
    return {
      id: a.id,
      name: a.name,
      date: a.date.toISOString(),
      distance: a.distance,
      duration: a.duration,
      streams: time && distance ? { time, distance } : null,
    }
  })
  return bestEfforts(effortActivities)
    .filter(r => r.best.activityId === activityId)
    .map(r => r.target.label)
}

function parseCoordinates(value: unknown): RoutePoint[] {
  if (!Array.isArray(value)) return []
  return (value as unknown[]).filter(
    (p): p is RoutePoint =>
      typeof p === 'object' &&
      p !== null &&
      typeof (p as RoutePoint).lat === 'number' &&
      typeof (p as RoutePoint).lng === 'number',
  )
}

export default async function RunDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const activity = await prisma.activity.findUnique({ where: { id } })
  if (!activity) notFound()

  const coordinates = parseCoordinates(activity.coordinates as unknown)
  const prLabels = await currentPrLabels(id)
  const segmentEfforts = await prisma.segmentEffort.findMany({
    where: { activityId: id },
    include: { segment: { select: { id: true, name: true, distance: true } } },
    orderBy: { segment: { createdAt: 'desc' } },
  })

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
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <p className="text-sm text-zinc-500">
            {format(new Date(activity.date), 'EEEE, MMMM d, yyyy')}
          </p>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            <h1 className="text-2xl font-semibold text-zinc-900">{activity.name}</h1>
            {prLabels.map(label => (
              <span
                key={label}
                className="inline-flex items-center rounded-full bg-amber-100 text-amber-800 text-xs font-semibold px-2.5 py-0.5"
                title={`Current personal record for ${label}`}
              >
                {label} PR
              </span>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-4">
          {coordinates.length > 0 ? (
            <Link
              href={`/segments/new?run=${activity.id}`}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-zinc-900 hover:text-zinc-600 transition-colors"
            >
              Create segment
              <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
            </Link>
          ) : null}
          <Link
            href={`/deep-dive?run=${activity.id}`}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-zinc-900 hover:text-zinc-600 transition-colors"
          >
            Deep dive
            <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        </div>
      </div>

      {/* Stats grid — client component so it follows the stored mi/km preference */}
      <RunDetailStats
        distance={activity.distance}
        duration={activity.duration}
        avgPace={activity.avgPace}
        avgHeartRate={activity.avgHeartRate}
        maxHeartRate={activity.maxHeartRate}
        sport={activity.sport}
        source={activity.source}
      />

      {/* Route map */}
      {coordinates.length > 0 ? (
        <div className="bg-white rounded-2xl border border-zinc-200 p-6">
          <p className="text-sm font-medium text-zinc-500 mb-3">Route</p>
          <RouteMap coordinates={coordinates} />
        </div>
      ) : null}

      {/* Segments this run matched */}
      {segmentEfforts.length > 0 ? (
        <div className="bg-white rounded-2xl border border-zinc-200 p-6">
          <p className="text-sm font-medium text-zinc-500 mb-3">Segments on this run</p>
          <ul className="divide-y divide-zinc-50">
            {segmentEfforts.map(e => (
              <li key={e.id}>
                <Link
                  href={`/segments?segment=${e.segment.id}`}
                  className="flex items-center justify-between py-2.5 text-sm group"
                >
                  <span className="font-medium text-zinc-900 group-hover:text-zinc-600 transition-colors">
                    {e.segment.name}
                  </span>
                  <span className="text-zinc-500">
                    {formatDuration(e.elapsed)}
                    {e.avgHr != null ? ` · ${e.avgHr} bpm` : ''}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  )
}
