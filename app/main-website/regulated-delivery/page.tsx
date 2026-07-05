import type { Metadata } from 'next'
import Image from 'next/image'
import { PageHero } from '@/components/site/page-hero'
import { SectionHeading } from '@/components/site/section-heading'
import { Reveal } from '@/components/animations/reveal'
import { RegulatedCapabilitiesGrid } from '@/components/site/regulated-capabilities-grid'
import { RouteTimeline } from '@/components/site/route-timeline'
import { CtaSection } from '@/components/site/cta-section'
import { workflowSteps } from '@/data/workflow'
import { images } from '@/lib/images'

export const metadata: Metadata = {
  title: 'Regulated Delivery',
  description:
    'Structured delivery workflows for licensed retailers and regulated businesses in Edmonton — recipient confirmation, identity and age verification, proof of delivery, and event logging.',
}

export default function RegulatedDeliveryPage() {
  return (
    <>
      <PageHero
        eyebrow="Regulated Delivery"
        title="Compliant Delivery, Documented Every Step"
        description="For licensed retailers and regulated businesses, Quick-Run Express follows a structured workflow with recipient confirmation, verification steps, proof of delivery, and event logging."
        image={images.heroes.idVerification}
        imageAlt="Driver completing identity verification at the door"
        ctas={[
          { label: 'Discuss Your Requirements', href: '/main-website/contact', variant: 'primary' },
          { label: 'Request a Quote', href: '/main-website/quote', variant: 'outline' },
        ]}
      />

      {/* Capabilities */}
      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8 lg:py-28">
        <SectionHeading
          eyebrow="What's Included"
          title="Verification and documentation, built in"
          description="Regulated deliveries demand more than getting a package from A to B. Our workflow captures the confirmations and records that compliant delivery requires."
        />
        <RegulatedCapabilitiesGrid />
      </section>

      {/* Workflow timeline (dark) */}
      <section className="bg-ink py-20 lg:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <SectionHeading
            tone="dark"
            eyebrow="The Workflow"
            title="An eight-step regulated delivery process"
            description="From order submission to logged completion, every regulated delivery follows the same documented path."
          />
          <RouteTimeline steps={workflowSteps} tone="dark" />
        </div>
      </section>

      {/* Verification showcase */}
      <section className="border-b border-border bg-muted/30">
        <div className="mx-auto grid max-w-7xl items-center gap-12 px-4 py-20 sm:px-6 lg:grid-cols-2 lg:px-8 lg:py-28">
          <div>
            <SectionHeading
              eyebrow="Designed For Compliance"
              title="Support for AGLC-aligned deliveries"
              description="Our regulated workflow is built to support the confirmation and verification steps licensed retailers rely on."
            />
            <div className="mt-8 rounded-xl border border-border bg-card p-6">
              <p className="text-sm leading-relaxed text-muted-foreground">
                Requirements vary by applicable legislation and by retailer. We
                work with your business to align the delivery workflow to the
                rules you operate under, and document each step along the way.
              </p>
            </div>
          </div>
          <Reveal>
            <div className="relative overflow-hidden rounded-2xl border border-border shadow-xl shadow-black/5">
              <Image
                src={images.mockups.verificationUi}
                alt="Verification interface used during regulated delivery"
                width={720}
                height={560}
                className="h-auto w-full object-cover"
              />
            </div>
          </Reveal>
        </div>
      </section>

      <CtaSection
        title="Need compliant delivery for your licensed business?"
        description="Talk to Quick-Run Express about a regulated delivery workflow aligned to your requirements."
      />
    </>
  )
}
