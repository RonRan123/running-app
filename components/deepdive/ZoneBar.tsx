'use client'

import ChartCard from '@/components/analysis/ChartCard'
import { formatDuration } from '@/lib/units'
import { EASY_CEILING, MODERATE_CEILING, type Effort } from '@/lib/analysis'

const ZONE_META: { key: Effort; label: string; color: string }[] = [
  { key: 'easy', label: 'Easy', color: '#22c55e' },
  { key: 'moderate', label: 'Moderate', color: '#f59e0b' },
  { key: 'hard', label: 'Hard', color: '#ef4444' },
]

function zoneDefinition(key: Effort, maxHr: number) {
  const easyTop = Math.round(maxHr * EASY_CEILING)
  const moderateTop = Math.round(maxHr * MODERATE_CEILING)
  const easyPct = Math.round(EASY_CEILING * 100)
  const moderatePct = Math.round(MODERATE_CEILING * 100)
  switch (key) {
    case 'easy':
      return `≤ ${easyTop} bpm (up to ${easyPct}% of max HR) — conversational aerobic running`
    case 'moderate':
      return `${easyTop + 1}–${moderateTop} bpm (${easyPct}–${moderatePct}% of max HR) — steady to tempo effort`
    case 'hard':
      return `> ${moderateTop} bpm (over ${moderatePct}% of max HR) — threshold and above`
  }
}

export default function ZoneBar({
  zones,
  maxHr,
}: {
  zones: Record<Effort, number>
  maxHr: number
}) {
  const total = zones.easy + zones.moderate + zones.hard
  if (total === 0) return null

  return (
    <ChartCard
      title="Time in Zones"
      subtitle={`How this run's heart rate time splits across effort bands, based on your estimated max HR of ${maxHr} bpm — easy runs should be overwhelmingly green.`}
    >
      <div className="flex h-6 rounded-full overflow-hidden">
        {ZONE_META.filter(z => zones[z.key] > 0).map(z => (
          <div
            key={z.key}
            style={{ width: `${(zones[z.key] / total) * 100}%`, backgroundColor: z.color }}
          />
        ))}
      </div>
      <div className="space-y-2 mt-4">
        {ZONE_META.map(z => (
          <div key={z.key} className="flex items-start gap-2 text-xs">
            <span
              className="inline-block h-2.5 w-2.5 rounded-full mt-0.5 shrink-0"
              style={{ backgroundColor: z.color }}
            />
            <div>
              <span className="font-medium text-zinc-700">
                {z.label} · {formatDuration(Math.round(zones[z.key]))} (
                {Math.round((zones[z.key] / total) * 100)}%)
              </span>
              <span className="text-zinc-400"> — {zoneDefinition(z.key, maxHr)}</span>
            </div>
          </div>
        ))}
      </div>
    </ChartCard>
  )
}
