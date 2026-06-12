export type Unit = 'mi' | 'km'

export const KM_PER_MILE = 1.609344

export function formatDistance(km: number, unit: Unit, decimals = 2) {
  const value = unit === 'mi' ? km / KM_PER_MILE : km
  return `${value.toFixed(decimals)} ${unit}`
}

export function formatPace(minPerKm: number, unit: Unit) {
  const minPerUnit = unit === 'mi' ? minPerKm * KM_PER_MILE : minPerKm
  let m = Math.floor(minPerUnit)
  let s = Math.round((minPerUnit - m) * 60)
  if (s === 60) {
    m += 1
    s = 0
  }
  return `${m}:${String(s).padStart(2, '0')} /${unit}`
}

export function formatDuration(seconds: number) {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${m}:${String(s).padStart(2, '0')}`
}
