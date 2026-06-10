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
