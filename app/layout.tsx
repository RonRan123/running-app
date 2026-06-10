import type { Metadata } from 'next'
import { Geist } from 'next/font/google'
import './globals.css'
import Providers from '@/components/Providers'

const geist = Geist({ subsets: ['latin'], variable: '--font-geist-sans' })

export const metadata: Metadata = {
  title: 'Running Dashboard',
  description: 'Personal running log and coaching dashboard',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geist.variable} h-full antialiased`}>
      <body className="min-h-full font-sans">
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
