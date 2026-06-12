import FitParser from 'fit-file-parser'
import type { ParsedActivity, ParsedStreams } from './gpx'

export async function parseFit(buffer: ArrayBuffer): Promise<ParsedActivity> {
  const parser = new FitParser({
    force: true,
    speedUnit: 'km/h',
    lengthUnit: 'km',
    elapsedRecordField: true,
    mode: 'list',
  })

  const data = await parser.parseAsync(buffer)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const records: any[] = (data as any).records ?? []
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sessions: any[] = (data as any).sessions ?? []

  const session = sessions[0] ?? {}

  const sport: string = session.sport ?? 'running'
  const date: Date = session.start_time instanceof Date ? session.start_time : new Date()

  // total_distance is in km when lengthUnit='km'
  const rawDistance: number = typeof session.total_distance === 'number' ? session.total_distance : 0
  const distance = Math.round(rawDistance * 1000) / 1000

  // total_elapsed_time is in seconds
  const duration: number = typeof session.total_elapsed_time === 'number'
    ? Math.round(session.total_elapsed_time)
    : 0

  const avgHeartRate: number | null = typeof session.avg_heart_rate === 'number' ? session.avg_heart_rate : null
  const maxHeartRate: number | null = typeof session.max_heart_rate === 'number' ? session.max_heart_rate : null

  const avgPace = distance > 0 && duration > 0 ? Math.round((duration / 60 / distance) * 100) / 100 : null

  const coordinates = records
    .filter(r => r.position_lat != null && r.position_long != null)
    .map(r => ({
      lat: r.position_lat as number,
      lng: r.position_long as number,
      ...(r.enhanced_altitude != null
        ? { ele: r.enhanced_altitude as number }
        : r.altitude != null
        ? { ele: r.altitude as number }
        : {}),
    }))

  const name = session.sport
    ? capitalizeFirst(String(session.sport))
    : 'Run'

  return {
    name,
    date,
    distance,
    duration,
    avgPace,
    avgHeartRate,
    maxHeartRate,
    sport: capitalizeFirst(sport),
    coordinates,
    streams: buildStreams(records),
  }
}

/**
 * Build per-sample streams from FIT record messages.
 * With lengthUnit='km' / speedUnit='km/h', the parser returns distance and
 * altitude in km and speed in km/h — convert back to meters and m/s here.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildStreams(records: any[]): ParsedStreams | null {
  const timed = records.filter(r => typeof r.elapsed_time === 'number')
  if (timed.length < 2) return null

  const time: number[] = []
  const heartrate: number[] = []
  const velocity: number[] = []
  const altitude: number[] = []
  const cadence: number[] = []
  const distance: number[] = []

  for (const r of timed) {
    time.push(Math.round(r.elapsed_time))
    heartrate.push(typeof r.heart_rate === 'number' ? r.heart_rate : 0)
    const speedKmh = typeof r.enhanced_speed === 'number' ? r.enhanced_speed : r.speed
    velocity.push(typeof speedKmh === 'number' ? speedKmh / 3.6 : 0)
    const altKm = typeof r.enhanced_altitude === 'number' ? r.enhanced_altitude : r.altitude
    altitude.push(typeof altKm === 'number' ? altKm * 1000 : 0)
    cadence.push(typeof r.cadence === 'number' ? r.cadence : 0)
    distance.push(typeof r.distance === 'number' ? Math.round(r.distance * 1000 * 10) / 10 : 0)
  }

  const has = (key: string) => timed.some(r => typeof r[key] === 'number')

  return {
    time,
    heartrate: has('heart_rate') ? heartrate : null,
    velocity: has('enhanced_speed') || has('speed') ? velocity : null,
    altitude: has('enhanced_altitude') || has('altitude') ? altitude : null,
    cadence: has('cadence') ? cadence : null,
    distance: has('distance') ? distance : null,
  }
}

function capitalizeFirst(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase()
}
