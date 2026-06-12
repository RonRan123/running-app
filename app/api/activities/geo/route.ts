import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const activities = await prisma.activity.findMany({
    where: { coordinates: { not: Prisma.AnyNull } },
    orderBy: { date: 'desc' },
    select: { id: true, coordinates: true },
  })

  // The heatmap doesn't need full GPS fidelity — downsample long tracks
  // to keep the payload small (full tracks can be ~100KB each).
  const MAX_POINTS = 500

  const withGps = activities
    .filter(a => Array.isArray(a.coordinates) && a.coordinates.length > 0)
    .map(a => {
      const coords = a.coordinates as unknown[]
      if (coords.length <= MAX_POINTS) return { id: a.id, coordinates: coords }
      const stride = Math.ceil(coords.length / MAX_POINTS)
      const sampled = coords.filter((_, i) => i % stride === 0)
      // Always keep the final point so the track doesn't end short
      if (sampled[sampled.length - 1] !== coords[coords.length - 1]) {
        sampled.push(coords[coords.length - 1])
      }
      return { id: a.id, coordinates: sampled }
    })

  return Response.json(withGps)
}
