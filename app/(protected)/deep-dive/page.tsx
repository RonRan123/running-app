import { prisma } from '@/lib/prisma'
import { estimateMaxHr, trimp } from '@/lib/analysis'
import { computeSplits, downsampleStreams, type RunStreams } from '@/lib/runAnalysis'
import { KM_PER_MILE } from '@/lib/units'
import DeepDiveView from '@/components/deepdive/DeepDiveView'

function asNumberArray(value: unknown): number[] | null {
  return Array.isArray(value) && value.every(v => typeof v === 'number')
    ? (value as number[])
    : null
}

export default async function DeepDivePage({
  searchParams,
}: {
  searchParams: Promise<{ run?: string }>
}) {
  const { run } = await searchParams

  const [activities, settings] = await Promise.all([
    prisma.activity.findMany({
      orderBy: { date: 'desc' },
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
    prisma.userSettings.findUnique({ where: { id: 1 } }),
  ])

  if (activities.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-zinc-200 p-12 text-center text-sm text-zinc-400">
        No runs yet — sync with Intervals.icu or upload a GPX/FIT file to start deep diving.
      </div>
    )
  }

  const selected = activities.find(a => a.id === run) ?? activities[0]

  const full = await prisma.activity.findUnique({
    where: { id: selected.id },
    include: { stream: true },
  })

  let streams: RunStreams | null = null
  if (full?.stream) {
    const time = asNumberArray(full.stream.time)
    if (time) {
      streams = {
        time,
        heartrate: asNumberArray(full.stream.heartrate),
        velocity: asNumberArray(full.stream.velocity),
        altitude: asNumberArray(full.stream.altitude),
        cadence: asNumberArray(full.stream.cadence),
        distance: asNumberArray(full.stream.distance),
      }
    }
  }

  const maxHr = estimateMaxHr(
    activities.map(a => ({ ...a, date: a.date.toISOString() })),
  )

  // Splits are computed at full stream resolution; charts get a thinned copy.
  const splitsMi = streams ? computeSplits(streams, KM_PER_MILE * 1000) : []
  const splitsKm = streams ? computeSplits(streams, 1000) : []
  const chartStreams = streams ? downsampleStreams(streams) : null

  const runTrimp = selected.avgHeartRate
    ? trimp({ ...selected, date: selected.date.toISOString() }, maxHr)
    : null

  return (
    <DeepDiveView
      runs={activities.map(a => ({
        id: a.id,
        name: a.name,
        date: a.date.toISOString(),
      }))}
      activity={{
        id: selected.id,
        name: selected.name,
        date: selected.date.toISOString(),
        distance: selected.distance,
        duration: selected.duration,
        avgPace: selected.avgPace,
        avgHeartRate: selected.avgHeartRate,
        maxHeartRate: selected.maxHeartRate,
      }}
      coordinates={full?.coordinates ?? null}
      streams={chartStreams}
      splitsMi={splitsMi}
      splitsKm={splitsKm}
      trimp={runTrimp}
      maxHr={maxHr}
      initialAge={settings?.age ?? null}
    />
  )
}
