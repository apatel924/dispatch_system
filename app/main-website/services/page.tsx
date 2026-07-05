import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { PageHero } from '@/components/site/page-hero'
import { SectionHeading } from '@/components/site/section-heading'
import { Reveal } from '@/components/animations/reveal'
import { ServiceCardsGrid } from '@/components/site/service-cards-grid'
import { CtaSection } from '@/components/site/cta-section'
import { services } from '@/data/services'
import { images } from '@/lib/images'

export const metadata: Metadata = {
  title: 'Delivery Services',
  description:
    'Same-day, scheduled, business, multi-stop, regulated, and custom commercial delivery services across Edmonton from Quick-Run Express.',
}

export default function ServicesPage() {
  return (
    <>
      <PageHero
        eyebrow="Our Services"
        title="Delivery Built Around How You Work"
        description="From urgent same-day runs to structured regulated deliveries, Quick-Run Express offers flexible service options for Edmonton businesses and individuals."
        image={images.heroes.vanDriving}
        imageAlt="Quick-Run Express delivery van driving through Edmonton"
        ctas={[
          { label: 'Request a Quote', href: '/main-website/quote', variant: 'primary' },
          { label: 'Check Coverage', href: '/main-website/coverage', variant: 'outline' },
        ]}
      />

      {/* Service grid */}
      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8 lg:py-28">
        <SectionHeading
          eyebrow="What We Offer"
          title="Six ways we move your deliveries"
          description="Choose the service that fits your situation, or combine several into a custom arrangement."
        />
        <ServiceCardsGrid />
      </section>

      {/* Detailed sections */}
      <section className="border-t border-border bg-muted/30">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          {services.map((service, i) => {
            const Icon = service.icon
            return (
              <div
                key={service.slug}
                id={service.slug}
                className="scroll-mt-24 border-b border-border py-16 last:border-b-0 lg:py-20"
              >
                <div className="grid gap-10 lg:grid-cols-12 lg:gap-12">
                  <div className="lg:col-span-5">
                    <Reveal>
                      <span className="inline-flex size-14 items-center justify-center rounded-xl bg-primary/10 text-primary">
                        <Icon className="size-7" />
                      </span>
                    </Reveal>
                    <Reveal delay={0.05}>
                      <h2 className="mt-5 text-3xl font-bold uppercase tracking-tight text-foreground">
                        {service.title}
                      </h2>
                    </Reveal>
                    <Reveal delay={0.1}>
                      <p className="mt-3 text-pretty leading-relaxed text-muted-foreground">
                        {service.short}
                      </p>
                    </Reveal>
                    <Reveal delay={0.15}>
                      <p className="mt-6 font-mono text-xs uppercase tracking-widest text-primary">
                        Availability
                      </p>
                      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                        {service.availability}
                      </p>
                    </Reveal>
                  </div>

                  <div className="lg:col-span-7">
                    <div className="grid gap-6 sm:grid-cols-2">
                      <Reveal className="rounded-xl border border-border bg-card p-6">
                        <h3 className="text-sm font-bold uppercase tracking-wide text-foreground">
                          Who it&apos;s for
                        </h3>
                        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                          {service.forWho}
                        </p>
                      </Reveal>
                      <Reveal
                        delay={0.05}
                        className="rounded-xl border border-border bg-card p-6"
                      >
                        <h3 className="text-sm font-bold uppercase tracking-wide text-foreground">
                          How it works
                        </h3>
                        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                          {service.how}
                        </p>
                      </Reveal>
                    </div>
                    <Reveal delay={0.1} className="mt-6 rounded-xl border border-border bg-card p-6">
                      <h3 className="text-sm font-bold uppercase tracking-wide text-foreground">
                        Key benefits
                      </h3>
                      <ul className="mt-4 grid gap-3 sm:grid-cols-2">
                        {service.benefits.map((b) => (
                          <li
                            key={b}
                            className="flex items-start gap-2.5 text-sm text-muted-foreground"
                          >
                            <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" />
                            {b}
                          </li>
                        ))}
                      </ul>
                      <Link
                        href="/main-website/quote"
                        className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-primary"
                      >
                        Request this service
                        <ArrowRight className="size-4" />
                      </Link>
                    </Reveal>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </section>

      <CtaSection />
    </>
  )
}
