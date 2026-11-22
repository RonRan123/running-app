import { KM_PER_MILE, formatPace, type Unit } from '@/lib/units'

// Race-plan text carries distances and paces as tokens — {km:12.34} and
// {pace:5.4} (min/km) — so it can be computed once on the server and shown
// in either unit. Client-safe (no server imports).

export function fmtDistance(km: number, unit: Unit, decimals = 1) {
  const v = unit === 'mi' ? km / KM_PER_MILE : km
  return `${v.toFixed(decimals).replace(/\.0$/, '')} ${unit}`
}

/** Distance rounded to the nearest half unit, for long runs. */
export function fmtHalf(km: number, unit: Unit) {
  const v = unit === 'mi' ? km / KM_PER_MILE : km
  return `${(Math.round(v * 2) / 2).toString()} ${unit}`
}

export function fillTokens(text: string, unit: Unit) {
  return text
    .replace(/\{km:([\d.]+)\}/g, (_, k) => fmtDistance(Number(k), unit))
    .replace(/\{pace:([\d.]+)\}/g, (_, p) => formatPace(Number(p), unit))
}

export function fmtClock(seconds: number) {
  const s = Math.round(seconds)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  return h
    ? `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
    : `${m}:${String(sec).padStart(2, '0')}`
}

/** "1:53–2:00" style range, dropping seconds. */
export function fmtRange(low: number, high: number) {
  const hm = (s: number) => {
    const h = Math.floor(s / 3600)
    const m = Math.round((s % 3600) / 60)
    return h ? `${h}:${String(m).padStart(2, '0')}` : `${m} min`
  }
  return `${hm(low)}–${hm(high)}`
}
