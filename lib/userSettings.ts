import type { UserSettings } from '@prisma/client'
import { DEFAULT_TIME_ZONE, type WeeklyGoal } from '@/lib/activitySummary'

/** The saved weekly goal, or null when none is set (or the row is malformed). */
export function weeklyGoalFrom(settings: UserSettings | null): WeeklyGoal | null {
  const type = settings?.weeklyGoalType
  const target = settings?.weeklyGoalTarget
  if ((type !== 'runs' && type !== 'distance') || target == null || target <= 0) return null
  return { type, target }
}

export function timeZoneFrom(settings: UserSettings | null): string {
  return settings?.timeZone ?? DEFAULT_TIME_ZONE
}
