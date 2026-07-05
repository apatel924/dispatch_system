import type { Metadata } from 'next'
import Link from 'next/link'
import { Clock, FileText, ShieldCheck, Truck } from 'lucide-react'
import { PageHero } from '@/components/site/page-hero'
import { QuoteForm } from '@/components/site/quote-form'
import { Reveal } from '@/components/animations/reveal'
import { CtaSection } from '@/components/site/cta-section'
import { services } from '@/data/services'
import { images } from '@/lib/images'

export const metadata: Metadata = {
  title: 'Request a Quote',
  description:
    'Request a delivery quote from Quick-Run Express in Edmonton. Same-day, scheduled, business, multi-stop, and regulated delivery options.',
}

const highlights = [
  {
    icon: Truck,
    title: 'Fast response',
    description: 'We follow up on quote requests promptly during business hours.',
  },
  {
    icon: FileText,
    title: 'Clear pricing',
    description: 'Quotes are based on pickup, destination, service type, and timing.',
  },
  {
    icon: ShieldCheck,
    title: 'Regulated options',
    description: 'Structured workflows available for licensed and regulated deliveries.',
  },
  {
    icon: Clock,
    title: 'Flexible scheduling',
    description: 'Same-day, scheduled, and recurring arrangements available.',
  },
]

export default function QuotePage() {
  return (
    <>
      <PageHero
        eyebrow="Request a Quote"
        title="Tell Us About Your Delivery"
        description="Share your pickup, destination, and service needs. We'll follow up with availability and pricing for Edmonton-area deliveries."
        image={images.heroes.vanDriving}
        imageAlt="Quick-Run Express delivery van"
        ctas={[
          { label: 'Contact Us', href: '/main-website/contact', variant: 'outline' },
          { label: 'Check Coverage', href: '/main-website/coverage', variant: 'outline' },
        ]}
      />

      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
        <div className="grid gap-12 lg:grid-cols-[1fr_340px] lg:gap-16 xl:grid-cols-[1fr_380px]">
          <Reveal>
            <div className="rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-8">
              <QuoteForm />
            </div>
          </Reveal>

          <aside className="space-y-6">
            <div className="rounded-xl border border-border bg-muted/30 p-6">
              <h3 className="font-mono text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Services we quote
              </h3>
              <ul className="mt-4 space-y-3">
                {services.map((s) => (
                  <li key={s.slug}>
                    <Link
                      href="/main-website/services"
                      className="text-sm font-medium text-foreground hover:text-primary"
                    >
                      {s.title}
                    </Link>
                    <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                      {s.short}
                    </p>
                  </li>
                ))}
              </ul>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
              {highlights.map((item, i) => (
                <Reveal key={item.title} delay={i * 0.04} className="rounded-xl border border-border bg-card p-5">
                  <item.icon className="size-6 text-primary" />
                  <h4 className="mt-3 text-sm font-bold uppercase tracking-tight">{item.title}</h4>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{item.description}</p>
                </Reveal>
              ))}
            </div>
          </aside>
        </div>
      </section>

      <CtaSection
        title="Prefer to talk it through?"
        description="Call or email our team if you have questions about service types, coverage, or regulated delivery requirements."
      />
    </>
  )
}
