import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { findActivities } from '@/lib/activities'
import AnalysisView from '@/components/analysis/AnalysisView'
import { estimateMaxHr } from '@/lib/analysis'
import { timeInZones } from '@/lib/runAnalysis'

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
      stream: { select: { time: true, heartrate: true } },
    },
  })

  // Time-in-zone is classified sample-by-sample here so raw HR streams never
  // ship to the client. Same max-HR estimate AnalysisView derives client-side.
  const maxHr = estimateMaxHr(activities.map(a => ({ ...a, date: a.date.toISOString() })))

  return (
    <AnalysisView
      activities={activities.map(({ stream, ...a }) => {
        const time = stream?.time as number[] | undefined
        const hr = stream?.heartrate as number[] | null | undefined
        const zones = time && hr && hr.length === time.length ? timeInZones(time, hr, maxHr) : null
        // An HR stream with no usable samples falls back to avg-HR classification.
        const hasTime = zones && zones.easy + zones.moderate + zones.hard > 0
        return { ...a, date: a.date.toISOString(), zoneSeconds: hasTime ? zones : null }
      })}
    />
  )
}
