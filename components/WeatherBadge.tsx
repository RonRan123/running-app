'use client'

import { useUnit } from '@/lib/useUnit'

function formatTemp(celsius: number, imperial: boolean): string {
  const value = imperial ? celsius * 1.8 + 32 : celsius
  return `${Math.round(value)}°${imperial ? 'F' : 'C'}`
}

export default function WeatherBadge({
  tempC,
  dewPointC,
  apparentTempC,
}: {
  tempC: number
  dewPointC: number
  apparentTempC: number
}) {
  // Match the distance unit preference: miles → °F, kilometers → °C.
  const { unit } = useUnit()
  const imperial = unit === 'mi'

  const items = [
    { label: 'Temp', value: formatTemp(tempC, imperial) },
    { label: 'Feels like', value: formatTemp(apparentTempC, imperial) },
    { label: 'Dew point', value: formatTemp(dewPointC, imperial) },
  ]

  return (
    <div className="bg-white rounded-xl border border-zinc-200 px-4 py-3 flex items-center gap-5 flex-wrap">
      <span className="text-base" aria-hidden>
        🌤
      </span>
      {items.map(item => (
        <div key={item.label} className="flex items-baseline gap-1.5">
          <span className="text-xs text-zinc-400 uppercase tracking-wide font-medium">
            {item.label}
          </span>
          <span className="text-sm font-semibold text-zinc-900 tabular-nums">{item.value}</span>
        </div>
      ))}
    </div>
  )
}
