import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const goals = await prisma.raceGoal.findMany({ orderBy: { date: 'asc' } })
  return Response.json(goals)
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.isDemo) {
    return Response.json({ error: 'Demo account is read-only' }, { status: 403 })
  }

  const body = await request.json().catch(() => null)
  const name = typeof body?.name === 'string' ? body.name.trim() : ''
  const date = body?.date ? new Date(body.date) : null
  const distance = Number(body?.distance)
  const goalTime = Number(body?.goalTime)

  if (!name) return Response.json({ error: 'Race name is required' }, { status: 400 })
  if (!date || isNaN(date.getTime())) {
    return Response.json({ error: 'A valid race date is required' }, { status: 400 })
  }
  if (!(distance > 0)) {
    return Response.json({ error: 'Distance must be greater than 0' }, { status: 400 })
  }
  if (!Number.isInteger(goalTime) || goalTime <= 0) {
    return Response.json({ error: 'Goal time must be a positive number of seconds' }, { status: 400 })
  }

  const goal = await prisma.raceGoal.create({
    data: { name, date, distance, goalTime },
  })
  return Response.json(goal, { status: 201 })
}
