import type { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import { intervalsConfigured, runSync } from '@/lib/sync'

const AUTO_SYNC_WINDOW_DAYS = 30

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null
        if (credentials.email !== process.env.ADMIN_EMAIL) return null
        const hash = process.env.ADMIN_PASSWORD_HASH
        if (!hash) return null
        const valid = await bcrypt.compare(credentials.password, hash)
        if (!valid) return null
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
