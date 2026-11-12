import { describe, expect, it } from 'vitest'
import { TAGS, checkInFrom, defaultCheckIn, parseLevel, withTag } from '@/lib/checkIn'

describe('check-in storage', () => {
  it('reads nothing, junk and unknown levels as fine', () => {
    expect(checkInFrom(null)).toEqual(defaultCheckIn())
    expect(checkInFrom('high')).toEqual(defaultCheckIn())
    expect(checkInFrom({ pain: { level: 5, since: '2026-11-01' }, sick: { level: 2, since: '2026-11-01' } })).toEqual(
      defaultCheckIn(),
    )
    expect(checkInFrom({ pain: { level: 2 } }).pain.level).toBe(0) // no date → can't place its rest days
  })

  it('keeps valid tags with their date', () => {
    const stored = { soreness: { level: 1, since: '2026-11-09' }, sick: { level: 1, since: '2026-11-10' } }
    const checkIn = checkInFrom(stored)
    expect(checkIn.soreness).toEqual({ level: 1, since: '2026-11-09' })
    expect(checkIn.sick).toEqual({ level: 1, since: '2026-11-10' })
    expect(checkIn.pain).toEqual({ level: 0, since: null })
  })

  it('allows three levels, and two for the sick tag', () => {
    expect([0, 1, 2, 3, -1, 1.5, '1'].map(v => parseLevel('pain', v))).toEqual([0, 1, 2, null, null, null, null])
    expect([0, 1, 2].map(v => parseLevel('sick', v))).toEqual([0, 1, null])
    expect(TAGS.map(t => t.levels.length)).toEqual([3, 3, 3, 3, 2])
  })

  it('dates a tag when its level changes and clears the date when it goes back to fine', () => {
    const a = withTag(defaultCheckIn(), 'pain', 2, '2026-11-09')
    expect(a.pain).toEqual({ level: 2, since: '2026-11-09' })
    expect(withTag(a, 'pain', 2, '2026-11-11')).toBe(a) // same level: the date stays
    expect(withTag(a, 'pain', 1, '2026-11-11').pain).toEqual({ level: 1, since: '2026-11-11' })
    expect(withTag(a, 'pain', 0, '2026-11-11').pain).toEqual({ level: 0, since: null })
    expect(withTag(a, 'sleep', 1, '2026-11-11').pain).toEqual(a.pain) // other tags untouched
  })
})
