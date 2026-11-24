import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { bestEfforts, type EffortActivity } from '@/lib/records'
import { loadRaceData, raceView } from '@/lib/raceServer'
import GoalsView, { type GoalWithPrediction } from '@/components/goals/GoalsView'
import { weeklyGoalFrom } from '@/lib/userSettings'

export default async function GoalsPage() {
  const session = await getServerSession(authOptions)
  const [goals, settings, data] = await Promise.all([
    // Race names and dates say where the runner will be; keep them out of the demo.
    session?.isDemo ? [] : prisma.raceGoal.findMany({ orderBy: { date: 'asc' } }),
    prisma.userSettings.findUnique({ where: { id: 1 } }),
    loadRaceData(session),
  ])

  const effortActivities: EffortActivity[] = data.runs.map(r => ({
    id: r.id,
    name: r.name,
    date: r.date,
    distance: r.distanceKm,
    duration: r.durationSec,
    streams: r.streams ? { time: r.streams.time, distance: r.streams.distance } : null,
  }))
  const records = bestEfforts(effortActivities)

  const withPlans: GoalWithPrediction[] = goals.map(g => {
    const view = raceView(g, data, { trend: false })
    const plan = view.plan
    const w = plan && plan.current >= 0 && plan.current < plan.weeks.length ? plan.weeks[plan.current] : null
    return {
      id: g.id,
      name: g.name,
      date: view.goal.date,
      distance: g.distance,
      goalTime: g.goalTime,
      prediction: view.prediction,
      week: w && {
        number: w.number,
        of: plan!.weeks.length,
        phase: w.phase,
        cutback: w.cutback,
        targetKm: w.targetKm,
        doneKm: w.actualKm ?? 0,
      },
      startsOn: plan && plan.current < 0 ? plan.weeks[0].start : null,
    }
  })

  return (
    <GoalsView
      goals={withPlans}
      records={records}
      weeklyGoal={weeklyGoalFrom(settings)}
      isDemo={!!session?.isDemo}
    />
  )
}
