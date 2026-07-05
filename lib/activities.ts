import type { Session } from 'next-auth'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'

// Centralized activity data access — the ONE place that knows the demo
// account is date-restricted. Every read of Activity rows must go through
// these helpers instead of prisma.activity directly, so a demo session can
// never see runs outside the admin-configured window (Settings → Demo
// Access), no matter which page or API route is asking.

const DEFAULT_DEMO_FROM = new Date('2026-01-01T00:00:00')
const DEFAULT_DEMO_TO = new Date('2026-03-31T23:59:59.999')

async function demoDateWindow(): Promise<Prisma.DateTimeFilter> {
  const settings = await prisma.userSettings.findUnique({ where: { id: 1 } })
  return {
    gte: settings?.demoFromDate ?? DEFAULT_DEMO_FROM,
    lte: settings?.demoToDate ?? DEFAULT_DEMO_TO,
  }
}

/**
 * Merge the demo date restriction into a where clause. Admin sessions pass
 * through untouched. The restriction lives in the WHERE itself (not a
 * post-query check), so even direct-ID lookups can't leak an out-of-window
 * run — it behaves exactly like a run that doesn't exist.
 */
async function scopedWhere(
  session: Session | null,
  where: Prisma.ActivityWhereInput | undefined,
): Promise<Prisma.ActivityWhereInput | undefined> {
  if (!session?.isDemo) return where
  return { ...where, date: await demoDateWindow() }
}

/** `prisma.activity.findMany`, restricted to the demo window for demo sessions. */
export async function findActivities<T extends Prisma.ActivityFindManyArgs>(
  session: Session | null,
  args: T,
): Promise<Prisma.ActivityGetPayload<T>[]> {
  const where = await scopedWhere(session, args.where)
  return prisma.activity.findMany({ ...args, where }) as Promise<
    Prisma.ActivityGetPayload<T>[]
  >
}

/**
 * Single-activity lookup by id, restricted to the demo window for demo
 * sessions. Uses findFirst because findUnique cannot carry the date bound.
 */
export async function findActivityById<
  T extends Omit<Prisma.ActivityFindFirstArgs, 'where'>,
>(
  session: Session | null,
  id: string,
  args?: T,
): Promise<Prisma.ActivityGetPayload<T> | null> {
  const where = await scopedWhere(session, { id })
  return prisma.activity.findFirst({
    ...args,
    where,
  }) as Promise<Prisma.ActivityGetPayload<T> | null>
}
