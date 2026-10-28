import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { findActivities, visibleNow } from '@/lib/activities'
import { buildDayMap, dayKeyInZone } from '@/lib/activitySummary'
import { timeZoneFrom, weeklyGoalFrom } from '@/lib/userSettings'
import RunsView from '@/components/RunsView'

export default async function RunsPage() {
  const session = await getServerSession(authOptions)
  const [activities, settings, now] = await Promise.all([
    findActivities(session, {
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
    }),
    prisma.userSettings.findUnique({ where: { id: 1 } }),
    visibleNow(session),
  ])

  // The sidebar gets runs pre-bucketed into local days of the chosen time
  // zone, so its calendar maths never depends on the browser's time zone.
  const timeZone = timeZoneFrom(settings)

  return (
    <RunsView
      activities={activities.map(a => ({ ...a, date: a.date.toISOString() }))}
      summary={{
        days: buildDayMap(activities, timeZone),
        todayKey: dayKeyInZone(now, timeZone),
        goal: weeklyGoalFrom(settings),
      }}
    />
  )
}
