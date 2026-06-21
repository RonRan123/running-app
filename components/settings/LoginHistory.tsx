'use client'

import { useState } from 'react'
import { format } from 'date-fns'

interface LoginEvent {
  id: string
  timestamp: string
  ipAddress: string | null
  userAgent: string | null
  country: string | null
  city: string | null
}

interface Response {
  events: LoginEvent[]
  total: number
  page: number
  pages: number
}

function parseDevice(ua: string | null): string {
  if (!ua) return 'Unknown'
  const lower = ua.toLowerCase()

  let browser = 'Unknown browser'
  if (lower.includes('edg/')) browser = 'Edge'
  else if (lower.includes('chrome/') && !lower.includes('chromium')) browser = 'Chrome'
  else if (lower.includes('firefox/')) browser = 'Firefox'
  else if (lower.includes('safari/') && !lower.includes('chrome')) browser = 'Safari'
  else if (lower.includes('opera/') || lower.includes('opr/')) browser = 'Opera'

  let os = 'Unknown OS'
  if (lower.includes('windows')) os = 'Windows'
  else if (lower.includes('iphone') || lower.includes('ipad')) os = 'iOS'
  else if (lower.includes('android')) os = 'Android'
  else if (lower.includes('mac os')) os = 'macOS'
  else if (lower.includes('linux')) os = 'Linux'

  return `${browser} on ${os}`
}

function formatLocation(event: LoginEvent): string {
  if (event.city && event.country) return `${event.city}, ${event.country}`
  if (event.country) return event.country
  return '—'
}

export default function LoginHistory() {
  const [visible, setVisible] = useState(false)
  const [data, setData] = useState<Response | null>(null)
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)

  async function fetchPage(p: number) {
    setLoading(true)
    try {
      const res = await fetch(`/api/login-events?page=${p}`)
      const json = await res.json()
      setData(json)
      setPage(p)
    } finally {
      setLoading(false)
    }
  }

  function toggle() {
    if (!visible) {
      if (!data) fetchPage(1)
      setVisible(true)
    } else {
      setVisible(false)
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-medium text-zinc-900">Login History</h3>
          <p className="text-xs text-zinc-500 mt-0.5">Recent sign-ins to your account</p>
        </div>
        <button
          onClick={toggle}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-zinc-700 bg-zinc-100 hover:bg-zinc-200 rounded-lg px-3 py-2 min-h-[44px] transition-colors"
        >
          {visible ? (
            <>
              <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
              </svg>
              Hide
            </>
          ) : (
            <>
              <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
              Show Login History
            </>
          )}
        </button>
      </div>

      {visible && (
        <div className="mt-4">
          {loading && !data ? (
            <div className="py-8 text-center text-sm text-zinc-400">Loading…</div>
          ) : !data || data.events.length === 0 ? (
            <div className="py-8 text-center text-sm text-zinc-400">No login events recorded yet</div>
          ) : (
            <>
              <div className="overflow-x-auto rounded-xl border border-zinc-200 shadow-[2px_0_0_-1px_rgba(0,0,0,0.05)_inset]">
                <table className="w-full text-sm min-w-[540px]">
                  <thead>
                    <tr className="border-b border-zinc-100 text-left text-zinc-400 text-xs uppercase tracking-wide">
                      <th className="px-4 py-3 font-medium">Date & Time</th>
                      <th className="px-4 py-3 font-medium">Location</th>
                      <th className="px-4 py-3 font-medium">IP Address</th>
                      <th className="px-4 py-3 font-medium">Device</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-zinc-50">
                    {data.events.map(event => (
                      <tr key={event.id} className="hover:bg-zinc-50 transition-colors">
                        <td className="px-4 py-3 whitespace-nowrap text-zinc-900 tabular-nums">
                          {format(new Date(event.timestamp), 'MMM d, yyyy · h:mm a')}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-zinc-500">
                          {formatLocation(event)}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-zinc-500 font-mono text-xs">
                          {event.ipAddress ?? '—'}
                        </td>
                        <td className="px-4 py-3 text-zinc-500">
                          {parseDevice(event.userAgent)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {data.pages > 1 && (
                <div className="flex items-center justify-between mt-3">
                  <p className="text-xs text-zinc-400">
                    {data.total} total event{data.total !== 1 ? 's' : ''} · page {data.page} of {data.pages}
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => fetchPage(page - 1)}
                      disabled={page <= 1 || loading}
                      className="text-xs px-3 py-1.5 rounded-lg border border-zinc-200 text-zinc-600 hover:bg-zinc-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors min-h-[36px]"
                    >
                      Previous
                    </button>
                    <button
                      onClick={() => fetchPage(page + 1)}
                      disabled={page >= data.pages || loading}
                      className="text-xs px-3 py-1.5 rounded-lg border border-zinc-200 text-zinc-600 hover:bg-zinc-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors min-h-[36px]"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
