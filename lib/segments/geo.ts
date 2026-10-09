// Planar geometry helpers for segment discovery. Tracks are projected onto a
// local equirectangular plane (meters) — accurate to well under 1 % over the
// few-tens-of-km span of one runner's routes.

export interface LatLng {
  lat: number
  lng: number
}

export interface XY {
  x: number
  y: number
}

const EARTH_RADIUS_M = 6_371_000
const RAD = Math.PI / 180

export interface Projection {
  toXY(p: LatLng): XY
  toLatLng(p: XY): LatLng
}

export function projectionAround(origin: LatLng): Projection {
  const cosLat = Math.cos(origin.lat * RAD)
  return {
    toXY: p => ({
      x: (p.lng - origin.lng) * RAD * EARTH_RADIUS_M * cosLat,
      y: (p.lat - origin.lat) * RAD * EARTH_RADIUS_M,
    }),
    toLatLng: p => ({
      lat: origin.lat + p.y / EARTH_RADIUS_M / RAD,
      lng: origin.lng + p.x / (EARTH_RADIUS_M * cosLat) / RAD,
    }),
  }
}

export function dist(a: XY, b: XY) {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

/** Points every `step` meters along the polyline (first point always kept). */
export function resample(points: XY[], step: number): XY[] {
  if (points.length === 0) return []
  const out: XY[] = [points[0]]
  let carry = 0 // distance walked since the last emitted point
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]
    const b = points[i]
    const len = dist(a, b)
    if (len === 0) continue
    let t = step - carry
    while (t <= len) {
      out.push({ x: a.x + ((b.x - a.x) * t) / len, y: a.y + ((b.y - a.y) * t) / len })
      t += step
    }
    carry = (carry + len) % step
  }
  return out
}

export function pathLength(points: XY[]) {
  let total = 0
  for (let i = 1; i < points.length; i++) total += dist(points[i - 1], points[i])
  return total
}
