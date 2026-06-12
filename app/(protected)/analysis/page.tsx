import { prisma } from '@/lib/prisma'
import AnalysisView from '@/components/analysis/AnalysisView'

export const metadata = {
  title: 'Analysis — Running Dashboard',
}

export default async function AnalysisPage() {
  const activities = await prisma.activity.findMany({
    orderBy: { date: 'asc' },
    select: {
      id: true,
      name: true,
      date: true,
      distance: true,
      duration: true,
      avgPace: true,
      avgHeartRate: true,
      maxHeartRate: true,
    },
  })

  return (
    <AnalysisView
      activities={activities.map(a => ({ ...a, date: a.date.toISOString() }))}
    />
  )
}
