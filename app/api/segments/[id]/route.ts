import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

/** Rename and/or pin a segment. */
export async function PATCH(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.isDemo) {
    return Response.json({ error: 'Demo account is read-only' }, { status: 403 })
  }

  const { id } = await ctx.params
  const body = (await request.json().catch(() => ({}))) as { name?: unknown; pinned?: unknown }
  const data: { name?: string; renamed?: boolean; pinned?: boolean } = {}
  if (typeof body.name === 'string') {
    const name = body.name.trim()
    if (name.length === 0 || name.length > 80) {
      return Response.json({ error: 'Name must be 1–80 characters' }, { status: 400 })
    }
    data.name = name
    data.renamed = true
  }
  if (typeof body.pinned === 'boolean') data.pinned = body.pinned

  try {
    const segment = await prisma.segment.update({ where: { id }, data })
    return Response.json({ id: segment.id, name: segment.name, pinned: segment.pinned })
  } catch {
    return Response.json({ error: 'Segment not found' }, { status: 404 })
  }
}
