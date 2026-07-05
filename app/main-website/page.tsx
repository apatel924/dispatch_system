import type { Metadata } from 'next'
import { Hero } from '@/components/home/hero'
import { TrackingBar } from '@/components/home/tracking-bar'
import { StatsBand } from '@/components/home/stats-band'
import { ServicesOverview } from '@/components/home/services-overview'
import { ProductShowcase } from '@/components/home/product-showcase'
import { WhySection } from '@/components/home/why-section'
import { CoverageStrip } from '@/components/home/coverage-strip'
import { Testimonials } from '@/components/home/testimonials'
import { FaqSection } from '@/components/home/faq-section'
import { CtaSection } from '@/components/site/cta-section'

export const metadata: Metadata = {
  title: 'Quick-Run Express | Same-Day & Regulated Delivery in Edmonton',
  description:
    'Quick-Run Express provides same-day, scheduled, business, multi-stop, and regulated delivery across Edmonton — with live tracking, customer updates, and verified proof of delivery.',
}

export default function HomePage() {
  return (
    <>
      <Hero />
      <TrackingBar />
      <StatsBand />
      <ServicesOverview />
      <ProductShowcase />
      <WhySection />
      <CoverageStrip />
      <Testimonials />
      <FaqSection />
      <CtaSection />
    </>
  )
}
