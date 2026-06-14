import { prisma } from '@/lib/prisma'
import Link from 'next/link'
import { effortSeries } from '@/lib/segments'
import { parseCoords, parseStreams } from '@/lib/segmentMatching'
import SegmentsView, { type SegmentEffortRow } from '@/components/segments/SegmentsView'

export default async function SegmentsPage({
  searchParams,
}: {
  searchParams: Promise<{ segment?: string }>
}) {
  const { segment } = await searchParams

  const segments = await prisma.segment.findMany({
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      name: true,
      distance: true,
      _count: { select: { efforts: true } },
    },
  })

  if (segments.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-zinc-200 p-12 text-center space-y-3">
        <p className="text-sm text-zinc-400">
          No segments yet. A segment is a stretch of road you run repeatedly — once
          saved, every run on it is compared automatically so you can watch your HR
          and pace improve on identical terrain.
        </p>
        <Link
          href="/segments/new"
          className="inline-flex rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 transition-colors"
        >
          Create your first segment
        </Link>
      </div>
    )
  }

  const selected = segments.find(s => s.id === segment) ?? segments[0]

  const full = await prisma.segment.findUnique({
    where: { id: selected.id },
    include: {
      efforts: {
        include: { activity: { include: { stream: true } } },
      },
    },
  })

  const efforts: SegmentEffortRow[] = (full?.efforts ?? [])
    .map(e => {
      const streams = parseStreams(e.activity.stream)
      return {
        id: e.id,
        activityId: e.activityId,
        runName: e.activity.name,
        date: e.activity.date.toISOString(),
        elapsed: e.elapsed,
        avgHr: e.avgHr,
        avgPace: e.avgPace,
        avgGap: e.avgGap,
        elevGain: e.elevGain,
        runDistance: e.activity.distance,
        runDuration: e.activity.duration,
        series: streams ? effortSeries(streams, e.startIdx, e.endIdx) : [],
      }
    })
    .sort((a, b) => a.date.localeCompare(b.date))

  return (
    <SegmentsView
      segments={segments.map(s => ({
        id: s.id,
        name: s.name,
        distance: s.distance,
        effortCount: s._count.efforts,
      }))}
      segment={{
        id: selected.id,
        name: selected.name,
        distance: selected.distance,
        polyline: parseCoords(full?.polyline),
      }}
      efforts={efforts}
    />
  )
}
