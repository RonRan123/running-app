'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function SyncButton() {
  const router = useRouter()
  const [syncing, setSyncing] = useState(false)
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null)

  async function handleSync() {
    setSyncing(true)
    setMessage(null)

    try {
      const res = await fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ oldest: '2010-01-01' }),
      })
      const data = await res.json()

      if (!res.ok) {
        setMessage({ text: data.error ?? 'Sync failed', ok: false })
      } else {
        const text =
          data.synced === 0
            ? 'Already up to date'
            : `${data.synced} new ${data.synced === 1 ? 'run' : 'runs'} synced`
        setMessage({ text, ok: true })
        if (data.synced > 0) router.refresh()
      }
    } catch {
      setMessage({ text: 'Sync failed — check connection', ok: false })
    } finally {
      setSyncing(false)
    }
  }

  return (
    <div className="flex items-center gap-3">
      {message && (
        <span className={`text-sm ${message.ok ? 'text-emerald-600' : 'text-red-600'}`}>
          {message.text}
        </span>
      )}
      <button
        onClick={handleSync}
        disabled={syncing}
        className="inline-flex items-center gap-2 bg-white border border-zinc-300 text-zinc-700 rounded-lg px-4 py-2 text-sm font-medium hover:bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {syncing ? (
          <>
            <span className="h-4 w-4 rounded-full border-2 border-zinc-300 border-t-zinc-700 animate-spin" />
            Syncing…
          </>
        ) : (
          <>
            <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Sync Intervals.icu
          </>
        )}
      </button>
    </div>
  )
}
