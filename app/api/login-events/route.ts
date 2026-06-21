import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const PAGE_SIZE = 10
const PRUNE_DAYS = 90

export async function GET(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10))

  // Prune events older than 90 days asynchronously
  const cutoff = new Date(Date.now() - PRUNE_DAYS * 24 * 60 * 60 * 1000)
  prisma.loginEvent.deleteMany({ where: { timestamp: { lt: cutoff } } }).catch(() => null)

  const [total, events] = await Promise.all([
    prisma.loginEvent.count(),
    prisma.loginEvent.findMany({
      orderBy: { timestamp: 'desc' },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
  ])

  return Response.json({
    events: events.map(e => ({
      id: e.id,
      timestamp: e.timestamp.toISOString(),
      ipAddress: e.ipAddress,
      userAgent: e.userAgent,
      country: e.country,
      region: e.region,
      city: e.city,
    })),
    total,
    page,
    pages: Math.ceil(total / PAGE_SIZE),
  })
}
