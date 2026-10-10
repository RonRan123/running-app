import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { rediscoverSegments } from '@/lib/segments/store'

export async function POST() {
  const session = await getServerSession(authOptions)
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.isDemo) {
    return Response.json({ error: 'Demo account is read-only' }, { status: 403 })
  }
  return Response.json(await rediscoverSegments())
}
