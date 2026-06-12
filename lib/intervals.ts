const BASE = 'https://intervals.icu/api/v1'

export interface IntervalsActivity {
  id: string
  name: string
  start_date_local: string // ISO datetime
  type: string
  distance: number        // meters
  elapsed_time: number    // seconds
  moving_time: number     // seconds
  average_speed: number   // m/s (may be 0)
  average_heartrate: number | null
  max_heartrate: number | null
}

function authHeader() {
  const key = process.env.INTERVALS_API_KEY ?? ''
  return 'Basic ' + Buffer.from(`API_KEY:${key}`).toString('base64')
}

export async function fetchActivities(
  athleteId: string,
  oldest: Date,
  newest: Date = new Date(),
): Promise<IntervalsActivity[]> {
  const params = new URLSearchParams({
    oldest: oldest.toISOString().split('T')[0],
    newest: newest.toISOString().split('T')[0],
  })

  const res = await fetch(`${BASE}/athlete/${athleteId}/activities?${params}`, {
    headers: { Authorization: authHeader() },
    // don't cache — always fetch fresh data
    cache: 'no-store',
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Intervals.icu API error ${res.status}: ${text}`)
  }

  return res.json()
}

export interface LatLng {
  lat: number
  lng: number
}

/**
 * Fetch the GPS track for a single activity.
 * Returns an array of {lat, lng} points, or null if the activity has no GPS data.
 * `activityId` is the raw Intervals.icu id (e.g. "i12345678"), without our "intervals:" prefix.
 *
 * Note: we use the `/map` endpoint rather than `streams.json?types=latlng` —
 * the streams endpoint returns only latitudes (flat number array), while `/map`
 * returns proper `latlngs: [[lat, lng], ...]` pairs.
 */
export async function fetchGpsStream(activityId: string): Promise<LatLng[] | null> {
  const res = await fetch(`${BASE}/activity/${activityId}/map`, {
    headers: { Authorization: authHeader() },
    cache: 'no-store',
  })

  // 404 / 422 etc. simply means no map data — treat as "no GPS"
  if (!res.ok) return null

  const data: unknown = await res.json()
  const latlngs =
    typeof data === 'object' && data !== null
      ? (data as { latlngs?: unknown }).latlngs
      : undefined

  if (!Array.isArray(latlngs) || latlngs.length === 0) return null

  const points: LatLng[] = []
  for (const p of latlngs) {
    if (Array.isArray(p) && typeof p[0] === 'number' && typeof p[1] === 'number') {
      points.push({ lat: p[0], lng: p[1] })
    }
  }

  return points.length > 0 ? points : null
}
