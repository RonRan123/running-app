import { prisma } from '@/lib/prisma'
import { fetchActivities, fetchGpsStream, fetchStreams } from '@/lib/intervals'
import type { ActivityStreams } from '@/lib/intervals'
import { matchActivityToSegments } from '@/lib/segmentMatching'
import type { Prisma } from '@prisma/client'

const RUN_TYPES = new Set(['Run', 'VirtualRun', 'TrailRun', 'Treadmill'])

const FETCH_DELAY_MS = 100

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

/** Fetch GPS for an Intervals.icu activity; never throws (GPS is best-effort). */
async function getGps(intervalsId: string) {
  try {
    return await fetchGpsStream(intervalsId)
  } catch {
    return null
  }
}

/** Fetch raw streams; never throws (streams are best-effort). */
async function getStreams(intervalsId: string) {
  try {
    return await fetchStreams(intervalsId)
  } catch {
    return null
  }
}

/** Match a run against saved segments; never throws (matching is best-effort). */
async function matchSegments(activityId: string) {
  try {
    await matchActivityToSegments(activityId)
  } catch {
    // ignore — a failed match never blocks a sync
  }
}

function streamData(activityId: string, s: ActivityStreams) {
  return {
    activityId,
    time: s.time as unknown as Prisma.InputJsonValue,
    heartrate: (s.heartrate ?? undefined) as Prisma.InputJsonValue | undefined,
    velocity: (s.velocity ?? undefined) as Prisma.InputJsonValue | undefined,
    altitude: (s.altitude ?? undefined) as Prisma.InputJsonValue | undefined,
    cadence: (s.cadence ?? undefined) as Prisma.InputJsonValue | undefined,
    distance: (s.distance ?? undefined) as Prisma.InputJsonValue | undefined,
  }
}

export interface SyncResult {
  synced: number
  skipped: number
  gpsAdded: number
  streamsAdded: number
  total: number
}

export function intervalsConfigured(): boolean {
  const athleteId = process.env.INTERVALS_ATHLETE_ID
  const apiKey = process.env.INTERVALS_API_KEY
  return Boolean(
    athleteId && athleteId !== 'your_athlete_id_here' &&
    apiKey && apiKey !== 'your_api_key_here',
  )
}

/**
 * Pull runs from Intervals.icu into the database.
 * Dedupes on externalId; backfills GPS and streams for already-synced activities.
 */
export async function runSync(oldest: Date): Promise<SyncResult> {
  const athleteId = process.env.INTERVALS_ATHLETE_ID!
  const activities = await fetchActivities(athleteId, oldest)
  const runs = activities.filter(a => RUN_TYPES.has(a.type))

  let synced = 0
  let skipped = 0
  let gpsAdded = 0
  let streamsAdded = 0

  for (const a of runs) {
    const externalId = `intervals:${a.id}`

    const existing = await prisma.activity.findUnique({
      where: { externalId },
      include: { stream: { select: { id: true } } },
    })
    if (existing) {
      let backfilled = false
      // Backfill GPS for activities synced before we fetched coordinates
      if (existing.coordinates === null) {
        const gps = await getGps(a.id)
        if (gps) {
          await prisma.activity.update({
            where: { id: existing.id },
            data: { coordinates: gps as unknown as Prisma.InputJsonValue },
          })
          gpsAdded++
          backfilled = true
        }
        await sleep(FETCH_DELAY_MS)
      }
      // Backfill streams for activities synced before we stored them
      if (!existing.stream) {
        const streams = await getStreams(a.id)
        if (streams) {
          await prisma.activityStream.create({ data: streamData(existing.id, streams) })
          streamsAdded++
          backfilled = true
        }
        await sleep(FETCH_DELAY_MS)
      }
      if (backfilled) await matchSegments(existing.id)
      skipped++
      continue
    }

    const distanceKm = a.distance / 1000
    const avgPace =
      a.average_speed > 0
        ? Math.round((1000 / (a.average_speed * 60)) * 100) / 100
        : null

    const gps = await getGps(a.id)
    if (gps) gpsAdded++
    await sleep(FETCH_DELAY_MS)

    const created = await prisma.activity.create({
      data: {
        name: a.name || a.type,
        date: new Date(a.start_date_local),
        distance: Math.round(distanceKm * 1000) / 1000,
        duration: a.elapsed_time,
        avgPace,
        avgHeartRate: a.average_heartrate ?? null,
        maxHeartRate: a.max_heartrate ?? null,
        sport: a.type,
        source: 'intervals',
        externalId,
        coordinates: gps ? (gps as unknown as Prisma.InputJsonValue) : undefined,
      },
    })
    synced++

    const streams = await getStreams(a.id)
    if (streams) {
      await prisma.activityStream.create({ data: streamData(created.id, streams) })
      streamsAdded++
    }
    await matchSegments(created.id)
    await sleep(FETCH_DELAY_MS)
  }

  return { synced, skipped, gpsAdded, streamsAdded, total: runs.length }
}
