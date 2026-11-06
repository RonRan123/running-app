import { requireAdmin } from '@/lib/guards'
import { rediscoverSegments } from '@/lib/segments/store'

export async function POST() {
  const { error } = await requireAdmin()
  if (error) return error
  return Response.json(await rediscoverSegments())
}
