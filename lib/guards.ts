import { getServerSession, type Session } from 'next-auth'
import { authOptions } from '@/lib/auth'

// Every API route handler starts with one of these, so each route states who
// may call it. Anyone on the internet can open a demo session, so "signed
// in" is not the same as "trusted": requireSession means public-demo-safe
// (reads that go through lib/activities.ts), requireAdmin means the owner
// only. lib/guards.test.ts fails if a handler uses neither.
//
//   const { session, error } = await requireAdmin()
//   if (error) return error

type Guarded = { session: Session; error?: undefined } | { session?: undefined; error: Response }

/** Any signed-in visitor, including the public demo. */
export async function requireSession(): Promise<Guarded> {
  const session = await getServerSession(authOptions)
  if (!session) return { error: Response.json({ error: 'Unauthorized' }, { status: 401 }) }
  return { session }
}

/** The owner's account only; the public demo gets 403. */
export async function requireAdmin(): Promise<Guarded> {
  const result = await requireSession()
  if (result.error) return result
  const { session } = result
  if (session.isDemo || session.user?.email !== process.env.ADMIN_EMAIL) {
    return { error: Response.json({ error: 'Not available in the demo' }, { status: 403 }) }
  }
  return { session }
}
