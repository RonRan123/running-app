import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import NavBar from '@/components/NavBar'
import BottomNav from '@/components/BottomNav'

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/login')

  return (
    <div className="min-h-screen bg-zinc-50">
      <NavBar />
      {/* Extra bottom padding on mobile so content clears the bottom nav bar */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6 md:py-8 pb-24 md:pb-8">
        {children}
      </main>
      <BottomNav />
    </div>
  )
}
