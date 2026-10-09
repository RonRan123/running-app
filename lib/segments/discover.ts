// Automatic segment discovery: overlay every run on a grid, find the stretches
// many runs share, and rank them by how many distinct runs covered them.
// Same family as tracematch's section detection and KDE map inference — see
// PRODUCT.md (Wave 13 → prior art) for the comparison.

import { dist, pathLength, projectionAround, resample, type LatLng, type XY } from './geo'

export interface DiscoveryTrack {
  id: string
  points: LatLng[]
}

export interface DiscoveryOptions {
  stepM: number // resampling spacing
  cellM: number // grid cell size
  minRuns: number // hot-cell support floor (distinct runs)
  minLengthM: number // shortest segment worth reporting
  maxGapM: number // hot-stretch gaps bridged (GPS dropouts)
  splitJaccard: number // cut where the passing run set drifts below this similarity
  homeRadiusM: number // ground this close to a frequent start point is ignored
  maxOverlap: number // picked segments may share at most this share of cells
  limit: number
}

export const DEFAULT_OPTIONS: DiscoveryOptions = {
  stepM: 10,
  cellM: 20,
  minRuns: 5,
  minLengthM: 800,
  maxGapM: 50,
  splitJaccard: 0.7,
  homeRadiusM: 300,
  maxOverlap: 0.3,
  limit: 5,
}

export interface DiscoveredSegment {
  geometry: LatLng[] // the medoid run's own points, resampled
  lengthM: number
  runIds: string[] // distinct runs covering the whole segment (same direction)
  sourceRunId: string // whose trace became the geometry
}

type Cell = string
const cellKey = (p: XY, size: number): Cell => `${Math.floor(p.x / size)},${Math.floor(p.y / size)}`

function neighbourhood(p: XY, size: number): Cell[] {
  const cx = Math.floor(p.x / size)
  const cy = Math.floor(p.y / size)
  const out: Cell[] = []
  for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) out.push(`${cx + dx},${cy + dy}`)
  return out
}

function jaccard(a: Set<number>, b: Set<number>) {
  if (a.size === 0 && b.size === 0) return 1
  let inter = 0
  for (const x of a) if (b.has(x)) inter++
  return inter / (a.size + b.size - inter)
}

interface Piece {
  run: number
  points: XY[]
  support: Set<number> // runs present along ≥ 90 % of the piece
  cells: Set<Cell>
}

/** Share of `a`'s points that fall in `b`'s dilated cells (≈ within one cell). */
function coverage(a: Piece, bDilated: Set<Cell>, size: number) {
  let hit = 0
  for (const p of a.points) if (bDilated.has(cellKey(p, size))) hit++
  return hit / a.points.length
}

function dilate(points: XY[], size: number) {
  const out = new Set<Cell>()
  for (const p of points) for (const c of neighbourhood(p, size)) out.add(c)
  return out
}

export function discoverSegments(
  tracks: DiscoveryTrack[],
  options: Partial<DiscoveryOptions> = {},
): DiscoveredSegment[] {
  const o = { ...DEFAULT_OPTIONS, ...options }
  const usable = tracks.filter(t => t.points.length > 1)
  if (usable.length === 0) return []

  // 1. Project + resample every run.
  const origin = usable[0].points[0]
  const proj = projectionAround(origin)
  const runs = usable.map(t => resample(t.points.map(proj.toXY), o.stepM))

  // Frequent starts (200 m buckets) — the "front doors" to ignore. Every
  // bucket with at least minRuns starts counts, since a runner can have more
  // than one home base (e.g. two cities).
  const startBuckets = new Map<string, { n: number; p: XY }>()
  for (const r of runs) {
    const k = cellKey(r[0], 200)
    const b = startBuckets.get(k) ?? { n: 0, p: r[0] }
    b.n++
    startBuckets.set(k, b)
  }
  const homes = [...startBuckets.values()].filter(b => b.n >= o.minRuns).map(b => b.p)
  const nearHome = (p: XY) => homes.some(h => dist(p, h) <= o.homeRadiusM)

  // 2. Overlay: which distinct runs touch each cell (dilated by one ring).
  const cellRuns = new Map<Cell, Set<number>>()
  runs.forEach((r, i) => {
    for (const c of dilate(r, o.cellM)) {
      let s = cellRuns.get(c)
      if (!s) cellRuns.set(c, (s = new Set()))
      s.add(i)
    }
  })

  // 3–5. Walk each run: hot stretches, split where the passing run set changes.
  const maxGap = Math.round(o.maxGapM / o.stepM)
  const minPts = Math.round(o.minLengthM / o.stepM)
  const pieces: Piece[] = []

  runs.forEach((r, runIdx) => {
    const sets = r.map(p => cellRuns.get(cellKey(p, o.cellM)) ?? new Set<number>())
    const hot = r.map((p, i) => sets[i].size >= o.minRuns && !nearHome(p))

    let start = -1
    let gap = 0
    const stretches: [number, number][] = []
    for (let i = 0; i <= r.length; i++) {
      if (i < r.length && hot[i]) {
        if (start < 0) start = i
        gap = 0
      } else if (start >= 0) {
        gap++
        if (gap > maxGap || i === r.length) {
          stretches.push([start, i - gap])
          start = -1
          gap = 0
        }
      }
    }

    for (const [s, e] of stretches) {
      let pieceStart = s
      let ref = sets[s]
      let drift = 0
      for (let i = s + 1; i <= e + 1; i++) {
        const end = i > e
        if (!end && jaccard(sets[i], ref) >= o.splitJaccard) {
          drift = 0
          continue
        }
        drift++
        // Require 3 consecutive drifting points (30 m) so cell noise doesn't cut.
        if (!end && drift < 3) continue
        const cut = end ? e + 1 : i - 2
        if (cut - pieceStart >= minPts) {
          const pts = r.slice(pieceStart, cut)
          const counts = new Map<number, number>()
          for (let k = pieceStart; k < cut; k++) for (const x of sets[k]) counts.set(x, (counts.get(x) ?? 0) + 1)
          const support = new Set(
            [...counts].filter(([, n]) => n >= 0.9 * (cut - pieceStart)).map(([x]) => x),
          )
          if (support.size >= o.minRuns) {
            pieces.push({ run: runIdx, points: pts, support, cells: new Set(pts.map(p => cellKey(p, o.cellM))) })
          }
        }
        pieceStart = cut
        ref = sets[Math.min(cut, e)]
        drift = 0
      }
    }
  })

  // 6–7. Merge duplicates (same stretch, same direction) into clusters.
  pieces.sort((a, b) => b.support.size - a.support.size || b.points.length - a.points.length)
  const clusters: { members: Piece[]; dilated: Set<Cell>; rep: Piece }[] = []
  for (const piece of pieces) {
    const pieceDilated = dilate(piece.points, o.cellM)
    const match = clusters.find(c => {
      const sameDir =
        dist(piece.points[0], c.rep.points[0]) < dist(piece.points[0], c.rep.points[c.rep.points.length - 1])
      return (
        sameDir &&
        coverage(piece, c.dilated, o.cellM) >= 0.8 &&
        coverage(c.rep, pieceDilated, o.cellM) >= 0.8
      )
    })
    if (match) match.members.push(piece)
    else clusters.push({ members: [piece], dilated: pieceDilated, rep: piece })
  }

  // Medoid: the member that best covers (and is covered by) all the others.
  const results = clusters.map(c => {
    let best = c.members[0]
    let bestScore = -1
    if (c.members.length > 1) {
      const dilated = c.members.map(m => dilate(m.points, o.cellM))
      c.members.forEach((m, i) => {
        let score = 0
        c.members.forEach((n, j) => {
          if (i !== j) score += coverage(m, dilated[j], o.cellM) + coverage(n, dilated[i], o.cellM)
        })
        if (score > bestScore) {
          bestScore = score
          best = m
        }
      })
    }
    const support = new Set<number>()
    for (const m of c.members) for (const x of m.support) support.add(x)
    // Only runs that themselves produced a member ran it in this direction.
    const runsHere = new Set(c.members.map(m => m.run))
    const runIds = [...support].filter(x => runsHere.has(x))
    return { rep: best, runIds, lengthM: pathLength(best.points) }
  })

  // 8–9. Rank by distinct runs, then length; skip heavy overlaps.
  results.sort((a, b) => b.runIds.length - a.runIds.length || b.lengthM - a.lengthM)
  const picked: typeof results = []
  for (const r of results) {
    if (picked.length >= o.limit) break
    const overlaps = picked.some(p => {
      let shared = 0
      for (const c of r.rep.cells) if (p.rep.cells.has(c)) shared++
      return shared / r.rep.cells.size > o.maxOverlap
    })
    if (!overlaps) picked.push(r)
  }

  return picked.map(r => ({
    geometry: r.rep.points.map(proj.toLatLng),
    lengthM: r.lengthM,
    runIds: r.runIds.map(i => usable[i].id),
    sourceRunId: usable[r.rep.run].id,
  }))
}
