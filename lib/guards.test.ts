import { readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'

// Anyone can open a demo session, so every API handler must say who may call
// it by starting with requireAdmin() or requireSession() from lib/guards.ts.
// This test fails when a new handler forgets to.

const API_DIR = join(__dirname, '..', 'app', 'api')
// NextAuth's own sign-in/session endpoints must stay reachable when signed out.
const EXEMPT = new Set(['auth/[...nextauth]/route.ts'])

const HANDLER = /export\s+(?:async\s+)?function\s+(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\b/g
// Handlers exported any other way can't be checked, so they aren't allowed.
const OTHER_EXPORT = /export\s+(?:const|let|var)\s+(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\b|export\s*\{[^}]*\bas\s+(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\b/

/** HTTP handlers in a route file that don't start with a guard. */
export function unguardedHandlers(source: string): string[] {
  const starts = [...source.matchAll(HANDLER)]
  const bad = starts
    .filter((m, i) => {
      const body = source.slice(m.index, starts[i + 1]?.index ?? source.length)
      return !/\brequire(Admin|Session)\(\)/.test(body)
    })
    .map(m => m[1])
  if (OTHER_EXPORT.test(source)) bad.push('(handler exported without `export function`)')
  return bad
}

function routeFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap(e =>
    e.isDirectory() ? routeFiles(join(dir, e.name)) : e.name === 'route.ts' ? [join(dir, e.name)] : [],
  )
}

describe('API route guards', () => {
  const files = routeFiles(API_DIR)
    .map(f => relative(API_DIR, f))
    .filter(f => !EXEMPT.has(f))

  it('finds the API routes', () => {
    expect(files.length).toBeGreaterThan(5)
  })

  it.each(files)('%s guards every handler', file => {
    expect(unguardedHandlers(readFileSync(join(API_DIR, file), 'utf8'))).toEqual([])
  })
})

describe('unguardedHandlers', () => {
  it('flags a handler with no guard, even next to a guarded one', () => {
    const source = `
      export async function GET() { const { error } = await requireSession(); if (error) return error }
      export async function POST() { return Response.json({ ok: true }) }`
    expect(unguardedHandlers(source)).toEqual(['POST'])
  })

  it('flags handlers exported in a form it cannot check', () => {
    expect(unguardedHandlers('export const GET = () => Response.json(1)')).toHaveLength(1)
    expect(unguardedHandlers('export { handler as POST }')).toHaveLength(1)
  })

  it('accepts guarded handlers', () => {
    expect(
      unguardedHandlers('export async function DELETE() { const { error } = await requireAdmin() }'),
    ).toEqual([])
  })
})
