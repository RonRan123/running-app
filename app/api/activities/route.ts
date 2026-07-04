import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { findActivities } from '@/lib/activities'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const activities = await findActivities(session, {
    orderBy: { date: 'desc' },
    select: {
      id: true,
      name: true,
      date: true,
      distance: true,
      duration: true,
      avgPace: true,
      avgHeartRate: true,
      maxHeartRate: true,
      sport: true,
      source: true,
    },
  })

  return Response.json(activities)
}
