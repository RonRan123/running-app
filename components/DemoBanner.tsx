'use client'

import { signOut } from 'next-auth/react'

export default function DemoBanner() {
  return (
    <div className="bg-zinc-900 text-white text-sm">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-2 flex items-center justify-between gap-3">
        <p className="text-zinc-200">
          <span className="font-medium text-white">Demo mode</span>
          <span className="hidden sm:inline"> · You&apos;re exploring a read-only sample of 10 runs in New York City. Runs outside NYC are hidden for client confidentiality.</span>
        </p>
        <button
          onClick={() => signOut({ callbackUrl: '/' })}
          className="shrink-0 text-zinc-300 hover:text-white underline underline-offset-2 transition-colors"
        >
          Exit demo
        </button>
      </div>
    </div>
  )
}
