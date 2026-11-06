'use client'

import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [demoLoading, setDemoLoading] = useState(false)

  async function viewDemo() {
    setError('')
    setDemoLoading(true)
    const res = await signIn('demo', { redirect: false })
    if (res?.error) {
      setDemoLoading(false)
      setError('The demo is unavailable right now — please check back later')
    } else {
      router.push('/runs')
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const res = await signIn('credentials', {
      email,
      password,
      redirect: false,
    })

    setLoading(false)

    if (res?.error) {
      setError('Invalid email or password')
    } else {
      router.push('/runs')
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-zinc-50">
      <nav className="px-8 py-6">
        <Link href="/" className="flex items-center gap-3 w-fit">
          <img src="/favicon.ico" alt="" className="w-8 h-8" />
          <span className="text-zinc-900 text-2xl font-bold tracking-widest">RONR</span>
        </Link>
      </nav>

      <div className="flex-1 flex items-center justify-center">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-semibold text-zinc-900 tracking-tight">Welcome back</h1>
          <p className="mt-1 text-sm text-zinc-500">Sign in to your account</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm border border-zinc-200 p-8 space-y-5">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-zinc-700 mb-1.5">
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full rounded-lg border border-zinc-300 px-3 py-2.5 text-sm text-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:border-transparent"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-zinc-700 mb-1.5">
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full rounded-lg border border-zinc-300 px-3 py-2.5 text-sm text-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:border-transparent"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-zinc-900 text-white rounded-lg py-2.5 text-sm font-medium hover:bg-zinc-700 focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <div className="mt-6 text-center space-y-2">
          <p className="text-sm text-zinc-500">Just looking around?</p>
          <button
            type="button"
            onClick={viewDemo}
            disabled={demoLoading}
            className="w-full bg-white text-zinc-900 border border-zinc-300 rounded-lg py-2.5 text-sm font-medium hover:bg-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {demoLoading ? 'Opening demo…' : 'See the app without logging in'}
          </button>
          <Link href="/guide" className="inline-block pt-1 text-sm text-zinc-500 hover:text-zinc-900 underline underline-offset-2">
            New here? See how it works
          </Link>
        </div>
      </div>
      </div>
    </div>
  )
}
