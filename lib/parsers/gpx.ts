import { XMLParser } from 'fast-xml-parser'

export interface ParsedStreams {
  time: number[]            // seconds from start
  heartrate: number[] | null
  velocity: number[] | null // m/s
  altitude: number[] | null // meters
  cadence: number[] | null
  distance: number[] | null // cumulative meters
}

export interface ParsedActivity {
  name: string
  date: Date
  distance: number   // km
  duration: number   // seconds
  avgPace: number | null   // min/km
  avgHeartRate: number | null
  maxHeartRate: number | null
  sport: string
  coordinates: { lat: number; lng: number; ele?: number }[]
  streams: ParsedStreams | null
}

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export function parseGpx(buffer: ArrayBuffer): ParsedActivity {
  const text = new TextDecoder().decode(buffer)
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    parseAttributeValue: true,
  })
  const doc = parser.parse(text)

  const gpx = doc.gpx
  const trk = gpx?.trk
  const name: string = trk?.name ?? 'Run'
  const sport: string = trk?.type ?? 'Run'

  const trkseg = trk?.trkseg
  const segs = Array.isArray(trkseg) ? trkseg : [trkseg]

  const rawPoints: { lat: number; lon: number; ele?: number; time?: string; hr?: number; cad?: number }[] = []

  for (const seg of segs) {
    if (!seg?.trkpt) continue
    const pts = Array.isArray(seg.trkpt) ? seg.trkpt : [seg.trkpt]
    for (const pt of pts) {
      const lat = Number(pt['@_lat'])
      const lon = Number(pt['@_lon'])
      if (isNaN(lat) || isNaN(lon)) continue

      const ele = pt.ele != null ? Number(pt.ele) : undefined
      const time = pt.time ? String(pt.time) : undefined

      // HR and cadence can live in several extension namespaces
      let hr: number | undefined
      let cad: number | undefined
      const ext = pt.extensions
      if (ext) {
        const tpx =
          ext['gpxtpx:TrackPointExtension'] ??
          ext['ns3:TrackPointExtension'] ??
          ext.TrackPointExtension
        if (tpx) {
          const hrVal =
            tpx['gpxtpx:hr'] ?? tpx['ns3:hr'] ?? tpx.hr
          if (hrVal != null) hr = Number(hrVal)
          const cadVal =
            tpx['gpxtpx:cad'] ?? tpx['ns3:cad'] ?? tpx.cad
          if (cadVal != null) cad = Number(cadVal)
        }
        // Some devices put hr directly under extensions
        if (hr == null && (ext.hr != null)) hr = Number(ext.hr)
      }

      rawPoints.push({ lat, lon, ele, time, hr, cad })
    }
  }

  if (rawPoints.length === 0) {
    throw new Error('No track points found in GPX file')
  }

  // Distance
  let distance = 0
  for (let i = 1; i < rawPoints.length; i++) {
    distance += haversineKm(
      rawPoints[i - 1].lat, rawPoints[i - 1].lon,
      rawPoints[i].lat, rawPoints[i].lon,
    )
  }

  // Duration from timestamps
  let duration = 0
  const firstTime = rawPoints.find(p => p.time)?.time
  const lastTime = [...rawPoints].reverse().find(p => p.time)?.time
  if (firstTime && lastTime) {
    duration = Math.round((new Date(lastTime).getTime() - new Date(firstTime).getTime()) / 1000)
  }

  // Heart rate
  const hrValues = rawPoints.map(p => p.hr).filter((h): h is number => h != null && !isNaN(h))
  const avgHeartRate = hrValues.length ? Math.round(hrValues.reduce((a, b) => a + b, 0) / hrValues.length) : null
  const maxHeartRate = hrValues.length ? Math.max(...hrValues) : null

  const avgPace = distance > 0 && duration > 0 ? duration / 60 / distance : null

  const date = firstTime ? new Date(firstTime) : new Date()

  const coordinates = rawPoints
    .filter(p => p.lat != null && p.lon != null)
    .map(p => ({ lat: p.lat, lng: p.lon, ...(p.ele != null ? { ele: p.ele } : {}) }))

  return {
    name: name.trim() || 'Run',
    date,
    distance: Math.round(distance * 1000) / 1000,
    duration,
    avgPace: avgPace ? Math.round(avgPace * 100) / 100 : null,
    avgHeartRate,
    maxHeartRate,
    sport: capitalizeFirst(sport),
    coordinates,
    streams: buildStreams(rawPoints),
  }
}

/** Build per-sample streams from timestamped track points. Returns null without timestamps. */
function buildStreams(
  rawPoints: { lat: number; lon: number; ele?: number; time?: string; hr?: number; cad?: number }[],
): ParsedStreams | null {
  const timed = rawPoints.filter(p => p.time)
  if (timed.length < 2) return null

  const t0 = new Date(timed[0].time!).getTime()
  const time: number[] = []
  const distance: number[] = []
  const velocity: number[] = []
  const altitude: number[] = []
  const heartrate: number[] = []
  const cadence: number[] = []

  let cumMeters = 0
  let lastHr = timed.find(p => p.hr != null)?.hr ?? 0
  let lastCad = timed.find(p => p.cad != null)?.cad ?? 0
  let lastEle = timed.find(p => p.ele != null)?.ele ?? 0

  for (let i = 0; i < timed.length; i++) {
    const p = timed[i]
    const t = Math.round((new Date(p.time!).getTime() - t0) / 1000)

    if (i > 0) {
      const prev = timed[i - 1]
      const segMeters = haversineKm(prev.lat, prev.lon, p.lat, p.lon) * 1000
      cumMeters += segMeters
      const dt = t - time[time.length - 1]
      velocity.push(dt > 0 ? segMeters / dt : 0)
    } else {
      velocity.push(0)
    }

    if (p.hr != null) lastHr = p.hr
    if (p.cad != null) lastCad = p.cad
    if (p.ele != null) lastEle = p.ele

    time.push(t)
    distance.push(Math.round(cumMeters * 10) / 10)
    altitude.push(lastEle)
    heartrate.push(lastHr)
    cadence.push(lastCad)
  }

  const hasHr = timed.some(p => p.hr != null)
  const hasCad = timed.some(p => p.cad != null)
  const hasEle = timed.some(p => p.ele != null)

  return {
    time,
    heartrate: hasHr ? heartrate : null,
    velocity,
    altitude: hasEle ? altitude : null,
    cadence: hasCad ? cadence : null,
    distance,
  }
}

function capitalizeFirst(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase()
}
