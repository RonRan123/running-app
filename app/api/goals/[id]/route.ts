import { requireAdmin } from '@/lib/guards'
import { prisma } from '@/lib/prisma'

export async function DELETE(
  _request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { error } = await requireAdmin()
  if (error) return error

  const { id } = await ctx.params
  try {
    await prisma.raceGoal.delete({ where: { id } })
  } catch {
    return Response.json({ error: 'Goal not found' }, { status: 404 })
  }
  return Response.json({ ok: true })
}
