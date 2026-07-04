import Link from 'next/link'
import HeatmapMap from '@/components/HeatmapMap'

export const metadata = {
  title: 'Heatmap — Running Dashboard',
}

export default function HeatmapPage() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900">Heatmap</h1>
          <p className="text-sm text-zinc-500 mt-0.5">Every GPS track, layered on one map</p>
        </div>
        <Link
          href="/runs"
          className="inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-900 transition-colors"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          All runs
        </Link>
      </div>

      <HeatmapMap />
    </div>
  )
}
