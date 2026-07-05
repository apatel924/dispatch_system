import type { Metadata } from 'next'
import Image from 'next/image'
import { PageHero } from '@/components/site/page-hero'
import { SectionHeading } from '@/components/site/section-heading'
import { Reveal } from '@/components/animations/reveal'
import { RouteTimeline } from '@/components/site/route-timeline'
import { FaqAccordion } from '@/components/site/faq-accordion'
import { CtaSection } from '@/components/site/cta-section'
import { howItWorksSteps, howItWorksExtended } from '@/data/workflow'
import { faqs } from '@/data/content'
import { images } from '@/lib/images'

export const metadata: Metadata = {
  title: 'How It Works',
  description:
    'See how Quick-Run Express handles a delivery from request to completion — submission, driver assignment, live updates, verification, and proof of delivery.',
}

export default function HowItWorksPage() {
  return (
    <>
      <PageHero
        eyebrow="How It Works"
        title="From Request to Doorstep, Clearly"
        description="Every Quick-Run Express delivery follows a clear, trackable path. Here's what happens from the moment you submit a request to proof of delivery."
        image={images.heroes.packageHandoff}
        imageAlt="Driver handing a package to a recipient at the door"
        ctas={[
          { label: 'Request a Quote', href: '/main-website/quote', variant: 'primary' },
          { label: 'Track a Delivery', href: '/main-website/track', variant: 'outline' },
        ]}
      />

      {/* Simple 4-step overview */}
      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8 lg:py-28">
        <SectionHeading
          eyebrow="The Essentials"
          title="Four steps to a completed delivery"
          description="The core flow is simple. Submit the details, we handle pickup and updates, and the delivery is completed with proof."
          align="center"
          className="mx-auto"
        />
        <RouteTimeline steps={howItWorksSteps} tone="light" />
      </section>

      {/* Detailed steps (dark) */}
      <section className="bg-ink py-20 lg:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <SectionHeading
            tone="dark"
            eyebrow="Step By Step"
            title="A closer look at the full journey"
            description="For deliveries that need extra care, here is the complete sequence we follow end to end."
          />
          <div className="mt-12 grid gap-x-12 gap-y-8 lg:grid-cols-2">
            {howItWorksExtended.map((step, i) => (
              <Reveal
                key={step.number}
                delay={i * 0.04}
                className="flex gap-5 rounded-xl border border-white/10 bg-white/[0.03] p-6"
              >
                <span className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-primary font-mono text-sm font-bold text-primary-foreground">
                  {step.number}
                </span>
                <div>
                  <h3 className="text-lg font-bold uppercase tracking-tight text-white">
                    {step.title}
                  </h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-white/60">
                    {step.description}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Updates showcase */}
      <section className="border-b border-border bg-muted/30">
        <div className="mx-auto grid max-w-7xl items-center gap-12 px-4 py-20 sm:px-6 lg:grid-cols-2 lg:px-8 lg:py-28">
          <Reveal>
            <div className="relative mx-auto max-w-sm overflow-hidden rounded-2xl border border-border shadow-xl shadow-black/5">
              <Image
                src={images.mockups.smsMockup}
                alt="Phone showing delivery status update notifications"
                width={480}
                height={640}
                className="h-auto w-full object-cover"
              />
            </div>
          </Reveal>
          <div>
            <SectionHeading
              eyebrow="Stay Informed"
              title="Updates at every stage"
              description="Recipients are kept in the loop as the delivery moves toward them, so no one is left guessing."
            />
            <ul className="mt-8 space-y-4">
              {[
                'Notification when a driver is assigned and pickup is complete',
                'Status updates as the delivery makes its way to the destination',
                'Confirmation and proof of delivery once completed',
                'Documentation if a delivery cannot be completed',
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

      {/* Quick links */}
      <section className="border-b border-border bg-muted/30">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
          <SectionHeading
            eyebrow="Get Started"
            title="Ready to send a delivery?"
            description="Choose the path that fits — request a quote, track an active delivery, or reach out with questions."
            align="center"
            className="mx-auto"
          />
          <div className="mt-10 grid gap-4 sm:grid-cols-3">
            {[
              { label: 'Request a Quote', href: '/main-website/quote', desc: 'Share pickup, destination, and timing' },
              { label: 'Track Delivery', href: '/main-website/track', desc: 'Check status with your tracking code' },
              { label: 'Contact Us', href: '/main-website/contact', desc: 'Questions about service or coverage' },
            ].map((link) => (
              <Reveal key={link.href}>
                <a
                  href={link.href}
                  className="group flex h-full flex-col rounded-xl border border-border bg-card p-6 transition-colors hover:border-primary/40 hover:bg-primary/5"
                >
                  <span className="text-lg font-bold uppercase tracking-tight text-foreground group-hover:text-primary">
                    {link.label}
                  </span>
                  <span className="mt-2 text-sm text-muted-foreground">{link.desc}</span>
                </a>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="mx-auto max-w-3xl px-4 py-20 sm:px-6 lg:px-8 lg:py-28">
        <SectionHeading
          eyebrow="Questions"
          title="Common questions about the process"
          align="center"
          className="mx-auto"
        />
        <div className="mt-12">
          <FaqAccordion items={faqs} />
        </div>
      </section>

      <CtaSection />
    </>
  )
}
