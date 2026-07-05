import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { findActivities } from '@/lib/activities'
import { bestEfforts, predictRaceTime, type EffortActivity } from '@/lib/records'
import GoalsView from '@/components/goals/GoalsView'

function asNumberArray(value: unknown): number[] | null {
  return Array.isArray(value) && value.every(v => typeof v === 'number')
    ? (value as number[])
    : null
}

export default async function GoalsPage() {
  const session = await getServerSession(authOptions)
  const [goals, activities] = await Promise.all([
    prisma.raceGoal.findMany({ orderBy: { date: 'asc' } }),
    findActivities(session, {
      orderBy: { date: 'asc' },
      select: {
        id: true,
        name: true,
        date: true,
        distance: true,
        duration: true,
        stream: { select: { time: true, distance: true } },
      },
    }),
  ])

  const effortActivities: EffortActivity[] = activities.map(a => {
    const time = a.stream ? asNumberArray(a.stream.time) : null
    const distance = a.stream ? asNumberArray(a.stream.distance) : null
    return {
      id: a.id,
      name: a.name,
      date: a.date.toISOString(),
      distance: a.distance,
      duration: a.duration,
      streams: time && distance ? { time, distance } : null,
    }
  })

  const records = bestEfforts(effortActivities)

  return (
    <GoalsView
      goals={goals.map(g => ({
        id: g.id,
        name: g.name,
        date: g.date.toISOString(),
        distance: g.distance,
        goalTime: g.goalTime,
        prediction: predictRaceTime(records, g.distance),
      }))}
      records={records}
    />
  )
}
