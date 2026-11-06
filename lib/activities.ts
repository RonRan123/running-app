import type { Session } from 'next-auth'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'

// Centralized activity data access — the ONE place that knows the public
// demo is restricted. Every read of Activity rows must go through these
// helpers instead of prisma.activity directly, so a demo session can never
// see runs outside the demo set, no matter which page or API route is asking.

const DEMO_RUN_COUNT = 10

// New York City bounding box, matched against each run's first GPS point.
const NYC = { minLat: 40.49, maxLat: 40.92, minLng: -74.27, maxLng: -73.68 }

// The demo set only changes when a new NYC run syncs, so cache it briefly
// rather than re-scanning every run's coordinates on each request.
const DEMO_CACHE_MS = 5 * 60 * 1000
let demoCache: { at: number; runs: { id: string; date: Date }[] } | null = null

/** The demo set: the most recent runs that started in New York City. */
async function demoRuns(): Promise<{ id: string; date: Date }[]> {
  if (demoCache && Date.now() - demoCache.at < DEMO_CACHE_MS) return demoCache.runs
  const runs = await prisma.$queryRaw<{ id: string; date: Date }[]>`
    SELECT id, date FROM "Activity"
    WHERE sport = 'Run' AND jsonb_typeof(coordinates) = 'array'
      AND (coordinates->0->>'lat')::float BETWEEN ${NYC.minLat} AND ${NYC.maxLat}
      AND (coordinates->0->>'lng')::float BETWEEN ${NYC.minLng} AND ${NYC.maxLng}
    ORDER BY date DESC
    LIMIT ${DEMO_RUN_COUNT}`
  demoCache = { at: Date.now(), runs }
  return runs
}

async function demoRunIds(): Promise<string[]> {
  return (await demoRuns()).map(r => r.id)
}

/**
 * The latest moment this session may see runs from: the most recent demo
 * run for a demo session, otherwise now. Pages that show "this week" use it
 * so the demo lands on a populated week.
 */
export async function visibleNow(session: Session | null): Promise<Date> {
  const now = new Date()
  if (!session?.isDemo) return now
  const [latest] = await demoRuns()
  return latest && latest.date < now ? latest.date : now
}

/**
 * Merge the demo restriction into a where clause. Admin sessions pass
 * through untouched. The restriction lives in the WHERE itself (not a
 * post-query check), so even direct-ID lookups can't leak a run outside the
 * demo set — it behaves exactly like a run that doesn't exist.
 */
async function scopedWhere(
  session: Session | null,
  where: Prisma.ActivityWhereInput | undefined,
): Promise<Prisma.ActivityWhereInput | undefined> {
  if (!session?.isDemo) return where
  return { AND: [where ?? {}, { id: { in: await demoRunIds() } }] }
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

/**
 * Where-clause for SegmentEffort reads, restricted to efforts from demo runs
 * for demo sessions.
 */
export async function effortWhere(
  session: Session | null,
  where: Prisma.SegmentEffortWhereInput = {},
): Promise<Prisma.SegmentEffortWhereInput> {
  if (!session?.isDemo) return where
  return { AND: [where, { activityId: { in: await demoRunIds() } }] }
}
