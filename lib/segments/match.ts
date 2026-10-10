// Find every pass through a segment within one run. Needs time-aligned GPS
// (ActivityStream.latitude/longitude), so efforts can be timed.

import { dist, projectionAround, resample, type LatLng, type XY } from './geo'

export interface MatchOptions {
  endpointRadiusM: number // how close a pass must come to the segment's start / end
  lengthTolerance: number // run path between start and end within ±this of segment length
  corridorM: number // shape check: points within this of the other line…
  minCoverage: number // …for at least this share, both ways
}

export const DEFAULT_MATCH: MatchOptions = {
  endpointRadiusM: 50,
  lengthTolerance: 0.15,
  corridorM: 40,
  minCoverage: 0.9,
}

export interface RunSamples {
  time: number[]
  latitude: (number | null)[]
  longitude: (number | null)[]
}

export interface MatchedEffort {
  startIndex: number // sample at/just before the start crossing
  endIndex: number // sample at/just after the end crossing
  startSec: number // interpolated crossing times
  endSec: number
}

function pointToSegment(p: XY, a: XY, b: XY) {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const len2 = dx * dx + dy * dy
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2))
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy))
}

function distToLine(p: XY, line: XY[]) {
  let best = Infinity
  for (let i = 1; i < line.length; i++) best = Math.min(best, pointToSegment(p, line[i - 1], line[i]))
  return line.length === 1 ? dist(p, line[0]) : best
}

function coverage(points: XY[], line: XY[], corridor: number) {
  if (points.length === 0) return 0
  let hit = 0
  for (const p of points) if (distToLine(p, line) <= corridor) hit++
  return hit / points.length
}

/**
 * Passes near `target`: each maximal run of samples within `radius`, reduced
 * to its closest sample. Returns sample indices in order.
 */
function passesNear(pts: (XY | null)[], target: XY, radius: number, from = 0): number[] {
  const out: number[] = []
  let best = -1
  let bestD = Infinity
  for (let i = from; i <= pts.length; i++) {
    const p = i < pts.length ? pts[i] : null
    const d = p ? dist(p, target) : Infinity
    if (d <= radius) {
      if (d < bestD) {
        bestD = d
        best = i
      }
    } else if (best >= 0 && (p !== null || i === pts.length)) {
      out.push(best)
      best = -1
      bestD = Infinity
    }
  }
  return out
}

/**
 * Time the sample pair around `near` crosses the line through `origin`
 * perpendicular to `dir` (the segment's running direction there). Falls back
 * to the closest sample's own time when the track never crosses it cleanly.
 */
function crossing(
  pts: (XY | null)[],
  time: number[],
  near: number,
  origin: XY,
  dir: XY,
  window: number,
): { index: number; sec: number; after: number } {
  const along = (p: XY) => (p.x - origin.x) * dir.x + (p.y - origin.y) * dir.y
  const lo = Math.max(0, near - window)
  const hi = Math.min(pts.length - 1, near + window)
  for (let i = lo; i < hi; i++) {
    const a = pts[i]
    const b = pts[i + 1]
    if (!a || !b) continue
    const sa = along(a)
    const sb = along(b)
    if (sa <= 0 && sb > 0) {
      const f = -sa / (sb - sa)
      return { index: i, sec: time[i] + f * (time[i + 1] - time[i]), after: i + 1 }
    }
  }
  return { index: near, sec: time[near], after: near }
}

function unit(a: XY, b: XY): XY {
  const l = dist(a, b) || 1
  return { x: (b.x - a.x) / l, y: (b.y - a.y) / l }
}

export function matchEfforts(
  segment: LatLng[],
  run: RunSamples,
  options: Partial<MatchOptions> = {},
): MatchedEffort[] {
  const o = { ...DEFAULT_MATCH, ...options }
  if (segment.length < 2) return []
  const proj = projectionAround(segment[0])
  const seg = segment.map(proj.toXY)
  const segStart = seg[0]
  const segEnd = seg[seg.length - 1]
  let segLen = 0
  for (let i = 1; i < seg.length; i++) segLen += dist(seg[i - 1], seg[i])

  // Bounding-box prefilter (segment bbox + corridor).
  const pad = 50
  const minX = Math.min(...seg.map(p => p.x)) - pad
  const maxX = Math.max(...seg.map(p => p.x)) + pad
  const minY = Math.min(...seg.map(p => p.y)) - pad
  const maxY = Math.max(...seg.map(p => p.y)) + pad

  const pts: (XY | null)[] = run.time.map((_, i) => {
    const lat = run.latitude[i]
    const lng = run.longitude[i]
    return lat == null || lng == null ? null : proj.toXY({ lat, lng })
  })
  if (!pts.some(p => p && p.x >= minX && p.x <= maxX && p.y >= minY && p.y <= maxY)) return []

  // Cumulative path length per sample, skipping GPS dropouts.
  const cum: number[] = new Array(pts.length).fill(0)
  let last: XY | null = null
  for (let i = 0; i < pts.length; i++) {
    cum[i] = i > 0 ? cum[i - 1] : 0
    const p = pts[i]
    if (p) {
      if (last) cum[i] += dist(last, p)
      last = p
    }
  }

  const startDir = unit(seg[0], seg[Math.min(3, seg.length - 1)])
  const endDir = unit(seg[Math.max(0, seg.length - 4)], segEnd)
  const efforts: MatchedEffort[] = []
  let searchFrom = 0

  for (const s of passesNear(pts, segStart, o.endpointRadiusM)) {
    if (s < searchFrom) continue
    // First pass near the end after this start, within the length budget.
    const e = passesNear(pts, segEnd, o.endpointRadiusM, s + 1).find(
      i => cum[i] - cum[s] >= segLen * (1 - o.lengthTolerance),
    )
    if (e === undefined || cum[e] - cum[s] > segLen * (1 + o.lengthTolerance)) continue

    // Shape check, both ways, on 10 m resampled geometry.
    const slice = pts.slice(s, e + 1).filter((p): p is XY => p !== null)
    const sliceLine = resample(slice, 10)
    if (
      coverage(sliceLine, seg, o.corridorM) < o.minCoverage ||
      coverage(seg, sliceLine, o.corridorM) < o.minCoverage
    ) {
      continue
    }

    const start = crossing(pts, run.time, s, segStart, startDir, 15)
    const end = crossing(pts, run.time, e, segEnd, endDir, 15)
    if (end.sec <= start.sec) continue
    efforts.push({ startIndex: start.index, endIndex: end.after, startSec: start.sec, endSec: end.sec })
    searchFrom = e
  }

  return efforts
}
