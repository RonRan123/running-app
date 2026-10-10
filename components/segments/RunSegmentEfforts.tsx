'use client'

import Link from 'next/link'
import { useUnit } from '@/lib/useUnit'
import { formatDistance, formatDuration, formatPace } from '@/lib/units'

export interface RunEffort {
  id: string
  segmentId: string
  segmentName: string
  lengthM: number
  elapsedSec: number
  rank: number // 1 = fastest of all efforts on that segment
  of: number
}

export default function RunSegmentEfforts({ efforts }: { efforts: RunEffort[] }) {
  const { unit } = useUnit()
  if (efforts.length === 0) return null
  return (
    <div className="bg-white rounded-2xl border border-zinc-200 p-6">
      <p className="text-sm font-medium text-zinc-500 mb-3">Segments on this run</p>
      <ul className="divide-y divide-zinc-100">
        {efforts.map(e => (
          <li key={e.id} className="py-2 flex items-center justify-between gap-3 flex-wrap text-sm">
            <Link href={`/segments/${e.segmentId}`} className="font-medium text-zinc-900 hover:underline">
              {e.segmentName}
            </Link>
            <span className="text-zinc-500 tabular-nums">
              {formatDistance(e.lengthM / 1000, unit)} · {formatDuration(Math.round(e.elapsedSec))} ·{' '}
              {formatPace(e.elapsedSec / 60 / (e.lengthM / 1000), unit)} ·{' '}
              <span className={e.rank === 1 ? 'text-amber-600 font-medium' : ''}>
                {e.rank === 1 ? '🏆 ' : ''}#{e.rank} of {e.of}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
