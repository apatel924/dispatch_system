import type { Metadata } from 'next'
import { PageHero } from '@/components/site/page-hero'
import { CtaSection } from '@/components/site/cta-section'
import { TrackPageContent } from '@/components/site/track-page-content'
import { images } from '@/lib/images'

export const metadata: Metadata = {
  title: 'Track Delivery',
  description:
    'Track your Quick-Run Express delivery in Edmonton. Enter your tracking code to see status updates, estimated arrival, and proof of delivery.',
}

export default function TrackPage() {
  return (
    <>
      <PageHero
        eyebrow="Track Delivery"
        title="Follow Your Delivery in Real Time"
        description="Enter your tracking code to see delivery status, estimated arrival, and notification history. No login required."
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
