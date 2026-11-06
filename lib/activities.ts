import type { Session } from 'next-auth'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'

// Centralized activity data access — the ONE place that knows the public
// demo is restricted. Every read of Activity rows must go through these
// helpers instead of prisma.activity directly, so a demo session can never
// see runs outside the demo set, no matter which page or API route is asking.

// The public demo shows exactly these runs, hand-picked NYC runs, and
// nothing else. A fixed list (rather than "latest N in NYC") means a newly
// synced run never goes public by itself. To change it, list candidates
// with `node --env-file=.env.local scripts/demo-candidates.mjs`.
export const DEMO_RUN_IDS = [
  'cmvyshfh70001be7m85zpjhs3', // Oct 31, 2026 · 6.4 mi
  'cmten3jpy00019p58crq72676', // Aug 29, 2026 · 6.7 mi
  'cmtb1coez000110xb416g1af7', // Aug 26, 2026 · 4.0 mi
  'cmt4vuoqd0001px9nqzr74x2f', // Aug 22, 2026 · 5.8 mi
  'cmr6tq2ar0000caudl3k22qqu', // Jul 4, 2026 · 4.6 mi
  'cmr6tq2xm0003caudrjt6l7ki', // Jun 27, 2026 · 6.0 mi
  'cmr6tq3h50006caud216sutsk', // Jun 26, 2026 · 3.2 mi
  'cmr6tq3xy0009caudykv1by73', // Jun 20, 2026 · 5.2 mi
  'cmr6tq4f9000ccaudz8k9tzeb', // Jun 19, 2026 · 1.2 mi
  'cmr6tq4t4000fcaudd4subyki', // Jun 19, 2026 · 1.0 mi
]

// The list is fixed, so look the runs up once per server instance.
let demoCache: Promise<{ id: string; date: Date }[]> | null = null

/** The demo runs that exist, newest first. */
function demoRuns(): Promise<{ id: string; date: Date }[]> {
  demoCache ??= prisma.activity
    .findMany({
      where: { id: { in: DEMO_RUN_IDS } },
      orderBy: { date: 'desc' },
      select: { id: true, date: true },
    })
    .catch(err => {
      demoCache = null // don't cache a failed lookup
      throw err
    })
  return demoCache
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
