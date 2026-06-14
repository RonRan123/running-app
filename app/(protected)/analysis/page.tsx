import { prisma } from '@/lib/prisma'
import Link from 'next/link'
import AnalysisView from '@/components/analysis/AnalysisView'

export const metadata = {
  title: 'Analysis — Running Dashboard',
}

export default async function AnalysisPage() {
  const [activities, segmentCount] = await Promise.all([
    prisma.activity.findMany({
      orderBy: { date: 'asc' },
      select: {
        id: true,
        name: true,
        date: true,
        distance: true,
        duration: true,
        avgPace: true,
        avgHeartRate: true,
        maxHeartRate: true,
      },
    }),
    prisma.segment.count(),
  ])

  return (
    <div className="space-y-6">
      {segmentCount === 0 && activities.length > 0 ? (
        <div className="bg-white rounded-2xl border border-zinc-200 px-6 py-4 flex items-center justify-between flex-wrap gap-3">
          <p className="text-sm text-zinc-500">
            These charts compare runs of all kinds. For an apples-to-apples view, create
            a <span className="font-medium text-zinc-900">segment</span> — the same
            stretch of road, every time you&apos;ve run it.
          </p>
          <Link
            href="/segments/new"
            className="text-sm font-medium text-zinc-900 hover:text-zinc-600 transition-colors whitespace-nowrap"
          >
            Create a segment →
          </Link>
        </div>
      ) : null}
      <AnalysisView
        activities={activities.map(a => ({ ...a, date: a.date.toISOString() }))}
      />
    </div>
  )
}
