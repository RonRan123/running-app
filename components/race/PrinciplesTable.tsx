'use client'

import { useEffect, useState } from 'react'
import { EVIDENCE_HELP, EVIDENCE_LABEL, PRINCIPLE_LIST, type Evidence } from '@/lib/racePrinciples'
import EvidenceBadge from './EvidenceBadge'

const FILTERS: (Evidence | 'all')[] = ['all', 'research', 'debated', 'consensus', 'app']

/** Every race-plan rule, rendered from lib/racePrinciples.ts so it can't drift from the code. */
export default function PrinciplesTable() {
  const [filter, setFilter] = useState<Evidence | 'all'>('all')
  const [highlight, setHighlight] = useState<string | null>(null)

  // /guide#rule-LOAD_RATIO_MAX: show every rule and flash the linked one.
  useEffect(() => {
    function fromHash() {
      const id = decodeURIComponent(window.location.hash.slice(1))
      if (!id.startsWith('rule-')) return
      setFilter('all')
      setHighlight(id.slice(5))
      requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView({ block: 'center' }))
    }
    fromHash()
    window.addEventListener('hashchange', fromHash)
    return () => window.removeEventListener('hashchange', fromHash)
  }, [])

  const rows = PRINCIPLE_LIST.filter(p => filter === 'all' || p.evidence === filter)

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by evidence">
        {FILTERS.map(f => (
          <button
            key={f}
            type="button"
            aria-pressed={filter === f}
            onClick={() => setFilter(f)}
            className={`min-h-9 rounded-full border px-3.5 text-sm font-medium transition-colors ${
              filter === f ? 'bg-zinc-900 border-zinc-900 text-white' : 'bg-white border-zinc-300 text-zinc-700 hover:border-zinc-500'
            }`}
          >
            {f === 'all' ? 'All rules' : EVIDENCE_LABEL[f]}
          </button>
        ))}
      </div>

      <ul className="bg-white rounded-2xl border border-zinc-200 divide-y divide-zinc-100">
        {rows.map(p => (
          <li
            key={p.id}
            id={`rule-${p.id}`}
            className={`px-4 py-3.5 scroll-mt-24 space-y-1.5 ${highlight === p.id ? 'bg-amber-50' : ''}`}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-mono text-xs font-semibold text-zinc-700">{p.id}</span>
              <EvidenceBadge evidence={p.evidence} />
            </div>
            <p className="text-sm">
              <span className="font-semibold text-zinc-900">{p.title}.</span>{' '}
              <span className="text-zinc-700">{p.says}</span>
            </p>
            {p.note && <p className="text-xs text-zinc-500">{p.note}</p>}
            <dl className="flex flex-wrap gap-x-6 gap-y-1 text-xs">
              <div className="flex gap-1.5">
                <dt className="text-zinc-500">Value used</dt>
                <dd className="font-semibold text-zinc-900 tabular-nums">{p.value}</dd>
              </div>
              <div className="flex gap-1.5">
                <dt className="text-zinc-500">Source</dt>
                <dd className="text-zinc-700">{p.sources.join(' · ')}</dd>
              </div>
            </dl>
          </li>
        ))}
      </ul>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 text-sm">
        {(['research', 'debated', 'consensus', 'app'] as const).map(e => (
          <div key={e} className="bg-white rounded-xl border border-zinc-200 p-3.5 space-y-1.5">
            <EvidenceBadge evidence={e} />
            <p className="text-zinc-700">{EVIDENCE_HELP[e]}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
