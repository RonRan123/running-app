'use client'

import ChartCard from '@/components/analysis/ChartCard'
import { formatDuration } from '@/lib/units'
import type { Effort, HrZones } from '@/lib/analysis'

const ZONE_META: { key: Effort; label: string; color: string }[] = [
  { key: 'easy', label: 'Easy', color: '#22c55e' },
  { key: 'moderate', label: 'Moderate', color: '#f59e0b' },
  { key: 'hard', label: 'Hard', color: '#ef4444' },
]

function zoneDefinition(key: Effort, z: HrZones) {
  switch (key) {
    case 'easy':
      return `≤ ${z.easyMax} bpm${z.maf !== null ? ' (at or below your MAF target)' : ''} — conversational aerobic running`
    case 'moderate':
      return `${z.easyMax + 1}–${z.hardMin - 1} bpm — steady to tempo effort`
    case 'hard':
      return `≥ ${z.hardMin} bpm — threshold and above`
  }
}

export default function ZoneBar({
  zones,
  hrZones,
}: {
  zones: Record<Effort, number>
  hrZones: HrZones
}) {
  const total = zones.easy + zones.moderate + zones.hard
  if (total === 0) return null

  return (
    <ChartCard
      title="Time in Zones"
      subtitle={`How this run's heart rate time splits across effort bands, ${hrZones.basis === 'age' ? 'set from your age' : 'based on your highest recorded HR (set your age in Settings to use MAF zones)'} — easy runs should be overwhelmingly green.`}
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
              <span className="text-zinc-400"> — {zoneDefinition(z.key, hrZones)}</span>
            </div>
          </div>
        ))}
      </div>
    </ChartCard>
  )
}
