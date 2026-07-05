import type { Metadata } from 'next'
import Image from 'next/image'
import { PageHero } from '@/components/site/page-hero'
import { SectionHeading } from '@/components/site/section-heading'
import { Reveal, Stagger } from '@/components/animations/reveal'
import { BusinessBenefitsGrid } from '@/components/site/business-benefits-grid'
import { CtaSection } from '@/components/site/cta-section'
import { industries } from '@/data/content'
import { images } from '@/lib/images'

export const metadata: Metadata = {
  title: 'Business Delivery',
  description:
    'Recurring and on-demand delivery support for Edmonton businesses. Same-day, scheduled, and multi-stop routes with proof of completion and customer notifications.',
}

export default function BusinessDeliveryPage() {
  return (
    <>
      <PageHero
        eyebrow="Business Delivery"
        title="Delivery Support Your Business Can Rely On"
        description="Quick-Run Express works with Edmonton retailers, offices, and local operators to handle same-day, scheduled, recurring, and multi-stop deliveries — without the overhead of managing your own drivers."
        image={images.mockups.businessDashboard}
        imageAlt="Business delivery operations dashboard"
        ctas={[
          { label: 'Request a Quote', href: '/main-website/quote', variant: 'primary' },
          { label: 'Talk to Us', href: '/main-website/contact', variant: 'outline' },
        ]}
      />

      {/* Benefits */}
      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8 lg:py-28">
        <SectionHeading
          eyebrow="Why Businesses Choose Us"
          title="Outsource delivery, keep the control"
          description="We slot into your operation with dependable runs and clear communication, so deliveries stop being something you have to think about."
        />
        <BusinessBenefitsGrid />
      </section>

      {/* Showcase split */}
      <section className="border-y border-border bg-muted/30">
        <div className="mx-auto grid max-w-7xl items-center gap-12 px-4 py-20 sm:px-6 lg:grid-cols-2 lg:px-8 lg:py-28">
          <Reveal>
            <div className="relative overflow-hidden rounded-2xl border border-border shadow-xl shadow-black/5">
              <Image
                src={images.mockups.businessDashboard}
                alt="Quick-Run Express business delivery dashboard showing active routes"
                width={720}
                height={540}
                className="h-auto w-full object-cover"
              />
            </div>
          </Reveal>
          <div>
            <SectionHeading
              eyebrow="Built For Operations"
              title="A delivery partner that fits your workflow"
              description="Whether you send a handful of orders a week or run daily multi-stop routes, we set up an arrangement around your business."
            />
            <ul className="mt-8 space-y-4">
              {[
                'Same-day and scheduled options for time-sensitive orders',
                'Recurring routes for predictable, repeat deliveries',
                'Multi-stop runs that consolidate several drops into one trip',
                'Status updates and proof of delivery on every job',
              ].map((item) => (
                <li key={item} className="flex items-start gap-3">
                  <span className="mt-1.5 size-2 shrink-0 rounded-full bg-primary" />
                  <span className="leading-relaxed text-muted-foreground">{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* Industries */}
      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8 lg:py-28">
        <SectionHeading
          eyebrow="Industries We Serve"
          title="Trusted across local sectors"
          description="Quick-Run Express supports a range of Edmonton businesses with delivery needs of every shape."
          align="center"
          className="mx-auto"
        />
        <Stagger className="mt-12 flex flex-wrap justify-center gap-3">
          {industries.map((industry) => (
            <Reveal
              key={industry}
              className="rounded-full border border-border bg-card px-5 py-2.5 text-sm font-medium text-foreground"
            >
              {industry}
            </Reveal>
          ))}
        </Stagger>
      </section>

      <CtaSection
        title="Let's set up your business deliveries"
        description="Tell us about your delivery needs and we'll put together an arrangement that fits how you operate."
      />
    </>
  )
}
