/** Total climb along an elevation profile, ignoring sub-meter GPS/DEM jitter. */
export function elevationGain(elevation: unknown): number | null {
  if (!Array.isArray(elevation) || elevation.length < 2) return null
  let gain = 0
  let base = elevation[0] as number
  for (const e of elevation as number[]) {
    if (e - base >= 1) {
      gain += e - base
      base = e
    } else if (e < base) {
      base = e
    }
  }
  return Math.round(gain)
}
