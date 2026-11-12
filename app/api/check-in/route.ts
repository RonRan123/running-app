import type { Prisma } from '@prisma/client'
import { requireAdmin } from '@/lib/guards'
import { prisma } from '@/lib/prisma'
import { dayKeyInZone } from '@/lib/activitySummary'
import { TAGS, checkInFrom, parseLevel, withTag, type TagKey } from '@/lib/checkIn'
import { timeZoneFrom } from '@/lib/userSettings'

// The check-in tags beside the 7-day plan. Personal, so owner only.

export async function GET() {
  const { error } = await requireAdmin()
  if (error) return error

  const settings = await prisma.userSettings.findUnique({ where: { id: 1 } })
  return Response.json(checkInFrom(settings?.checkIn))
}

/** Body: any of { pain, soreness, sleep, tiredness: 0–2, sick: 0–1 }. */
export async function PUT(request: Request) {
  const { error } = await requireAdmin()
  if (error) return error

  const body = await request.json().catch(() => null)
  const settings = await prisma.userSettings.findUnique({ where: { id: 1 } })
  const today = dayKeyInZone(new Date(), timeZoneFrom(settings))

  let checkIn = checkInFrom(settings?.checkIn)
  let changed = false
  for (const { key } of TAGS) {
    if (body?.[key] === undefined) continue
    const level = parseLevel(key as TagKey, body[key])
    if (level == null) return Response.json({ error: `Unknown level for ${key}` }, { status: 400 })
    checkIn = withTag(checkIn, key, level, today)
    changed = true
  }
  if (!changed) return Response.json({ error: 'Nothing to update' }, { status: 400 })

  const stored = checkIn as unknown as Prisma.InputJsonValue
  await prisma.userSettings.upsert({
    where: { id: 1 },
    update: { checkIn: stored },
    create: { id: 1, checkIn: stored },
  })
  return Response.json(checkIn)
}
