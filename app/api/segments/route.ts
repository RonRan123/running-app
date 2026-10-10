import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { effortWhere } from '@/lib/activities'

/** Segment geometries for map overlays, with effort counts in the viewer's window. */
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const [segments, counts] = await Promise.all([
    prisma.segment.findMany({ select: { id: true, name: true, geometry: true, lengthM: true } }),
    prisma.segmentEffort.groupBy({
      by: ['segmentId'],
      where: await effortWhere(session),
      _count: { _all: true },
    }),
  ])
  const byId = new Map(counts.map(c => [c.segmentId, c._count._all]))
  return Response.json(
    segments
      .map(s => ({ ...s, efforts: byId.get(s.id) ?? 0 }))
      .filter(s => s.efforts > 0),
  )
}
