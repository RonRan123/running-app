import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const settings = await prisma.userSettings.findUnique({ where: { id: 1 } })
  return Response.json({ age: settings?.age ?? null })
}

export async function PUT(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => null)
  const age = Number(body?.age)
  if (!Number.isInteger(age) || age < 10 || age > 100) {
    return Response.json({ error: 'Age must be a whole number between 10 and 100' }, { status: 400 })
  }

  const settings = await prisma.userSettings.upsert({
    where: { id: 1 },
    update: { age },
    create: { id: 1, age },
  })
  return Response.json({ age: settings.age })
}
