// Lists NYC runs to choose from for the public demo (DEMO_RUN_IDS in
// lib/activities.ts). Read-only.
//
//   node --env-file=.env.local scripts/demo-candidates.mjs [limit]
import { PrismaClient } from '@prisma/client'

// New York City bounding box, matched against each run's first GPS point.
const NYC = { minLat: 40.49, maxLat: 40.92, minLng: -74.27, maxLng: -73.68 }
const limit = Number(process.argv[2] ?? 30)

const prisma = new PrismaClient()
const rows = await prisma.$queryRaw`
  SELECT id, date, name, distance FROM "Activity"
  WHERE sport = 'Run' AND jsonb_typeof(coordinates) = 'array'
    AND (coordinates->0->>'lat')::float BETWEEN ${NYC.minLat} AND ${NYC.maxLat}
    AND (coordinates->0->>'lng')::float BETWEEN ${NYC.minLng} AND ${NYC.maxLng}
  ORDER BY date DESC
  LIMIT ${limit}`
for (const r of rows) {
  const date = r.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  console.log(`'${r.id}', // ${date} · ${(r.distance / 1.609344).toFixed(1)} mi · ${r.name}`)
}
await prisma.$disconnect()
