import { getServerSession } from 'next-auth'
import { notFound } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { loadRaceData, raceView } from '@/lib/raceServer'
import RacePlanView from '@/components/race/RacePlanView'

export const metadata = {
  title: 'Race plan — Running Dashboard',
}

export default async function RacePlanPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  // Race goals, check-ins and the plan built from them are personal: the
  // public demo gets a 404, like a race that doesn't exist.
  if (!session || session.isDemo) notFound()

  const { id } = await params
  const goal = await prisma.raceGoal.findUnique({ where: { id } })
  if (!goal) notFound()

  const view = raceView(goal, await loadRaceData(session))
  return <RacePlanView view={view} />
}
