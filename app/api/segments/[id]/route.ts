import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions)
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await request.json().catch(() => null)
  const name = typeof body?.name === 'string' ? body.name.trim() : ''
  if (!name) return Response.json({ error: 'Segment name is required' }, { status: 400 })

  const segment = await prisma.segment.update({ where: { id }, data: { name } }).catch(() => null)
  if (!segment) return Response.json({ error: 'Segment not found' }, { status: 404 })
  return Response.json(segment)
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions)
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const deleted = await prisma.segment.delete({ where: { id } }).catch(() => null)
  if (!deleted) return Response.json({ error: 'Segment not found' }, { status: 404 })
  return Response.json({ ok: true })
}
