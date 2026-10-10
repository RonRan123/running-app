import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const settings = await prisma.userSettings.findUnique({ where: { id: 1 } })
  return Response.json({
    age: settings?.age ?? null,
    birthDate: settings?.birthDate?.toISOString().slice(0, 10) ?? null,
    demoFromDate: settings?.demoFromDate?.toISOString() ?? null,
    demoToDate: settings?.demoToDate?.toISOString() ?? null,
  })
}

export async function PUT(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.isDemo) {
    return Response.json({ error: 'Demo account is read-only' }, { status: 403 })
  }

  const body = await request.json().catch(() => null)
  const update: { age?: number; birthDate?: Date; demoFromDate?: Date; demoToDate?: Date } = {}

  // Birthday as yyyy-MM-dd, stored at UTC midnight so the calendar date never shifts.
  if (body?.birthDate !== undefined) {
    const match = typeof body.birthDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.birthDate)
    const birthDate = match ? new Date(`${body.birthDate}T00:00:00Z`) : null
    const years = birthDate ? (Date.now() - birthDate.getTime()) / (365.25 * 86_400_000) : NaN
    if (!birthDate || isNaN(birthDate.getTime()) || years < 10 || years > 100) {
      return Response.json({ error: 'Enter a valid birthday (age 10–100)' }, { status: 400 })
    }
    update.birthDate = birthDate
  }

  if (body?.age !== undefined) {
    const age = Number(body.age)
    if (!Number.isInteger(age) || age < 10 || age > 100) {
      return Response.json({ error: 'Age must be a whole number between 10 and 100' }, { status: 400 })
    }
    update.age = age
  }

  // Demo date window: both dates required together, from must precede to.
  if (body?.demoFromDate !== undefined || body?.demoToDate !== undefined) {
    const from = new Date(body?.demoFromDate)
    const to = new Date(body?.demoToDate)
    if (isNaN(from.getTime()) || isNaN(to.getTime())) {
      return Response.json({ error: 'Both demo dates must be valid' }, { status: 400 })
    }
    if (from >= to) {
      return Response.json({ error: 'Demo start date must be before the end date' }, { status: 400 })
    }
    update.demoFromDate = from
    // Include the entire end day, whatever time the runs happened.
    to.setHours(23, 59, 59, 999)
    update.demoToDate = to
  }

  if (Object.keys(update).length === 0) {
    return Response.json({ error: 'Nothing to update' }, { status: 400 })
  }

  const settings = await prisma.userSettings.upsert({
    where: { id: 1 },
    update,
    create: { id: 1, ...update },
  })
  return Response.json({
    age: settings.age,
    birthDate: settings.birthDate?.toISOString().slice(0, 10) ?? null,
    demoFromDate: settings.demoFromDate?.toISOString() ?? null,
    demoToDate: settings.demoToDate?.toISOString() ?? null,
  })
}
