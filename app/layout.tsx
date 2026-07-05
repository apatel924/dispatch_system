import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({
  variable: '--font-inter',
  subsets: ['latin'],
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Quick-Run Express — Delivery Dispatch',
  description:
    'Internal dispatch platform for Quick-Run Express: orders, drivers, proof of delivery, and customer tracking.',
  icons: {
    icon: '/images/brand/logo.png',
  },
}

export const viewport: Viewport = {
  themeColor: '#ffffff',
  colorScheme: 'light',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={`${inter.variable} bg-background`} data-scroll-behavior="smooth">
      <body className="font-sans antialiased">{children}</body>
    </html>
  )
}
