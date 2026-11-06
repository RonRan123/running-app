import { requireSession } from '@/lib/guards'
import { findActivities } from '@/lib/activities'

export async function GET() {
  const { session, error } = await requireSession()
  if (error) return error

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
