import type { Metadata } from 'next'
import { Barlow_Condensed, Inter, JetBrains_Mono } from 'next/font/google'
import { Navbar } from '@/components/site/navbar'
import { Footer } from '@/components/site/footer'
import '../marketing-theme.css'

const inter = Inter({
  variable: '--font-inter',
  subsets: ['latin'],
  display: 'swap',
})

const barlowCondensed = Barlow_Condensed({
  variable: '--font-barlow-condensed',
  subsets: ['latin'],
  weight: ['500', '600', '700', '800'],
  display: 'swap',
})

const jetbrainsMono = JetBrains_Mono({
  variable: '--font-jetbrains-mono',
  subsets: ['latin'],
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Quick-Run Express | Edmonton Delivery Services',
  description:
    'Quick-Run Express provides dependable same-day, scheduled, business, and regulated delivery services throughout Edmonton, Alberta.',
}

export default function MainWebsiteLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <div
      className={`marketing-theme ${inter.variable} ${barlowCondensed.variable} ${jetbrainsMono.variable}`}
    >
      <Navbar />
      <main className="min-h-screen">{children}</main>
      <Footer />
    </div>
  )
}
