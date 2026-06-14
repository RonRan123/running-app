import { cumulativeMeters, findPasses, matchRun, type LatLng } from '../lib/segments'
import type { RunStreams } from '../lib/runAnalysis'

// Straight track heading north, points ~10 m apart
const M_PER_DEG_LAT = 111320
const step = 10 / M_PER_DEG_LAT
const N = 200

function straightTrack(n = N): LatLng[] {
  return Array.from({ length: n }, (_, i) => ({ lat: 40.7 + i * step, lng: -74.0 }))
}

function streamsFor(coords: LatLng[], secondsPerPoint = 3): RunStreams {
  const cum = cumulativeMeters(coords)
  const time = coords.map((_, i) => i * secondsPerPoint)
  return {
    time,
    heartrate: coords.map(() => 150),
    velocity: coords.map((_, i) => (i === 0 ? 0 : (cum[i] - cum[i - 1]) / secondsPerPoint)),
    altitude: coords.map(() => 10),
    cadence: null,
    distance: cum,
  }
}

const track = straightTrack()
const segStart = 20
const segEnd = 80
const segCoords = track.slice(segStart, segEnd + 1)
const segCum = cumulativeMeters(segCoords)
const segment = {
  startLat: segCoords[0].lat,
  startLng: segCoords[0].lng,
  endLat: segCoords[segCoords.length - 1].lat,
  endLng: segCoords[segCoords.length - 1].lng,
  distance: segCum[segCum.length - 1] / 1000,
}

let failures = 0
function check(label: string, ok: boolean, detail = '') {
  if (!ok) failures++
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? ` — ${detail}` : ''}`)
}

// 1. Same route matches with correct window
{
  const passes = findPasses(track, segment)
  check('same-route match', passes.length === 1)
  if (passes.length === 1) {
    check(
      'entry/exit indices',
      Math.abs(passes[0].entryIdx - segStart) <= 1 && Math.abs(passes[0].exitIdx - segEnd) <= 1,
      `got ${passes[0].entryIdx}..${passes[0].exitIdx}, want ~${segStart}..${segEnd}`,
    )
  }
  const stats = matchRun(track, streamsFor(track), segment)
  check('effort stats exist', stats !== null)
  if (stats) {
    // 60 points * 3 s = 180 s expected
    check('elapsed', Math.abs(stats.elapsed - (segEnd - segStart) * 3) <= 3, `elapsed=${stats.elapsed}`)
    check('avgHr', stats.avgHr === 150, `avgHr=${stats.avgHr}`)
    // 600 m in 180 s = 5 min/km
    check('avgPace ~5:00/km', stats.avgPace !== null && Math.abs(stats.avgPace - 5) < 0.1, `pace=${stats.avgPace?.toFixed(3)}`)
  }
}

// 2. Reverse direction does not match
{
  const reversed = [...track].reverse()
  const passes = findPasses(reversed, segment)
  check('reverse direction rejected', passes.length === 0, `passes=${passes.length}`)
}

// 3. Detour between the gates (length mismatch) does not match
{
  // Head north to the segment start, detour far east, come back, continue north
  const detour: LatLng[] = [
    ...track.slice(0, 30),
    ...Array.from({ length: 60 }, (_, i) => ({ lat: track[30].lat, lng: -74.0 + (i + 1) * step })),
    ...Array.from({ length: 60 }, (_, i) => ({ lat: track[30].lat, lng: -74.0 + (60 - i - 1) * step })),
    ...track.slice(30),
  ]
  const passes = findPasses(detour, segment)
  check('detour rejected by length tolerance', passes.length === 0, `passes=${passes.length}`)
}

// 4. Run that does the segment twice (loop) → fastest pass wins
{
  const twice: LatLng[] = [...track, ...[...track].reverse().slice(1), ...track.slice(1)]
  const cum = cumulativeMeters(twice)
  const time = twice.map((_, i) => (i < N ? i * 3 : N * 3 + (i - N) * 2)) // second lap faster
  const streams: RunStreams = {
    time,
    heartrate: twice.map(() => 150),
    velocity: twice.map((_, i) => (i === 0 ? 0 : (cum[i] - cum[i - 1]) / Math.max(1, time[i] - time[i - 1]))),
    altitude: null,
    cadence: null,
    distance: cum,
  }
  const passes = findPasses(twice, segment)
  check('out-and-back + repeat = 2 passes', passes.length === 2, `passes=${passes.length}`)
  const stats = matchRun(twice, streams, segment)
  check('fastest pass kept', stats !== null && stats.elapsed < (segEnd - segStart) * 3, `elapsed=${stats?.elapsed}`)
}

// 5. Mismatched stream length (intervals.icu /map vs streams.json) still works
{
  const sparse = streamsFor(track)
  const half: RunStreams = {
    time: sparse.time.filter((_, i) => i % 2 === 0),
    heartrate: sparse.heartrate!.filter((_, i) => i % 2 === 0),
    velocity: sparse.velocity!.filter((_, i) => i % 2 === 0),
    altitude: sparse.altitude!.filter((_, i) => i % 2 === 0),
    cadence: null,
    distance: sparse.distance!.filter((_, i) => i % 2 === 0),
  }
  const stats = matchRun(track, half, segment)
  check('coord/stream length mismatch handled', stats !== null && Math.abs(stats.elapsed - 180) <= 8, `elapsed=${stats?.elapsed}`)
}

process.exit(failures === 0 ? 0 : 1)
