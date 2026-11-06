import { afterEach, describe, expect, it, vi } from 'vitest'
import type { JWT } from 'next-auth/jwt'
import type { User } from 'next-auth'
import { authOptions, DEMO_SESSION_MS } from '@/lib/auth'

const jwt = (token: JWT, user?: User) =>
  // Only the fields our callback reads; the rest of NextAuth's args are unused.
  authOptions.callbacks!.jwt!({ token, user } as Parameters<
    NonNullable<NonNullable<typeof authOptions.callbacks>['jwt']>
  >[0])

// NextAuth keeps a custom provider id in `options` until it initialises.
const demoProvider = authOptions.providers.find(
  p => (p as { options?: { id?: string } }).options?.id === 'demo',
) as unknown as { options: { authorize: () => Promise<User | null> } }

afterEach(() => {
  vi.unstubAllEnvs()
  vi.useRealTimers()
})

describe('demo sessions', () => {
  it('signs a visitor in when the demo is on, with a short expiry', async () => {
    const user = await demoProvider.options.authorize()
    expect(user?.isDemo).toBe(true)
    const token = await jwt({}, user!)
    expect(token.isDemo).toBe(true)
    expect(token.demoExpiresAt! - Date.now()).toBeGreaterThan(DEMO_SESSION_MS - 1000)
  })

  it('refuses new demo sign-ins when PUBLIC_DEMO_ENABLED=false', async () => {
    vi.stubEnv('PUBLIC_DEMO_ENABLED', 'false')
    expect(await demoProvider.options.authorize()).toBeNull()
  })

  it('ends an open demo session when the switch is turned off', async () => {
    const token = await jwt({}, { id: 'demo', isDemo: true })
    vi.stubEnv('PUBLIC_DEMO_ENABLED', 'false')
    await expect(jwt(token)).rejects.toThrow('Demo session ended')
  })

  it('ends a demo session after it expires', async () => {
    const token = await jwt({}, { id: 'demo', isDemo: true })
    vi.useFakeTimers()
    vi.setSystemTime(Date.now() + DEMO_SESSION_MS + 1000)
    await expect(jwt(token)).rejects.toThrow('Demo session ended')
  })

  it('ends demo sessions issued before expiry existed', async () => {
    await expect(jwt({ isDemo: true })).rejects.toThrow('Demo session ended')
  })

  it('never affects the admin session', async () => {
    vi.stubEnv('PUBLIC_DEMO_ENABLED', 'false')
    const token = await jwt({}, { id: '1', isDemo: false })
    vi.useFakeTimers()
    vi.setSystemTime(Date.now() + 30 * 24 * 60 * 60 * 1000)
    await expect(jwt(token)).resolves.toMatchObject({ isDemo: false })
  })
})
