import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { findActivities } from '@/lib/activities'
import AnalysisView from '@/components/analysis/AnalysisView'
import { estimateMaxHr } from '@/lib/analysis'
import { runningForm, timeInZones } from '@/lib/runAnalysis'

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
      stream: { select: { time: true, heartrate: true, cadence: true, velocity: true, distance: true } },
    },
  })

  // Time-in-zone and running form are computed from streams here so raw
  // streams never ship to the client. Same max-HR estimate AnalysisView derives client-side.
  const maxHr = estimateMaxHr(activities.map(a => ({ ...a, date: a.date.toISOString() })))

  return (
    <AnalysisView
      activities={activities.map(({ stream, ...a }) => {
        const time = stream?.time as number[] | undefined
        const hr = stream?.heartrate as number[] | null | undefined
        const zones = time && hr && hr.length === time.length ? timeInZones(time, hr, maxHr) : null
        // An HR stream with no usable samples falls back to avg-HR classification.
        const hasTime = zones && zones.easy + zones.moderate + zones.hard > 0
        const cadence = stream?.cadence as number[] | null | undefined
        const velocity = stream?.velocity as number[] | null | undefined
        const distance = stream?.distance as number[] | null | undefined
        const aligned = (xs: number[] | null | undefined): xs is number[] =>
          !!time && !!xs && xs.length === time.length
        const form =
          time && aligned(cadence) && aligned(velocity) && aligned(distance)
            ? runningForm(time, cadence, velocity, distance)
            : null
        return {
          ...a,
          date: a.date.toISOString(),
          zoneSeconds: hasTime ? zones : null,
          cadenceSpm: form?.cadenceSpm ?? null,
          stepLengthM: form?.stepLengthM ?? null,
        }
      })}
    />
  )
}
