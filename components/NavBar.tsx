'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import SignOutButton from '@/components/SignOutButton'

const navLinks = [
  { href: '/runs', label: 'Runs', exact: true },
  { href: '/runs/heatmap', label: 'Heatmap', exact: false },
  { href: '/analysis', label: 'Analysis', exact: false },
  { href: '/goals', label: 'Goals', exact: false },
  { href: '/how-to-use', label: 'How to Use', exact: false },
  { href: '/settings', label: 'Settings', exact: false },
]

function isActive(href: string, exact: boolean, pathname: string) {
  return exact ? pathname === href : pathname.startsWith(href)
}

export default function NavBar() {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()

  useEffect(() => {
    setOpen(false)
  }, [pathname])

  // Prevent body scroll when drawer is open
  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden'
    else document.body.style.overflow = ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  return (
    <>
      <header className="bg-white border-b border-zinc-200 sticky top-0 z-30">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-6">
            <Link href="/runs" className="flex items-center gap-2">
              <img src="/favicon.ico" alt="" className="w-7 h-7" />
              <span className="font-bold text-zinc-900 tracking-widest text-sm">RUNNA</span>
            </Link>

            {/* Desktop nav */}
            <nav className="hidden md:flex items-center gap-4 text-sm">
              {navLinks.map(link => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`transition-colors ${
                    isActive(link.href, link.exact, pathname)
                      ? 'text-zinc-900 font-medium'
                      : 'text-zinc-500 hover:text-zinc-900'
                  }`}
                >
                  {link.label}
                </Link>
              ))}
            </nav>
          </div>

          {/* Right side */}
          <div className="flex items-center gap-3">
            <div className="hidden md:block">
              <SignOutButton />
            </div>

            {/* Hamburger — mobile only */}
            <button
              className="md:hidden p-2 -mr-1 rounded-lg text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
              onClick={() => setOpen(true)}
              aria-label="Open navigation menu"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>
        </div>
      </header>

      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/40 md:hidden"
          onClick={() => setOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Slide-in drawer */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Navigation menu"
        className={`fixed top-0 right-0 bottom-0 z-50 w-72 bg-white shadow-2xl flex flex-col transition-transform duration-200 ease-in-out md:hidden ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Drawer header */}
        <div className="h-14 flex items-center justify-between px-5 border-b border-zinc-100 shrink-0">
          <span className="font-bold text-zinc-900 tracking-widest text-sm">RUNNA</span>
          <button
            className="p-2 -mr-1 rounded-lg text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
            onClick={() => setOpen(false)}
            aria-label="Close navigation menu"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Links */}
        <nav className="flex-1 overflow-y-auto py-2">
          {navLinks.map(link => (
            <Link
              key={link.href}
              href={link.href}
              className={`flex items-center px-6 text-base font-medium transition-colors min-h-[52px] ${
                isActive(link.href, link.exact, pathname)
                  ? 'text-zinc-900 bg-zinc-50 border-r-2 border-zinc-900'
                  : 'text-zinc-500 hover:text-zinc-900 hover:bg-zinc-50'
              }`}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        {/* Sign out */}
        <div className="p-6 border-t border-zinc-100 shrink-0">
          <SignOutButton />
        </div>
      </div>
    </>
  )
}
