import { prisma } from '@/lib/prisma'
import { format } from 'date-fns'
import UploadButton from '@/components/UploadButton'

function formatDuration(seconds: number) {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${m}:${String(s).padStart(2, '0')}`
}

function formatPace(minPerKm: number) {
  const m = Math.floor(minPerKm)
  const s = Math.round((minPerKm - m) * 60)
  return `${m}:${String(s).padStart(2, '0')} /km`
}

export default async function RunsPage() {
  const activities = await prisma.activity.findMany({
    orderBy: { date: 'desc' },
    select: {
      id: true,
      name: true,
      date: true,
      distance: true,
      duration: true,
      avgPace: true,
      avgHeartRate: true,
      maxHeartRate: true,
      sport: true,
    },
  })

  const totalKm = activities.reduce((sum, a) => sum + a.distance, 0)
  const totalRuns = activities.length

  return (
    <div className="space-y-6">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900">All Runs</h1>
          {totalRuns > 0 && (
            <p className="text-sm text-zinc-500 mt-0.5">
              {totalRuns} {totalRuns === 1 ? 'run' : 'runs'} · {totalKm.toFixed(1)} km total
            </p>
          )}
        </div>
        <UploadButton />
      </div>

      {/* Table */}
      {activities.length === 0 ? (
        <div className="text-center py-24 text-zinc-400">
          <p className="text-lg font-medium">No runs yet</p>
          <p className="text-sm mt-1">Upload a GPX or FIT file to get started</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-zinc-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-100 text-left text-zinc-400 text-xs uppercase tracking-wide">
                <th className="px-5 py-3 font-medium">Date</th>
                <th className="px-5 py-3 font-medium">Name</th>
                <th className="px-5 py-3 font-medium text-right">Distance</th>
                <th className="px-5 py-3 font-medium text-right">Time</th>
                <th className="px-5 py-3 font-medium text-right">Pace</th>
                <th className="px-5 py-3 font-medium text-right">Avg HR</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-50">
              {activities.map(a => (
                <tr key={a.id} className="hover:bg-zinc-50 transition-colors">
                  <td className="px-5 py-3.5 text-zinc-500 whitespace-nowrap">
                    {format(new Date(a.date), 'MMM d, yyyy')}
                  </td>
                  <td className="px-5 py-3.5 text-zinc-900 font-medium">{a.name}</td>
                  <td className="px-5 py-3.5 text-zinc-900 text-right tabular-nums">
                    {a.distance.toFixed(2)} km
                  </td>
                  <td className="px-5 py-3.5 text-zinc-900 text-right tabular-nums">
                    {formatDuration(a.duration)}
                  </td>
                  <td className="px-5 py-3.5 text-zinc-500 text-right tabular-nums">
                    {a.avgPace ? formatPace(a.avgPace) : '—'}
                  </td>
                  <td className="px-5 py-3.5 text-zinc-500 text-right tabular-nums">
                    {a.avgHeartRate ? `${a.avgHeartRate} bpm` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
