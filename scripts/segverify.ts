// Read-only verification of segment matching against real database runs:
// builds an in-memory segment from a recent run's track and reports which
// other runs would match. Nothing is written.
import { prisma } from '../lib/prisma'
import { cumulativeMeters, downsamplePolyline, matchRun } from '../lib/segments'
import { parseCoords, parseStreams } from '../lib/segmentMatching'

async function main() {
  const activities = await prisma.activity.findMany({
    orderBy: { date: 'desc' },
    include: { stream: true },
  })
  console.log(`${activities.length} activities total`)

  const withGps = activities
    .map(a => ({ a, coords: parseCoords(a.coordinates), streams: parseStreams(a.stream) }))
    .filter(x => x.coords.length > 10 && x.streams)
  console.log(`${withGps.length} with GPS + streams`)
  if (withGps.length === 0) return

  const source = withGps[0]
  const coords = source.coords
  const cum = cumulativeMeters(coords)
  const total = cum[cum.length - 1]

  // Segment = middle stretch of the source run, ~40% of its length
  const startM = total * 0.3
  const endM = total * 0.7
  const startIdx = cum.findIndex(m => m >= startM)
  const endIdx = cum.findIndex(m => m >= endM)
  const slice = coords.slice(startIdx, endIdx + 1)
  const sliceCum = cumulativeMeters(slice)
  const meters = sliceCum[sliceCum.length - 1]

  const segment = {
    startLat: slice[0].lat,
    startLng: slice[0].lng,
    endLat: slice[slice.length - 1].lat,
    endLng: slice[slice.length - 1].lng,
    distance: Math.round(meters / 10) / 100,
    polyline: downsamplePolyline(slice),
  }
  console.log(
    `\nSegment from "${source.a.name}" (${source.a.date.toISOString().slice(0, 10)}): ${segment.distance} km\n`,
  )

  let matched = 0
  for (const { a, coords: c, streams } of withGps) {
    const stats = matchRun(c, streams, segment)
    if (!stats) continue
    matched++
    const pace = stats.avgPace
      ? `${Math.floor(stats.avgPace)}:${String(Math.round((stats.avgPace % 1) * 60)).padStart(2, '0')}/km`
      : '—'
    console.log(
      `MATCH ${a.date.toISOString().slice(0, 10)}  ${a.name.padEnd(32).slice(0, 32)} ` +
        `${String(stats.elapsed).padStart(5)}s  ${pace.padStart(9)}  ${stats.avgHr ?? '—'} bpm  ` +
        `gap=${stats.avgGap?.toFixed(2) ?? '—'}  elev+${stats.elevGain ?? '—'}m`,
    )
  }
  console.log(`\n${matched}/${withGps.length} runs matched (source run itself should be among them)`)
}

main()
  .catch(e => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
