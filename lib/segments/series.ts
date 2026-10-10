// Speed along a segment for one effort, on the segment's own distance axis,
// so hills line up across efforts no matter how each run's GPS drifted.

import { dist, projectionAround, type LatLng, type XY } from './geo'
import type { RunSamples } from './match'

const BIN_M = 20

export interface SpeedPoint {
  d: number // meters along the segment (bin end)
  speed: number // m/s over the bin
}

/**
 * Monotone alignment of samples to segment vertices: each sample maps to a
 * vertex, never earlier than the previous sample's, minimising total
 * distance (dynamic programming, O(samples × vertices)). Greedy nearest-point
 * projection breaks on GPS wobbles at stops and corners; with alignment,
 * jumping ahead makes every later sample fit worse, so it doesn't happen.
 */
function alignToSegment(samples: XY[], seg: XY[]): number[] {
  const n = samples.length
  const m = seg.length
  let prev = new Float64Array(m)
  let cur = new Float64Array(m)
  const back = new Int32Array(n * m) // best predecessor vertex for (i, j)

  for (let j = 0; j < m; j++) prev[j] = dist(samples[0], seg[j]) + j // nudge the start toward vertex 0
  for (let i = 1; i < n; i++) {
    let bestPrev = 0
    for (let j = 0; j < m; j++) {
      if (prev[j] < prev[bestPrev]) bestPrev = j
      cur[j] = prev[bestPrev] + dist(samples[i], seg[j])
      back[i * m + j] = bestPrev
    }
    ;[prev, cur] = [cur, prev]
  }

  // The effort ends at the end crossing, so finish on the last vertex.
  const path = new Array<number>(n)
  path[n - 1] = m - 1
  for (let i = n - 1; i > 0; i--) path[i - 1] = back[i * m + path[i]]
  return path
}

export function effortSpeedSeries(
  geometry: LatLng[],
  run: RunSamples,
  startIndex: number,
  endIndex: number,
): SpeedPoint[] {
  const proj = projectionAround(geometry[0])
  const seg = geometry.map(proj.toXY)
  const cum = [0]
  for (let i = 1; i < seg.length; i++) cum.push(cum[i - 1] + dist(seg[i - 1], seg[i]))
  const total = cum[cum.length - 1]

  const pts: XY[] = []
  const times: number[] = []
  for (let i = startIndex; i <= endIndex && i < run.time.length; i++) {
    const lat = run.latitude[i]
    const lng = run.longitude[i]
    if (lat == null || lng == null) continue
    pts.push(proj.toXY({ lat, lng }))
    times.push(run.time[i])
  }
  if (pts.length < 2 || seg.length < 2) return []

  // Refine each aligned vertex to the exact foot of the perpendicular on the
  // neighbouring edges, then keep distance-along non-decreasing.
  const path = alignToSegment(pts, seg)
  const along: number[] = []
  pts.forEach((p, i) => {
    const j = path[i]
    let best = { d: Infinity, s: cum[j] }
    for (const [a, b] of [
      [j - 1, j],
      [j, j + 1],
    ]) {
      if (a < 0 || b >= seg.length) continue
      const A = seg[a]
      const B = seg[b]
      const dx = B.x - A.x
      const dy = B.y - A.y
      const len2 = dx * dx + dy * dy
      const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - A.x) * dx + (p.y - A.y) * dy) / len2))
      const d = Math.hypot(p.x - (A.x + t * dx), p.y - (A.y + t * dy))
      if (d < best.d) best = { d, s: cum[a] + t * Math.sqrt(len2) }
    }
    along.push(Math.max(i > 0 ? along[i - 1] : 0, best.s))
  })

  // Time each 20 m bin boundary is crossed (linear interpolation).
  const crossings: number[] = []
  let idx = 1
  for (let b = 0; b <= total; b += BIN_M) {
    while (idx < along.length && along[idx] < b) idx++
    if (idx >= along.length) break
    const s0 = along[idx - 1]
    const s1 = along[idx]
    const f = s1 === s0 ? 0 : (b - s0) / (s1 - s0)
    crossings.push(times[idx - 1] + Math.max(0, Math.min(1, f)) * (times[idx] - times[idx - 1]))
  }

  // Speed per bin, smoothed over a 100 m window as distance ÷ time (not an
  // average of speeds, which a GPS corner-cut spike would dominate).
  const dts: number[] = []
  for (let i = 1; i < crossings.length; i++) dts.push(crossings[i] - crossings[i - 1])
  const HALF = 2
  const out: SpeedPoint[] = []
  for (let i = 0; i < dts.length; i++) {
    const lo = Math.max(0, i - HALF)
    const hi = Math.min(dts.length - 1, i + HALF)
    let t = 0
    for (let k = lo; k <= hi; k++) t += dts[k]
    if (t > 0) out.push({ d: (i + 1) * BIN_M, speed: ((hi - lo + 1) * BIN_M) / t })
  }
  return out
}
