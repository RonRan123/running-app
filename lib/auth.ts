import type { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import { intervalsConfigured, runSync } from '@/lib/sync'
import { prisma } from '@/lib/prisma'

const AUTO_SYNC_WINDOW_DAYS = 30

// Private/loopback ranges that will never resolve to a real location.
const UNROUTABLE = /^(127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|::1$|fc|fd)/i

async function resolveGeoAndRecord(ip: string | null, userAgent: string | null) {
  let city: string | null = null
  let region: string | null = null
  let country: string | null = null

  if (ip && !UNROUTABLE.test(ip)) {
    try {
      const res = await fetch(`http://ip-api.com/json/${ip}?fields=status,country,regionName,city`, {
        signal: AbortSignal.timeout(3000),
      })
      if (res.ok) {
        const data = await res.json() as { status: string; country?: string; regionName?: string; city?: string }
        if (data.status === 'success') {
          city = data.city ?? null
          region = data.regionName ?? null
          country = data.country ?? null
        }
      }
    } catch {
      // geo lookup failed — record the event without location
    }
  }

  prisma.loginEvent.create({ data: { ipAddress: ip, userAgent, city, region, country } }).catch(err => {
    console.error('Failed to record login event:', err)
  })
}

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials, req) {
        if (!credentials?.email || !credentials?.password) return null
        if (credentials.email !== process.env.ADMIN_EMAIL) return null
        const hash = process.env.ADMIN_PASSWORD_HASH
        if (!hash) return null
        const valid = await bcrypt.compare(credentials.password, hash)
        if (!valid) return null

        // Fire-and-forget login event — never blocks auth
        const headers = req?.headers as Record<string, string | string[]> | undefined
        const rawIp = headers?.['x-forwarded-for'] ?? headers?.['x-real-ip'] ?? null
        const ip = Array.isArray(rawIp) ? rawIp[0] : (rawIp?.split(',')[0]?.trim() ?? null)
        const userAgent = (headers?.['user-agent'] as string | undefined) ?? null
        resolveGeoAndRecord(ip, userAgent)

        return { id: '1', email: credentials.email, name: 'Admin' }
      },
    }),
  ],
  session: { strategy: 'jwt' },
  pages: { signIn: '/login' },
  events: {
    // Fire-and-forget: pull recent runs from Intervals.icu on every login.
    // Deliberately not awaited so login is never blocked by a slow sync.
    async signIn() {
      if (!intervalsConfigured()) return
      const oldest = new Date(Date.now() - AUTO_SYNC_WINDOW_DAYS * 24 * 60 * 60 * 1000)
      runSync(oldest).catch(err => {
        console.error('Auto-sync on login failed:', err)
      })
    },
  },
}
