import { prisma } from '@/lib/prisma'
import { matchRun, type LatLng, type SegmentGeometry } from '@/lib/segments'
import type { RunStreams } from '@/lib/runAnalysis'

export function asNumberArray(value: unknown): number[] | null {
  return Array.isArray(value) && value.every(v => typeof v === 'number')
    ? (value as number[])
    : null
}

export function parseCoords(value: unknown): LatLng[] {
  if (!Array.isArray(value)) return []
  return (value as unknown[]).filter(
    (p): p is LatLng =>
      typeof p === 'object' &&
      p !== null &&
      typeof (p as LatLng).lat === 'number' &&
      typeof (p as LatLng).lng === 'number',
  )
}

export function parseStreams(stream: {
  time: unknown
  heartrate: unknown
  velocity: unknown
  altitude: unknown
  cadence: unknown
  distance: unknown
} | null): RunStreams | null {
  if (!stream) return null
  const time = asNumberArray(stream.time)
  if (!time) return null
  return {
    time,
    heartrate: asNumberArray(stream.heartrate),
    velocity: asNumberArray(stream.velocity),
    altitude: asNumberArray(stream.altitude),
    cadence: asNumberArray(stream.cadence),
    distance: asNumberArray(stream.distance),
  }
}

async function loadRunData(activityId: string) {
  const activity = await prisma.activity.findUnique({
    where: { id: activityId },
    include: { stream: true },
  })
  if (!activity) return null
  return {
    coords: parseCoords(activity.coordinates),
    streams: parseStreams(activity.stream),
  }
}

/**
 * Match one run against a segment and sync the SegmentEffort row (create,
 * update, or remove). Returns true when the run matches.
 */
async function syncEffort(
  segment: SegmentGeometry & { id: string },
  activityId: string,
  coords: LatLng[],
  streams: RunStreams | null,
): Promise<boolean> {
  const stats = matchRun(coords, streams, segment)
  const where = {
    segmentId_activityId: { segmentId: segment.id, activityId },
  }

  if (!stats) {
    await prisma.segmentEffort.deleteMany({
      where: { segmentId: segment.id, activityId },
    })
    return false
  }

  const data = {
    startIdx: stats.startIdx,
    endIdx: stats.endIdx,
    elapsed: stats.elapsed,
    avgHr: stats.avgHr,
    avgPace: stats.avgPace,
    avgGap: stats.avgGap,
    elevGain: stats.elevGain,
  }
  await prisma.segmentEffort.upsert({
    where,
    create: { segmentId: segment.id, activityId, ...data },
    update: data,
  })
  return true
}

/**
 * Match one activity against every saved segment — called after sync/upload
 * stores a new run. Returns the number of segments the run matched.
 */
export async function matchActivityToSegments(activityId: string): Promise<number> {
  const segments = await prisma.segment.findMany()
  if (segments.length === 0) return 0

  const run = await loadRunData(activityId)
  if (!run || run.coords.length < 2) return 0

  let matched = 0
  for (const segment of segments) {
    if (await syncEffort(segment, activityId, run.coords, run.streams)) matched++
  }
  return matched
}

/**
 * Match every stored run against one segment — called when a segment is
 * created. Runs are loaded one at a time to keep memory bounded. Returns the
 * number of matching runs.
 */
export async function matchSegmentToActivities(segmentId: string): Promise<number> {
  const segment = await prisma.segment.findUnique({ where: { id: segmentId } })
  if (!segment) return 0

  const activities = await prisma.activity.findMany({ select: { id: true } })
  let matched = 0
  for (const { id } of activities) {
    const run = await loadRunData(id)
    if (!run || run.coords.length < 2) continue
    if (await syncEffort(segment, id, run.coords, run.streams)) matched++
  }
  return matched
}
