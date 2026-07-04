const BASE = 'https://intervals.icu/api/v1'

export interface IntervalsActivity {
  id: string
  name: string
  start_date_local: string // ISO datetime, no offset — server-TZ-dependent to parse
  start_date: string // ISO datetime with Z — the true UTC instant
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
export interface ActivityStreams {
  time: number[]            // seconds from start
  heartrate: number[] | null
  velocity: number[] | null // m/s
  altitude: number[] | null // meters
  cadence: number[] | null
  distance: number[] | null // cumulative meters
}

const STREAM_TYPES = ['time', 'heartrate', 'velocity_smooth', 'altitude', 'cadence', 'distance'] as const

/**
 * Fetch raw per-sample streams for a single activity.
 * Returns null if the activity has no stream data (e.g. manual entries).
 * The streams endpoint returns an array of {type, data} objects.
 */
export async function fetchStreams(activityId: string): Promise<ActivityStreams | null> {
  const params = new URLSearchParams({ types: STREAM_TYPES.join(',') })
  const res = await fetch(`${BASE}/activity/${activityId}/streams.json?${params}`, {
    headers: { Authorization: authHeader() },
    cache: 'no-store',
  })

  if (!res.ok) return null

  const data: unknown = await res.json()
  if (!Array.isArray(data)) return null

  const byType = new Map<string, number[]>()
  for (const s of data) {
    if (
      typeof s === 'object' && s !== null &&
      typeof (s as { type?: unknown }).type === 'string' &&
      Array.isArray((s as { data?: unknown }).data)
    ) {
      byType.set((s as { type: string }).type, (s as { data: number[] }).data)
    }
  }

  const time = byType.get('time')
  if (!time || time.length === 0) return null

  return {
    time,
    heartrate: byType.get('heartrate') ?? null,
    velocity: byType.get('velocity_smooth') ?? null,
    altitude: byType.get('altitude') ?? null,
    cadence: byType.get('cadence') ?? null,
    distance: byType.get('distance') ?? null,
  }
}

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
