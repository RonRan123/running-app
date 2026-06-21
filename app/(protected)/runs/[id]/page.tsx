import { prisma } from '@/lib/prisma'
import { notFound } from 'next/navigation'
import { format } from 'date-fns'
import Link from 'next/link'
import RouteMap, { type RoutePoint } from '@/components/RouteMap'
import RunDetailStats from '@/components/RunDetailStats'
import RunDeepDive from '@/components/deepdive/RunDeepDive'
import { bestEfforts, type EffortActivity } from '@/lib/records'
import { estimateMaxHr, trimp } from '@/lib/analysis'
import { computeSplits, downsampleStreams, type RunStreams } from '@/lib/runAnalysis'
import { KM_PER_MILE } from '@/lib/units'

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

  const [activity, settings, allActivities] = await Promise.all([
    prisma.activity.findUnique({ where: { id }, include: { stream: true } }),
    prisma.userSettings.findUnique({ where: { id: 1 } }),
    prisma.activity.findMany({
      orderBy: { date: 'desc' },
      select: { id: true, name: true, date: true, distance: true, duration: true, avgPace: true, avgHeartRate: true, maxHeartRate: true },
    }),
  ])

  if (!activity) notFound()

  const coordinates = parseCoordinates(activity.coordinates as unknown)
  const prLabels = await currentPrLabels(id)

  // Build stream data for deep dive
  let streams: RunStreams | null = null
  if (activity.stream) {
    const time = asNumberArray(activity.stream.time)
    if (time) {
      streams = {
        time,
        heartrate: asNumberArray(activity.stream.heartrate),
        velocity: asNumberArray(activity.stream.velocity),
        altitude: asNumberArray(activity.stream.altitude),
        cadence: asNumberArray(activity.stream.cadence),
        distance: asNumberArray(activity.stream.distance),
      }
    }
  }

  const analysisActivities = allActivities.map(a => ({ ...a, date: a.date.toISOString() }))
  const maxHr = estimateMaxHr(analysisActivities)
  const activityForTrimp = { ...activity, date: activity.date.toISOString(), avgPace: activity.avgPace, avgHeartRate: activity.avgHeartRate, maxHeartRate: activity.maxHeartRate, name: activity.name }
  const runTrimp = activity.avgHeartRate ? trimp(activityForTrimp, maxHr) : null

  const splitsMi = streams ? computeSplits(streams, KM_PER_MILE * 1000) : []
  const splitsKm = streams ? computeSplits(streams, 1000) : []
  const chartStreams = streams ? downsampleStreams(streams) : null

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
      </div>

      {/* Stats grid */}
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

      {/* Deep Dive */}
      <RunDeepDive
        activity={{
          distance: activity.distance,
          duration: activity.duration,
          avgPace: activity.avgPace,
          avgHeartRate: activity.avgHeartRate,
          maxHeartRate: activity.maxHeartRate,
        }}
        streams={chartStreams}
        splitsMi={splitsMi}
        splitsKm={splitsKm}
        trimp={runTrimp}
        maxHr={maxHr}
        initialAge={settings?.age ?? null}
      />
    </div>
  )
}
