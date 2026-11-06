<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

# The demo is public

Anyone can open a read-only demo session (`/demo`), so treat "signed in" as "anyone on the internet" unless the session is the admin's.

- Every API route handler starts with `requireAdmin()` (owner only, the default) or `requireSession()` (safe for the demo) from `lib/guards.ts`. `lib/guards.test.ts` fails otherwise.
- Pages and routes read runs only through `lib/activities.ts`, never `prisma.activity` directly; it limits demo sessions to `DEMO_RUN_IDS`.
- Personal data (birthday, race goals, login history, settings) is never sent to a demo session.
<!-- END:nextjs-agent-rules -->
