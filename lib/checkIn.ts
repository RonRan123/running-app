// The check-in tags beside the 7-day plan: how the runner feels right now.
// A tag stays as set until the runner changes it (no expiry), and `since`
// records the day it was set, so the rest days it asks for stay on fixed
// dates. lib/trainingPlan.ts turns the tags into plan changes.
//
// This is personal data: it is stored on UserSettings.checkIn and never sent
// to a demo session.

export type Level = 0 | 1 | 2

export interface TagState {
  level: Level
  since: string | null // yyyy-MM-dd in the user's time zone; null while level is 0
}

export const TAGS = [
  {
    key: 'pain',
    label: 'Pain',
    hint: 'Foot, shin, knee, hip or tendon pain, as opposed to tired muscles',
    levels: ['None', 'Mild', 'Strong'],
  },
  {
    key: 'soreness',
    label: 'Leg soreness / tightness',
    hint: 'Heavy, sore or tight muscles',
    levels: ['Low', 'Medium', 'High'],
  },
  {
    key: 'sleep',
    label: 'Sleep',
    hint: 'How you have slept the last few nights',
    levels: ['Good', 'So-so', 'Poor'],
  },
  {
    key: 'tiredness',
    label: 'Tiredness / stress',
    hint: 'Overall energy, including life stress',
    levels: ['Low', 'Medium', 'High'],
  },
  {
    key: 'sick',
    label: 'Sick',
    hint: 'Fever, chest cold, stomach bug',
    levels: ['No', 'Yes'],
  },
] as const

export type TagKey = (typeof TAGS)[number]['key']
export type CheckIn = Record<TagKey, TagState>

const FINE: TagState = { level: 0, since: null }

export function defaultCheckIn(): CheckIn {
  return { pain: FINE, soreness: FINE, sleep: FINE, tiredness: FINE, sick: FINE }
}

const maxLevel = (key: TagKey) => TAGS.find(t => t.key === key)!.levels.length - 1

/** A valid level for `key`, or null. */
export function parseLevel(key: TagKey, value: unknown): Level | null {
  return Number.isInteger(value) && (value as number) >= 0 && (value as number) <= maxLevel(key)
    ? (value as Level)
    : null
}

/** The stored check-in, with anything missing or malformed read as fine. */
export function checkInFrom(stored: unknown): CheckIn {
  const out = defaultCheckIn()
  if (!stored || typeof stored !== 'object') return out
  for (const { key } of TAGS) {
    const tag = (stored as Record<string, unknown>)[key] as Partial<TagState> | undefined
    const level = parseLevel(key, tag?.level)
    const since = typeof tag?.since === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(tag.since) ? tag.since : null
    if (level && since) out[key] = { level, since }
  }
  return out
}

/** `checkIn` with one tag changed today; setting the same level keeps its date. */
export function withTag(checkIn: CheckIn, key: TagKey, level: Level, today: string): CheckIn {
  if (checkIn[key].level === level) return checkIn
  return { ...checkIn, [key]: level === 0 ? FINE : { level, since: today } }
}
