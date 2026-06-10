import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { fetchActivities } from '@/lib/intervals'

const RUN_TYPES = new Set(['Run', 'VirtualRun', 'TrailRun', 'Treadmill'])

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const athleteId = process.env.INTERVALS_ATHLETE_ID
  if (!athleteId || athleteId === 'your_athlete_id_here') {
    return Response.json({ error: 'INTERVALS_ATHLETE_ID not configured' }, { status: 400 })
  }
  if (!process.env.INTERVALS_API_KEY || process.env.INTERVALS_API_KEY === 'your_api_key_here') {
    return Response.json({ error: 'INTERVALS_API_KEY not configured' }, { status: 400 })
  }

  // Accept optional `oldest` date in body; default to full history (2010 covers any watch data)
  let oldest = new Date('2010-01-01')
  try {
    const body = await request.json().catch(() => ({}))
    if (body?.oldest) oldest = new Date(body.oldest)
  } catch {
    // ignore malformed body
  }

  let activities
  try {
    activities = await fetchActivities(athleteId, oldest)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch from Intervals.icu'
    return Response.json({ error: message }, { status: 502 })
  }

  const runs = activities.filter(a => RUN_TYPES.has(a.type))

  let synced = 0
  let skipped = 0

  for (const a of runs) {
    const externalId = `intervals:${a.id}`

    const existing = await prisma.activity.findUnique({ where: { externalId } })
    if (existing) {
      skipped++
      continue
    }

    const distanceKm = a.distance / 1000
    const avgPace =
      a.average_speed > 0
        ? Math.round((1000 / (a.average_speed * 60)) * 100) / 100
        : null

    await prisma.activity.create({
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
      },
    })
    synced++
  }

  return Response.json({ synced, skipped, total: runs.length })
}
