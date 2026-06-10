import FitParser from 'fit-file-parser'
import type { ParsedActivity } from './gpx'

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
  }
}

function capitalizeFirst(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase()
}
