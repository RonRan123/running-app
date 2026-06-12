import { prisma } from '@/lib/prisma'
import RunsView from '@/components/RunsView'

export default async function RunsPage() {
  const activities = await prisma.activity.findMany({
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
