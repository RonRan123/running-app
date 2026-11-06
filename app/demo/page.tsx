'use client'

import { useEffect, useRef, useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

// Shareable link (e.g. from the blog post) that drops visitors straight into
// the read-only demo without going through the login page.
export default function DemoPage() {
  const router = useRouter()
  const [failed, setFailed] = useState(false)
  const started = useRef(false)

  useEffect(() => {
    // Strict mode runs effects twice in dev; sign in only once.
    if (started.current) return
    started.current = true
    signIn('demo', { redirect: false }).then(res => {
      if (res?.error) setFailed(true)
      else router.replace('/runs')
    })
  }, [router])

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50">
      {failed ? (
        <p className="text-sm text-zinc-500">
          The demo is unavailable right now. Please check back later.{' '}
          <Link href="/" className="text-zinc-900 underline">
            Back to home
          </Link>
        </p>
      ) : (
        <p className="text-sm text-zinc-500">Opening the demo…</p>
      )}
    </div>
  )
}
