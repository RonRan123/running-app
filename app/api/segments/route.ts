import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { cumulativeMeters, downsamplePolyline } from '@/lib/segments'
import { matchSegmentToActivities, parseCoords } from '@/lib/segmentMatching'
import type { Prisma } from '@prisma/client'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const segments = await prisma.segment.findMany({
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      name: true,
      distance: true,
      createdAt: true,
      _count: { select: { efforts: true } },
    },
  })
  return Response.json(
    segments.map(s => ({
      id: s.id,
      name: s.name,
      distance: s.distance,
      createdAt: s.createdAt,
      effortCount: s._count.efforts,
    })),
  )
}

// Minimum segment length — two clicks closer than this are almost certainly
// a misclick, and sub-100 m efforts are noise at GPS resolution.
const MIN_SEGMENT_METERS = 100

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => null)
  const name = typeof body?.name === 'string' ? body.name.trim() : ''
  const activityId = typeof body?.activityId === 'string' ? body.activityId : ''
  const startIdx = Number(body?.startIdx)
  const endIdx = Number(body?.endIdx)

  if (!name) return Response.json({ error: 'Segment name is required' }, { status: 400 })
  if (!activityId) return Response.json({ error: 'A source run is required' }, { status: 400 })
  if (!Number.isInteger(startIdx) || !Number.isInteger(endIdx) || startIdx < 0 || endIdx <= startIdx) {
    return Response.json({ error: 'Pick a start point and a later end point on the route' }, { status: 400 })
  }

  const activity = await prisma.activity.findUnique({
    where: { id: activityId },
    select: { coordinates: true },
  })
  if (!activity) return Response.json({ error: 'Run not found' }, { status: 404 })

  const coords = parseCoords(activity.coordinates)
  if (endIdx >= coords.length) {
    return Response.json({ error: 'Selection is outside the run’s GPS track' }, { status: 400 })
  }

  const slice = coords.slice(startIdx, endIdx + 1)
  const cum = cumulativeMeters(slice)
  const meters = cum[cum.length - 1]
  if (meters < MIN_SEGMENT_METERS) {
    return Response.json(
      { error: `Segment must be at least ${MIN_SEGMENT_METERS} m long` },
      { status: 400 },
    )
  }

  const polyline = downsamplePolyline(slice)
  const segment = await prisma.segment.create({
    data: {
      name,
      polyline: polyline as unknown as Prisma.InputJsonValue,
      startLat: slice[0].lat,
      startLng: slice[0].lng,
      endLat: slice[slice.length - 1].lat,
      endLng: slice[slice.length - 1].lng,
      distance: Math.round(meters / 10) / 100, // km, 2 decimals
    },
  })

  const matched = await matchSegmentToActivities(segment.id)
  return Response.json({ id: segment.id, name: segment.name, matched }, { status: 201 })
}
