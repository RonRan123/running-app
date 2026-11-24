import { requireAdmin } from '@/lib/guards'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { readCheckIns } from '@/lib/raceServer'
import { dayKeyInZone, weekStartKey } from '@/lib/activitySummary'
import { timeZoneFrom } from '@/lib/userSettings'

// Weekly check-ins feed the race plan. How the runner feels is personal, so
// both reading and writing are owner-only.

const level = (v: unknown, optional = false): number | null | undefined => {
  if (optional && (v === null || v === undefined)) return null
  return v === 1 || v === 2 || v === 3 ? v : undefined
}

export async function GET() {
  const { error } = await requireAdmin()
  if (error) return error

  return Response.json(await readCheckIns())
}

export async function POST(request: Request) {
  const { error } = await requireAdmin()
  if (error) return error

  const body = await request.json().catch(() => null)
  const weekStart = typeof body?.weekStart === 'string' ? body.weekStart : ''
  if (!/^\d{4}-\d{2}-\d{2}$/.test(weekStart) || weekStartKey(weekStart) !== weekStart) {
    return Response.json({ error: 'weekStart must be a Monday (yyyy-MM-dd)' }, { status: 400 })
  }
  const settings = await prisma.userSettings.findUnique({ where: { id: 1 } })
  const today = dayKeyInZone(new Date(), timeZoneFrom(settings))
  if (weekStart > today) {
    return Response.json({ error: 'That week has not started yet' }, { status: 400 })
  }

  const effort = level(body?.effort)
  const freshness = level(body?.freshness)
  const soreness = level(body?.soreness)
  const enjoyment = level(body?.enjoyment, true)
  if (effort == null || freshness == null || soreness == null || enjoyment === undefined) {
    return Response.json({ error: 'effort, freshness and soreness must be 1, 2 or 3' }, { status: 400 })
  }
  const note = typeof body?.note === 'string' && body.note.trim() ? body.note.trim().slice(0, 500) : null

  const data = { effort, freshness, soreness, enjoyment, note }
  try {
    const saved = await prisma.weeklyCheckIn.upsert({
      where: { weekStart },
      create: { weekStart, ...data },
      update: data,
    })
    return Response.json(saved, { status: 201 })
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2021') {
      return Response.json(
        { error: 'Check-ins are not set up on this database yet (run `npx prisma db push`).' },
        { status: 503 },
      )
    }
    throw err
  }
}
