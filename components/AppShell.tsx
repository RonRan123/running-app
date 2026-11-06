import NavBar from '@/components/NavBar'
import BottomNav from '@/components/BottomNav'
import DemoBanner from '@/components/DemoBanner'

/** Signed-in chrome: demo banner, top nav, and the mobile bottom nav. */
export default function AppShell({ isDemo, children }: { isDemo: boolean; children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-zinc-50">
      {isDemo && <DemoBanner />}
      <NavBar />
      {/* Extra bottom padding on mobile so content clears the bottom nav bar */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 md:py-8 pb-24 md:pb-8">
        {children}
      </main>
      <BottomNav />
    </div>
  )
}
