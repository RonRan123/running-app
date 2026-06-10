import { XMLParser } from 'fast-xml-parser'

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

  const rawPoints: { lat: number; lon: number; ele?: number; time?: string; hr?: number }[] = []

  for (const seg of segs) {
    if (!seg?.trkpt) continue
    const pts = Array.isArray(seg.trkpt) ? seg.trkpt : [seg.trkpt]
    for (const pt of pts) {
      const lat = Number(pt['@_lat'])
      const lon = Number(pt['@_lon'])
      if (isNaN(lat) || isNaN(lon)) continue

      const ele = pt.ele != null ? Number(pt.ele) : undefined
      const time = pt.time ? String(pt.time) : undefined

      // HR can live in several extension namespaces
      let hr: number | undefined
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
        }
        // Some devices put hr directly under extensions
        if (hr == null && (ext.hr != null)) hr = Number(ext.hr)
      }

      rawPoints.push({ lat, lon, ele, time, hr })
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
  }
}

function capitalizeFirst(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase()
}
