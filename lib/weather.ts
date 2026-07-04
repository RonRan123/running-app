import { prisma } from '@/lib/prisma'
import { differenceInDays } from 'date-fns'

// Weather-at-run-time via the Open-Meteo historical archive (no API key).
//
// Approach: fetch the hourly series for the run's calendar day(s) at the
// run's start coordinate, then average every hourly point whose local hour
// overlaps the run's start→end window. For runs shorter than an hour this
// degrades to the single hour nearest the midpoint, which is adequate;
// for long runs the mean is more representative than any single sample.
//
// weatherFetchedAt semantics: stamped on every *attempt* — success, no-GPS,
// or network failure — so backfill (WHERE weatherFetchedAt IS NULL) never
// re-queries a run it has already processed. The one exception: runs newer
// than the archive's publication delay (~5 days) that returned no data are
// left unstamped so a later sync retries once the archive catches up.

const ARCHIVE_DELAY_DAYS = 7
const HOURLY_VARS = 'temperature_2m,dew_point_2m,apparent_temperature'

interface LatLng {
  lat: number
  lng: number
}

export interface RunWeather {
  tempC: number
  dewPointC: number
  apparentTempC: number
}

function startCoordinate(coordinates: unknown): LatLng | null {
  if (!Array.isArray(coordinates)) return null
  const first = coordinates[0] as Partial<LatLng> | undefined
  if (typeof first?.lat === 'number' && typeof first?.lng === 'number') {
    return { lat: first.lat, lng: first.lng }
  }
  return null
}

function mean(values: number[]): number {
  return values.reduce((sum, v) => sum + v, 0) / values.length
}

/**
 * Fetch weather for a run window from Open-Meteo. Returns null if the
 * archive has no data for those hours (e.g. run too recent). Throws on
 * network/HTTP failure.
 */
export async function fetchRunWeather(
  coord: LatLng,
  start: Date,
  durationSeconds: number,
): Promise<RunWeather | null> {
  const end = new Date(start.getTime() + durationSeconds * 1000)
  const params = new URLSearchParams({
    latitude: coord.lat.toFixed(4),
    longitude: coord.lng.toFixed(4),
    // UTC calendar days, matching timezone=UTC below.
    start_date: start.toISOString().slice(0, 10),
    end_date: end.toISOString().slice(0, 10),
    hourly: HOURLY_VARS,
    // Activity dates are true UTC instants, so ask for epoch timestamps and
    // compare instants directly — no string parsing, no server-TZ dependence.
    timeformat: 'unixtime',
    timezone: 'UTC',
  })

  const res = await fetch(`https://archive-api.open-meteo.com/v1/archive?${params}`, {
    signal: AbortSignal.timeout(10_000),
  })
  if (!res.ok) throw new Error(`Open-Meteo responded ${res.status}`)

  const data = (await res.json()) as {
    hourly?: {
      time: number[] // epoch seconds
      temperature_2m: (number | null)[]
      dew_point_2m: (number | null)[]
      apparent_temperature: (number | null)[]
    }
  }
  const hourly = data.hourly
  if (!hourly?.time?.length) return null

  // Collect the hourly samples that bracket the run: from the top of the
  // start hour through the top of the hour after the end. A 14:30–15:30 run
  // averages the 14:00, 15:00, and 16:00 samples — no knife-edge cutoffs.
  const HOUR = 60 * 60 * 1000
  const windowFrom = Math.floor(start.getTime() / HOUR) * HOUR
  const windowTo = Math.ceil(end.getTime() / HOUR) * HOUR

  const temps: number[] = []
  const dews: number[] = []
  const feels: number[] = []
  for (let i = 0; i < hourly.time.length; i++) {
    const t = hourly.time[i] * 1000
    if (t < windowFrom || t > windowTo) continue
    const temp = hourly.temperature_2m[i]
    const dew = hourly.dew_point_2m[i]
    const feel = hourly.apparent_temperature[i]
    if (temp === null || dew === null || feel === null) continue
    temps.push(temp)
    dews.push(dew)
    feels.push(feel)
  }
  if (temps.length === 0) return null

  const round1 = (v: number) => Math.round(v * 10) / 10
  return {
    tempC: round1(mean(temps)),
    dewPointC: round1(mean(dews)),
    apparentTempC: round1(mean(feels)),
  }
}

/**
 * Fetch and store weather for every run that hasn't been attempted yet.
 * Safe to call fire-and-forget; never throws.
 */
export async function backfillWeather(): Promise<void> {
  try {
    const pending = await prisma.activity.findMany({
      where: { weatherFetchedAt: null },
      select: { id: true, date: true, duration: true, coordinates: true },
      orderBy: { date: 'desc' },
    })

    for (const run of pending) {
      const now = new Date()
      const coord = startCoordinate(run.coordinates)

      // No GPS = definitively unfetchable. Stamp so we never retry.
      if (!coord) {
        await prisma.activity.update({
          where: { id: run.id },
          data: { weatherFetchedAt: now },
        })
        continue
      }

      let weather: RunWeather | null = null
      try {
        weather = await fetchRunWeather(coord, run.date, run.duration)
      } catch (err) {
        console.error(`Weather fetch failed for activity ${run.id}:`, err)
        // Unreachable/HTTP error: stamp with null data so this run isn't
        // retried on every future sync.
        await prisma.activity.update({
          where: { id: run.id },
          data: { weatherFetchedAt: now },
        })
        continue
      }

      if (weather === null) {
        // Archive has no data yet. If the run is recent, leave unstamped so
        // the next sync retries after the archive catches up; if it's old,
        // the data will never appear — stamp and move on.
        const recent = differenceInDays(now, run.date) < ARCHIVE_DELAY_DAYS
        if (!recent) {
          await prisma.activity.update({
            where: { id: run.id },
            data: { weatherFetchedAt: now },
          })
        }
        continue
      }

      await prisma.activity.update({
        where: { id: run.id },
        data: {
          weatherTempC: weather.tempC,
          weatherDewPointC: weather.dewPointC,
          weatherApparentTempC: weather.apparentTempC,
          weatherFetchedAt: now,
        },
      })

      // Be a polite Open-Meteo citizen during large backfills.
      await new Promise(resolve => setTimeout(resolve, 150))
    }
  } catch (err) {
    console.error('Weather backfill failed:', err)
  }
}
