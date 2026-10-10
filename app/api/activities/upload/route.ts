import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { parseGpx } from '@/lib/parsers/gpx'
import { parseFit } from '@/lib/parsers/fit'
import { backfillWeather } from '@/lib/weather'
import { matchNewRuns } from '@/lib/segments/store'

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.isDemo) {
    return Response.json({ error: 'Demo account is read-only' }, { status: 403 })
  }

  const formData = await request.formData()
  const files = formData.getAll('files') as File[]

  if (!files.length) {
    return Response.json({ error: 'No files provided' }, { status: 400 })
  }

  const results: { name: string; success: boolean; error?: string }[] = []
  const createdIds: string[] = []

  for (const file of files) {
    try {
      const buffer = await file.arrayBuffer()
      const ext = file.name.split('.').pop()?.toLowerCase()

      let parsed
      if (ext === 'gpx') {
        parsed = parseGpx(buffer)
      } else if (ext === 'fit') {
        parsed = await parseFit(buffer)
      } else {
        results.push({ name: file.name, success: false, error: 'Unsupported file type' })
        continue
      }

      const created = await prisma.activity.create({
        data: {
          name: parsed.name,
          date: parsed.date,
          distance: parsed.distance,
          duration: parsed.duration,
          avgPace: parsed.avgPace,
          avgHeartRate: parsed.avgHeartRate,
          maxHeartRate: parsed.maxHeartRate,
          sport: parsed.sport,
          coordinates: parsed.coordinates as object,
          source: 'upload',
          ...(parsed.streams
            ? {
                stream: {
                  create: {
                    time: parsed.streams.time,
                    heartrate: parsed.streams.heartrate ?? undefined,
                    velocity: parsed.streams.velocity ?? undefined,
                    altitude: parsed.streams.altitude ?? undefined,
                    cadence: parsed.streams.cadence ?? undefined,
                    distance: parsed.streams.distance ?? undefined,
                    latitude: parsed.streams.latitude ?? undefined,
                    longitude: parsed.streams.longitude ?? undefined,
                  },
                },
              }
            : {}),
        },
      })

      createdIds.push(created.id)
      results.push({ name: file.name, success: true })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Parse error'
      results.push({ name: file.name, success: false, error: message })
    }
  }

  // Fire-and-forget weather fetch for the newly uploaded runs.
  if (results.some(r => r.success)) void backfillWeather()
  void matchNewRuns(createdIds).catch(err => console.error('Segment matching failed:', err))

  const allOk = results.every(r => r.success)
  return Response.json({ results }, { status: allOk ? 200 : 207 })
}
