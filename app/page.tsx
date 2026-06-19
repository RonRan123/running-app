import Image from 'next/image'
import Link from 'next/link'

export default function Home() {
  return (
    <main className="relative h-screen overflow-hidden">
      <Image
        src="https://images.squarespace-cdn.com/content/v1/5a0c9f51d74cffe8305247af/1516331080458-5YEAHGRHER6L3JTNGAWX/js-centralpark-12-pumphouse.jpg"
        alt="Runner in Central Park"
        fill
        className="object-cover object-center"
        priority
      />

      <div className="absolute inset-0 bg-black/55" />

      <nav className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-8 py-6">
        <div className="flex items-center gap-3">
          <img src="/favicon.ico" alt="" className="w-8 h-8" />
          <span className="text-white text-2xl font-bold tracking-widest">RUNNA</span>
        </div>
        <Link
          href="/login"
          className="bg-white text-zinc-900 text-sm font-semibold px-6 py-2 rounded-full hover:bg-zinc-100 transition-colors"
        >
          Log In
        </Link>
      </nav>

      <div className="absolute inset-0 z-10 flex flex-col items-center justify-center text-center px-6">
        <h1 className="text-6xl font-extrabold text-white tracking-tight leading-tight mb-5">
          Track Every Mile.<br />Own Every Run.
        </h1>
        <p className="text-lg text-white/75 max-w-md mb-10 leading-relaxed">
          Your personal running command center. Sync workouts from Intervals.icu, analyze your training load, and visualize every route on an interactive map.
        </p>
        <Link
          href="/login"
          className="bg-orange-500 text-white text-base font-semibold px-9 py-3 rounded-full hover:bg-orange-600 transition-colors"
        >
          Get Started
        </Link>
      </div>
    </main>
  )
}
