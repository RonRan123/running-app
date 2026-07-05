import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { findActivities } from '@/lib/activities'
import RunsView from '@/components/RunsView'

export default async function RunsPage() {
  const session = await getServerSession(authOptions)
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
      source: true,
    },
  })

  return (
    <RunsView
      activities={activities.map(a => ({ ...a, date: a.date.toISOString() }))}
    />
  )
}
