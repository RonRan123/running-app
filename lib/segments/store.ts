// Persistence for segments and efforts. Admin-side only: discovery and
// matching see every run, while reads for the demo account are filtered by
// date through the effort's copied `date` column.

import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { discoverSegments } from './discover'
import { matchEfforts, type RunSamples } from './match'
import { dist, overlapShare, projectionAround, type LatLng } from './geo'

const TOP_N = 5
// Discovery over-counts (a run that turns off near the end still supports the
// stretch), so rank a wider pool by real matched efforts and keep the best.
const CANDIDATE_POOL = 15
const SAME_SEGMENT_OVERLAP = 0.7

interface RunData {
  id: string
  date: Date
  coordinates: LatLng[] | null
  samples: RunSamples | null
  heartrate: number[] | null
  altitude: number[] | null
}

const asNumbers = (v: unknown) => (Array.isArray(v) ? (v as number[]) : null)

async function loadRuns(ids?: string[]): Promise<RunData[]> {
  const rows = await prisma.activity.findMany({
    where: ids ? { id: { in: ids } } : undefined,
    select: {
      id: true,
      date: true,
      coordinates: true,
      stream: { select: { time: true, heartrate: true, altitude: true, latitude: true, longitude: true } },
    },
  })
  return rows.map(r => {
    const coordinates = Array.isArray(r.coordinates) ? (r.coordinates as unknown as LatLng[]) : null
    const time = asNumbers(r.stream?.time)
    const lat = r.stream?.latitude as (number | null)[] | null | undefined
    const lng = r.stream?.longitude as (number | null)[] | null | undefined
    let samples: RunSamples | null = null
    if (time && lat && lng && lat.length === time.length && lng.length === time.length) {
      samples = { time, latitude: lat, longitude: lng }
    } else if (time && coordinates && coordinates.length === time.length) {
      // Runs with no GPS dropouts: the stored track is already time-aligned.
      samples = { time, latitude: coordinates.map(c => c.lat), longitude: coordinates.map(c => c.lng) }
    }
    return {
      id: r.id,
      date: r.date,
      coordinates,
      samples,
      heartrate: asNumbers(r.stream?.heartrate),
      altitude: asNumbers(r.stream?.altitude),
    }
  })
}

function avgOver(values: number[] | null, time: number[], from: number, to: number) {
  if (!values) return null
  let sum = 0
  let total = 0
  for (let i = from + 1; i <= to && i < time.length; i++) {
    const dt = time[i] - time[i - 1]
    if (dt <= 0 || dt > 10 || !(values[i] > 0)) continue
    sum += values[i] * dt
    total += dt
  }
  return total > 0 ? sum / total : null
}

type EffortRow = Omit<Prisma.SegmentEffortCreateManyInput, 'segmentId'>

function effortsFor(geometry: LatLng[], runs: RunData[]) {
  const rows: EffortRow[] = []
  for (const run of runs) {
    if (!run.samples) continue
    for (const e of matchEfforts(geometry, run.samples)) {
      rows.push({
        activityId: run.id,
        startIndex: e.startIndex,
        endIndex: e.endIndex,
        startSec: e.startSec,
        endSec: e.endSec,
        elapsedSec: e.endSec - e.startSec,
        avgHeartRate: avgOver(run.heartrate, run.samples.time, e.startIndex, e.endIndex),
        date: run.date,
      })
    }
  }
  return rows
}

/** Elevation along the segment, read from the most recent effort's altitude stream. */
function elevationProfile(geometry: LatLng[], efforts: EffortRow[], runs: RunData[]) {
  const byId = new Map(runs.map(r => [r.id, r]))
  const latest = [...efforts]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .find(e => byId.get(e.activityId)?.altitude)
  if (!latest) return null
  const run = byId.get(latest.activityId)!
  const proj = projectionAround(geometry[0])
  const window: { p: ReturnType<typeof proj.toXY>; alt: number }[] = []
  for (let i = latest.startIndex; i <= latest.endIndex; i++) {
    const lat = run.samples!.latitude[i]
    const lng = run.samples!.longitude[i]
    if (lat == null || lng == null) continue
    window.push({ p: proj.toXY({ lat, lng }), alt: run.altitude![i] })
  }
  if (window.length === 0) return null
  return geometry.map(g => {
    const q = proj.toXY(g)
    let best = window[0]
    for (const w of window) if (dist(w.p, q) < dist(best.p, q)) best = w
    return Math.round(best.alt * 10) / 10
  })
}

/**
 * Fallback elevation from Open-Meteo's terrain model (Copernicus DEM, 90 m;
 * free, no key) when no matching run recorded altitude. Coarser than a
 * barometric altimeter but fine for a profile. Never throws.
 */
async function demElevation(geometry: LatLng[]): Promise<number[] | null> {
  try {
    const out: number[] = []
    for (let i = 0; i < geometry.length; i += 100) {
      const chunk = geometry.slice(i, i + 100)
      const params = new URLSearchParams({
        latitude: chunk.map(p => p.lat.toFixed(5)).join(','),
        longitude: chunk.map(p => p.lng.toFixed(5)).join(','),
      })
      const res = await fetch(`https://api.open-meteo.com/v1/elevation?${params}`, { cache: 'no-store' })
      if (!res.ok) return null
      const data = (await res.json()) as { elevation?: number[] }
      if (!Array.isArray(data.elevation) || data.elevation.length !== chunk.length) return null
      out.push(...data.elevation)
    }
    return out
  } catch {
    return null
  }
}

function sameSegment(a: LatLng[], b: LatLng[]) {
  const proj = projectionAround(a[0])
  const ax = a.map(proj.toXY)
  const bx = b.map(proj.toXY)
  const sameDirection = dist(ax[0], bx[0]) < dist(ax[0], bx[bx.length - 1])
  return (
    sameDirection &&
    overlapShare(ax, bx, 30) >= SAME_SEGMENT_OVERLAP &&
    overlapShare(bx, ax, 30) >= SAME_SEGMENT_OVERLAP
  )
}

/**
 * Re-run discovery and keep the top segments. Stable across runs: a new
 * candidate that overlaps an existing segment updates it in place (keeping a
 * user-chosen name), and pinned segments are never dropped.
 */
export async function rediscoverSegments() {
  const runs = await loadRuns()
  const tracks = runs
    .filter(r => r.coordinates && r.coordinates.length > 1)
    .map(r => ({ id: r.id, points: r.coordinates! }))

  const ranked = discoverSegments(tracks, { limit: CANDIDATE_POOL })
    .map(c => {
      const efforts = effortsFor(c.geometry, runs)
      return { ...c, efforts, strength: new Set(efforts.map(e => e.activityId)).size }
    })
    .filter(c => c.strength > 0)
    .sort((a, b) => b.strength - a.strength || b.lengthM - a.lengthM)
    .slice(0, TOP_N)

  const existing = await prisma.segment.findMany()
  const kept = new Set<string>()

  for (const c of ranked) {
    const match = existing.find(
      s => !kept.has(s.id) && sameSegment(c.geometry, s.geometry as unknown as LatLng[]),
    )
    const data = {
      geometry: c.geometry as unknown as Prisma.InputJsonValue,
      lengthM: c.lengthM,
      elevation: ((elevationProfile(c.geometry, c.efforts, runs) ?? (await demElevation(c.geometry))) ??
        undefined) as Prisma.InputJsonValue | undefined,
      strength: c.strength,
    }
    const segment = match
      ? await prisma.segment.update({ where: { id: match.id }, data })
      : await prisma.segment.create({
          data: { ...data, name: `Segment · ${(c.lengthM / 1000).toFixed(1)} km` },
        })
    kept.add(segment.id)
    await prisma.$transaction([
      prisma.segmentEffort.deleteMany({ where: { segmentId: segment.id } }),
      prisma.segmentEffort.createMany({
        data: c.efforts.map(e => ({ ...e, segmentId: segment.id })),
      }),
    ])
  }

  // Pinned segments survive; just refresh their efforts.
  for (const s of existing.filter(s => !kept.has(s.id))) {
    if (!s.pinned) {
      await prisma.segment.delete({ where: { id: s.id } })
      continue
    }
    kept.add(s.id)
    const efforts = effortsFor(s.geometry as unknown as LatLng[], runs)
    await prisma.$transaction([
      prisma.segmentEffort.deleteMany({ where: { segmentId: s.id } }),
      prisma.segmentEffort.createMany({ data: efforts.map(e => ({ ...e, segmentId: s.id })) }),
      prisma.segment.update({
        where: { id: s.id },
        data: { strength: new Set(efforts.map(e => e.activityId)).size },
      }),
    ])
  }

  return { segments: kept.size }
}

/** Match newly added runs against the existing segments (called after sync/upload). */
export async function matchNewRuns(activityIds: string[]) {
  if (activityIds.length === 0) return
  const [segments, runs] = await Promise.all([prisma.segment.findMany(), loadRuns(activityIds)])
  for (const s of segments) {
    const efforts = effortsFor(s.geometry as unknown as LatLng[], runs)
    await prisma.segmentEffort.createMany({
      data: efforts.map(e => ({ ...e, segmentId: s.id })),
      skipDuplicates: true,
    })
    const distinct = await prisma.segmentEffort.findMany({
      where: { segmentId: s.id },
      distinct: ['activityId'],
      select: { activityId: true },
    })
    await prisma.segment.update({ where: { id: s.id }, data: { strength: distinct.length } })
  }
}
