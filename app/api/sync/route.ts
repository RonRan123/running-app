import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { intervalsConfigured, runSync } from '@/lib/sync'

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  if (!intervalsConfigured()) {
    return Response.json(
      { error: 'INTERVALS_ATHLETE_ID / INTERVALS_API_KEY not configured' },
      { status: 400 },
    )
  }

  // Accept optional `oldest` date in body; default to full history (2010 covers any watch data)
  let oldest = new Date('2010-01-01')
  try {
    const body = await request.json().catch(() => ({}))
    if (body?.oldest) oldest = new Date(body.oldest)
  } catch {
    // ignore malformed body
  }

  try {
    const result = await runSync(oldest)
    return Response.json(result)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch from Intervals.icu'
    return Response.json({ error: message }, { status: 502 })
  }
}
