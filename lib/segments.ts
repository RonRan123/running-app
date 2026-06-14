import {
  gradeAdjustedVelocity,
  integrateDistance,
  smoothSeries,
  type RunStreams,
} from '@/lib/runAnalysis'

export interface LatLng {
  lat: number
  lng: number
}

// A run matches a segment when it passes within this distance of both the
// start and end points, in order.
export const MATCH_RADIUS_M = 50

const EARTH_RADIUS_M = 6371000

export function haversineM(a: LatLng, b: LatLng): number {
  const dLat = ((b.lat - a.lat) * Math.PI) / 180
  const dLng = ((b.lng - a.lng) * Math.PI) / 180
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) *
      Math.cos((b.lat * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2
  return EARTH_RADIUS_M * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h))
}

/** Cumulative meters along a GPS track, index-aligned with the track. */
export function cumulativeMeters(points: LatLng[]): number[] {
  const out = new Array<number>(points.length)
  out[0] = 0
  for (let i = 1; i < points.length; i++) {
    out[i] = out[i - 1] + haversineM(points[i - 1], points[i])
  }
  return out
}

/**
 * Evenly thin a polyline to at most `maxPoints`, always keeping the first and
 * last point — segment reference tracks don't need per-second resolution.
 */
export function downsamplePolyline(points: LatLng[], maxPoints = 300): LatLng[] {
  if (points.length <= maxPoints) return points
  const out: LatLng[] = []
  for (let i = 0; i < maxPoints; i++) {
    out.push(points[Math.round((i * (points.length - 1)) / (maxPoints - 1))])
  }
  return out
}

export interface SegmentGeometry {
  startLat: number
  startLng: number
  endLat: number
  endLng: number
  distance: number // km along the reference polyline
}

interface Pass {
  entryIdx: number // coordinate index of closest approach to start
  exitIdx: number // coordinate index of closest approach to end
}

/**
 * Within a contiguous cluster of samples inside the match radius, return the
 * index of closest approach. Starts at `from`, which must be inside the
 * radius; ends when the track leaves the radius.
 */
function closestInCluster(coords: LatLng[], from: number, gate: LatLng): number {
  let best = from
  let bestDist = haversineM(coords[from], gate)
  for (let i = from + 1; i < coords.length; i++) {
    const d = haversineM(coords[i], gate)
    if (d > MATCH_RADIUS_M) break
    if (d < bestDist) {
      best = i
      bestDist = d
    }
  }
  return best
}

/**
 * Find every pass of a GPS track through the segment's start → end gates in
 * order. The distance covered between the gates must roughly match the
 * segment length, so a run that hits both endpoints via a different route
 * (or after a long detour) doesn't count as an effort on this segment.
 * A reverse-direction run never matches: it reaches the end gate first, and
 * no end-gate hit follows its start-gate hit.
 */
export function findPasses(
  coords: LatLng[],
  segment: SegmentGeometry,
  cumM?: number[],
): Pass[] {
  const start: LatLng = { lat: segment.startLat, lng: segment.startLng }
  const end: LatLng = { lat: segment.endLat, lng: segment.endLng }
  const cum = cumM ?? cumulativeMeters(coords)
  const segMeters = segment.distance * 1000
  const tolerance = Math.max(segMeters * 0.25, 200)

  const passes: Pass[] = []
  let i = 0
  while (i < coords.length) {
    // Advance to the next start-gate hit
    while (i < coords.length && haversineM(coords[i], start) > MATCH_RADIUS_M) i++
    if (i >= coords.length) break
    const entryIdx = closestInCluster(coords, i, start)

    // Scan forward for an end-gate hit whose along-track distance fits
    let j = entryIdx + 1
    let exitIdx = -1
    while (j < coords.length) {
      while (j < coords.length && haversineM(coords[j], end) > MATCH_RADIUS_M) j++
      if (j >= coords.length) break
      const candidate = closestInCluster(coords, j, end)
      if (Math.abs(cum[candidate] - cum[entryIdx] - segMeters) <= tolerance) {
        exitIdx = candidate
        break
      }
      // Skip past this cluster and keep looking
      while (j < coords.length && haversineM(coords[j], end) <= MATCH_RADIUS_M) j++
    }

    if (exitIdx === -1) {
      // No valid exit after this entry; later entries can't do better
      // for this entry — move past it and try the next start-gate hit.
      i = entryIdx + 1
      while (i < coords.length && haversineM(coords[i], start) <= MATCH_RADIUS_M) i++
      continue
    }

    passes.push({ entryIdx, exitIdx })
    i = exitIdx + 1
  }

  return passes
}

/**
 * Map a coordinate index to a stream sample index. When the GPS track and the
 * streams have the same length they come from the same samples — use the
 * index directly. Otherwise align by fraction of total distance, which
 * cancels the systematic offset between GPS track length and device-recorded
 * distance.
 */
function streamIndexFor(
  coordIdx: number,
  coordCum: number[],
  streamDist: number[],
): number {
  if (coordCum.length === streamDist.length) return coordIdx

  const coordTotal = coordCum[coordCum.length - 1]
  const streamTotal = streamDist[streamDist.length - 1]
  if (coordTotal <= 0 || streamTotal <= 0) return 0
  const target = (coordCum[coordIdx] / coordTotal) * streamTotal

  // Binary search for the first stream sample at or past the target distance
  let lo = 0
  let hi = streamDist.length - 1
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (streamDist[mid] < target) lo = mid + 1
    else hi = mid
  }
  return lo
}

export interface EffortStats {
  startIdx: number // stream sample index at segment entry
  endIdx: number // stream sample index at segment exit
  elapsed: number // seconds
  avgHr: number | null
  avgPace: number | null // min/km
  avgGap: number | null // min/km
  elevGain: number | null // meters
}

/** Effort stats over a stream window. Returns null for degenerate windows. */
export function effortStats(
  streams: RunStreams,
  startIdx: number,
  endIdx: number,
): EffortStats | null {
  const { time, heartrate, altitude } = streams
  if (startIdx >= endIdx || endIdx >= time.length) return null
  const elapsed = time[endIdx] - time[startIdx]
  if (elapsed <= 0) return null

  const distance = streams.distance ?? integrateDistance(streams)
  const distM = distance ? distance[endIdx] - distance[startIdx] : 0

  const gapVel = gradeAdjustedVelocity(streams)
  const smoothAlt = altitude ? smoothSeries(time, altitude, 30) : null

  let hrSum = 0
  let hrTime = 0
  let gapDist = 0
  let elevGain = 0
  for (let i = startIdx + 1; i <= endIdx; i++) {
    const dt = time[i] - time[i - 1]
    if (dt <= 0) continue
    if (heartrate && heartrate[i] > 0) {
      hrSum += heartrate[i] * dt
      hrTime += dt
    }
    if (gapVel) gapDist += gapVel[i] * dt
    if (smoothAlt) {
      const dAlt = smoothAlt[i] - smoothAlt[i - 1]
      if (dAlt > 0) elevGain += dAlt
    }
  }

  return {
    startIdx,
    endIdx,
    elapsed,
    avgHr: hrTime > 0 ? Math.round(hrSum / hrTime) : null,
    avgPace: distM > 10 ? elapsed / 60 / (distM / 1000) : null,
    avgGap: gapDist > 10 ? elapsed / 60 / (gapDist / 1000) : null,
    elevGain: smoothAlt ? Math.round(elevGain) : null,
  }
}

export interface EffortPoint {
  t: number // seconds since segment entry
  hr: number | null
  pace: number | null // min/km
  gap: number | null // min/km
}

function velocityToMinPerKm(v: number): number | null {
  if (v < 0.5) return null // standing still — pace is meaningless
  const pace = 1000 / v / 60
  return pace > 20 ? null : pace
}

/**
 * Chart series for one effort, time-aligned to the segment entry (t = 0).
 * Smoothing runs over the whole stream first so the window edges aren't
 * distorted, then the window is sliced out and thinned to `maxPoints`.
 */
export function effortSeries(
  streams: RunStreams,
  startIdx: number,
  endIdx: number,
  maxPoints = 200,
): EffortPoint[] {
  const { time, heartrate, velocity } = streams
  if (startIdx >= endIdx || endIdx >= time.length) return []

  const smoothHr = heartrate ? smoothSeries(time, heartrate, 10) : null
  const smoothVel = velocity ? smoothSeries(time, velocity, 30) : null
  const gapVelRaw = gradeAdjustedVelocity(streams)
  const smoothGap = gapVelRaw ? smoothSeries(time, gapVelRaw, 30) : null

  const n = endIdx - startIdx + 1
  const count = Math.min(n, maxPoints)
  const points: EffortPoint[] = []
  for (let k = 0; k < count; k++) {
    const i = startIdx + Math.round((k * (n - 1)) / Math.max(1, count - 1))
    points.push({
      t: time[i] - time[startIdx],
      hr: smoothHr && smoothHr[i] > 0 ? Math.round(smoothHr[i]) : null,
      pace: smoothVel ? velocityToMinPerKm(smoothVel[i]) : null,
      gap: smoothGap ? velocityToMinPerKm(smoothGap[i]) : null,
    })
  }
  return points
}

/**
 * Match one run against one segment. Returns the fastest qualifying pass as
 * stream-indexed effort stats, or null when the run doesn't match or has no
 * usable streams.
 */
export function matchRun(
  coords: LatLng[],
  streams: RunStreams | null,
  segment: SegmentGeometry,
): EffortStats | null {
  if (!streams || coords.length < 2 || streams.time.length < 2) return null
  const streamDist = streams.distance ?? integrateDistance(streams)
  if (!streamDist) return null

  const coordCum = cumulativeMeters(coords)
  const passes = findPasses(coords, segment, coordCum)

  let best: EffortStats | null = null
  for (const pass of passes) {
    const si = streamIndexFor(pass.entryIdx, coordCum, streamDist)
    const sj = streamIndexFor(pass.exitIdx, coordCum, streamDist)
    const stats = effortStats(streams, si, sj)
    if (stats && (!best || stats.elapsed < best.elapsed)) best = stats
  }
  return best
}
