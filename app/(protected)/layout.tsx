import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import SignOutButton from '@/components/SignOutButton'

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/login')

  return (
    <div className="min-h-screen bg-zinc-50">
      <header className="bg-white border-b border-zinc-200">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <span className="font-semibold text-zinc-900 tracking-tight">Running Dashboard</span>
            <nav className="flex items-center gap-4 text-sm">
              <Link href="/runs" className="text-zinc-500 hover:text-zinc-900 transition-colors">
                Runs
              </Link>
              <Link href="/runs/heatmap" className="text-zinc-500 hover:text-zinc-900 transition-colors">
                Heatmap
              </Link>
            </nav>
          </div>
          <SignOutButton />
        </div>
      </header>
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8">{children}</main>
    </div>
  )
}
