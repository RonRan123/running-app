import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { findActivities } from '@/lib/activities'
import AnalysisView from '@/components/analysis/AnalysisView'

export const metadata = {
  title: 'Analysis — Running Dashboard',
}

export default async function AnalysisPage() {
  const session = await getServerSession(authOptions)
  const activities = await findActivities(session, {
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
      weatherTempC: true,
      weatherDewPointC: true,
      weatherApparentTempC: true,
    },
  })

  return (
    <AnalysisView
      activities={activities.map(a => ({ ...a, date: a.date.toISOString() }))}
    />
  )
}
