import { notFound } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { effortWhere } from '@/lib/activities'
import { elevationGain } from '@/lib/segments/summary'
import { effortSpeedSeries } from '@/lib/segments/series'
import type { LatLng } from '@/lib/segments/geo'
import SegmentDetail, { type EffortView } from '@/components/segments/SegmentDetail'

const nums = (v: unknown) => (Array.isArray(v) ? (v as number[]) : null)

export default async function SegmentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getServerSession(authOptions)
  const isAdmin = !session?.isDemo && session?.user?.email === process.env.ADMIN_EMAIL

  const segment = await prisma.segment.findUnique({
    where: { id },
    include: {
      efforts: {
        where: await effortWhere(session),
        orderBy: { date: 'asc' },
        include: {
          activity: {
            select: {
              id: true,
              name: true,
              weatherApparentTempC: true,
              stream: { select: { time: true, latitude: true, longitude: true } },
            },
          },
        },
      },
    },
  })
  if (!segment) notFound()

  const geometry = segment.geometry as unknown as LatLng[]
  const fastest = [...segment.efforts].sort((a, b) => a.elapsedSec - b.elapsedSec)
  const rankOf = new Map(fastest.map((e, i) => [e.id, i + 1]))

  const efforts: EffortView[] = segment.efforts.map(e => {
    const s = e.activity.stream
    const time = nums(s?.time)
    const lat = s?.latitude as (number | null)[] | null | undefined
    const lng = s?.longitude as (number | null)[] | null | undefined
    const series =
      time && lat && lng
        ? effortSpeedSeries(geometry, { time, latitude: lat, longitude: lng }, e.startIndex, e.endIndex)
        : []
    return {
      id: e.id,
      activityId: e.activity.id,
      runName: e.activity.name,
      date: e.date.toISOString(),
      elapsedSec: e.elapsedSec,
      avgHeartRate: e.avgHeartRate,
      apparentTempC: e.activity.weatherApparentTempC,
      rank: rankOf.get(e.id)!,
      series,
    }
  })

  return (
    <SegmentDetail
      segment={{
        id: segment.id,
        name: segment.name,
        pinned: segment.pinned,
        lengthM: segment.lengthM,
        gainM: elevationGain(segment.elevation),
        geometry,
        elevation: nums(segment.elevation),
      }}
      efforts={efforts}
      isAdmin={isAdmin}
    />
  )
}
