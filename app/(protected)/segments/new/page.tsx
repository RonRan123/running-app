import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import Link from 'next/link'
import SegmentCreator from '@/components/segments/SegmentCreator'
import { parseCoords } from '@/lib/segmentMatching'

export default async function NewSegmentPage({
  searchParams,
}: {
  searchParams: Promise<{ run?: string }>
}) {
  const { run } = await searchParams

  const runs = await prisma.activity.findMany({
    where: { NOT: { coordinates: { equals: Prisma.AnyNull } } },
    orderBy: { date: 'desc' },
    select: { id: true, name: true, date: true },
  })

  if (runs.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-zinc-200 p-12 text-center text-sm text-zinc-400">
        No runs with GPS data yet — sync or upload a run before creating a segment.
      </div>
    )
  }

  const selected = runs.find(r => r.id === run) ?? runs[0]
  const activity = await prisma.activity.findUnique({
    where: { id: selected.id },
    select: { coordinates: true },
  })
  const coordinates = parseCoords(activity?.coordinates)

  return (
    <div className="space-y-6">
      <Link
        href="/segments"
        className="inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-900 transition-colors"
      >
        <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        Segments
      </Link>

      <SegmentCreator
        runs={runs.map(r => ({ id: r.id, name: r.name, date: r.date.toISOString() }))}
        runId={selected.id}
        coordinates={coordinates}
      />
    </div>
  )
}
