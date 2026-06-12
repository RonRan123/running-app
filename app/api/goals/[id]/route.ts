import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function DELETE(
  _request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions)
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await ctx.params
  try {
    await prisma.raceGoal.delete({ where: { id } })
  } catch {
    return Response.json({ error: 'Goal not found' }, { status: 404 })
  }
  return Response.json({ ok: true })
}
