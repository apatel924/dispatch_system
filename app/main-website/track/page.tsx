import type { Metadata } from 'next'
import { PageHero } from '@/components/site/page-hero'
import { CtaSection } from '@/components/site/cta-section'
import { TrackPageContent } from '@/components/site/track-page-content'
import { images } from '@/lib/images'

export const metadata: Metadata = {
  title: 'Track Delivery',
  description:
    'Track your Quick-Run Express delivery in Edmonton using the secure SMS tracking link sent when your driver is assigned.',
}

export default function TrackPage() {
  return (
    <>
      <PageHero
        eyebrow="Track Delivery"
        title="Follow Your Delivery in Real Time"
        description="Open the secure tracking link from your SMS to see delivery status, estimated arrival, and delivery progress. No login required."
        image={images.mockups.trackingUi}
        imageAlt="Delivery tracking map interface"
        ctas={[
          { label: 'Request a Quote', href: '/main-website/quote', variant: 'primary' },
          { label: 'Contact Support', href: '/main-website/contact', variant: 'outline' },
        ]}
      />
      <TrackPageContent />
      <CtaSection
        title="Need a delivery today?"
        description="Request a quote for same-day, scheduled, business, or regulated delivery across Edmonton."
      />
    </>
  )
}
