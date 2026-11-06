import 'next-auth'
import 'next-auth/jwt'

declare module 'next-auth' {
  interface Session {
    /** True when the signed-in user is the read-only demo account. */
    isDemo: boolean
  }

  interface User {
    isDemo?: boolean
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    isDemo?: boolean
    /** Epoch ms after which a demo session is no longer accepted. */
    demoExpiresAt?: number
  }
}
