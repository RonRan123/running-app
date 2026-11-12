'use client'

import { format, parseISO } from 'date-fns'
import { TAGS, type CheckIn, type Level, type TagKey } from '@/lib/checkIn'

// Level 0 is always "fine"; higher levels get warmer colours.
const ON = [
  'bg-zinc-900 text-white border-zinc-900',
  'bg-amber-500 text-white border-amber-500',
  'bg-rose-600 text-white border-rose-600',
]

/**
 * "How do you feel?" beside the plan. Each tag stays as set until changed;
 * the plan is recalculated from them straight away.
 */
export default function CheckInTags({
  checkIn,
  onTag,
}: {
  checkIn: CheckIn
  onTag: (key: TagKey, level: Level) => void
}) {
  return (
    <div className="mt-3 rounded-lg border border-zinc-200 px-3 py-2.5">
      <p className="text-xs font-medium text-zinc-900">How do you feel?</p>
      <p className="text-xs text-zinc-500 mt-0.5">
        Set these when something changes. They stay until you change them back.
      </p>
      <div className="mt-2 space-y-1.5">
        {TAGS.map(tag => {
          const state = checkIn[tag.key]
          return (
            <div key={tag.key} className="flex items-center justify-between gap-3 flex-wrap">
              <span className="text-xs text-zinc-600" title={tag.hint}>
                {tag.label}
                {state.since && (
                  <span className="text-zinc-400"> · since {format(parseISO(state.since), 'MMM d')}</span>
                )}
              </span>
              <div className="inline-flex" role="group" aria-label={tag.label}>
                {tag.levels.map((label, level) => {
                  const selected = state.level === level
                  // The "Yes" of a two-level tag is as serious as a third level.
                  const tone = ON[level === tag.levels.length - 1 && level > 0 ? 2 : level]
                  return (
                    <button
                      key={label}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => onTag(tag.key, level as Level)}
                      className={`border px-2.5 py-1 text-xs -ml-px first:ml-0 first:rounded-l-md last:rounded-r-md transition-colors ${
                        selected ? tone : 'bg-white text-zinc-600 border-zinc-200 hover:bg-zinc-50'
                      }`}
                    >
                      {label}
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
