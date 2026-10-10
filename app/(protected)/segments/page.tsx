import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { effortWhere } from '@/lib/activities'
import { elevationGain } from '@/lib/segments/summary'
import SegmentsView, { type SegmentSummary } from '@/components/segments/SegmentsView'

export const metadata = {
  title: 'Segments — Running Dashboard',
}

export default async function SegmentsPage() {
  const session = await getServerSession(authOptions)
  const isAdmin = !session?.isDemo && session?.user?.email === process.env.ADMIN_EMAIL

  const segments = await prisma.segment.findMany({
    orderBy: [{ strength: 'desc' }, { lengthM: 'desc' }],
    include: {
      efforts: {
        where: await effortWhere(session),
        orderBy: { date: 'asc' },
        select: { elapsedSec: true, date: true, activityId: true },
      },
    },
  })

  const summaries: SegmentSummary[] = segments
    .filter(s => s.efforts.length > 0)
    .map(s => {
      const best = Math.min(...s.efforts.map(e => e.elapsedSec))
      const latest = s.efforts[s.efforts.length - 1]
      return {
        id: s.id,
        name: s.name,
        pinned: s.pinned,
        lengthM: s.lengthM,
        gainM: elevationGain(s.elevation),
        geometry: s.geometry as unknown as { lat: number; lng: number }[],
        efforts: s.efforts.length,
        runs: new Set(s.efforts.map(e => e.activityId)).size,
        bestSec: best,
        latestSec: latest.elapsedSec,
        latestDate: latest.date.toISOString(),
      }
    })

  return <SegmentsView segments={summaries} isAdmin={isAdmin} />
}
