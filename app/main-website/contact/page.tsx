import type { Metadata } from 'next'
import Link from 'next/link'
import { Clock, Mail, MapPin, Phone } from 'lucide-react'
import { PageHero } from '@/components/site/page-hero'
import { SectionHeading } from '@/components/site/section-heading'
import { ContactForm } from '@/components/site/contact-form'
import { Reveal } from '@/components/animations/reveal'
import { CtaSection } from '@/components/site/cta-section'
import { siteConfig } from '@/lib/site'
import { images } from '@/lib/images'

export const metadata: Metadata = {
  title: 'Contact Us',
  description:
    'Contact Quick-Run Express for delivery quotes, business arrangements, regulated delivery questions, and support in Edmonton, Alberta.',
}

const contactCards = [
  {
    icon: Phone,
    label: 'Phone',
    value: siteConfig.phone,
    href: `tel:${siteConfig.phoneHref}`,
  },
  {
    icon: Mail,
    label: 'Email',
    value: siteConfig.email,
    href: `mailto:${siteConfig.email}`,
  },
  {
    icon: MapPin,
    label: 'Service area',
    value: siteConfig.addressLine1,
    sub: siteConfig.addressLine2,
  },
  {
    icon: Clock,
    label: 'Hours',
    value: siteConfig.hours,
  },
]

export default function ContactPage() {
  return (
    <>
      <PageHero
        eyebrow="Contact"
        title="Get in Touch With Our Team"
        description="Questions about a delivery, business arrangements, or regulated service requirements? Reach out and we'll get back to you during business hours."
        image={images.marketing.edmontonSkyline}
        imageAlt="Edmonton skyline at dusk"
        ctas={[
          { label: 'Request a Quote', href: '/main-website/quote', variant: 'primary' },
          { label: 'Track a Delivery', href: '/main-website/track', variant: 'outline' },
        ]}
      />

      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {contactCards.map((card, i) => (
            <Reveal
              key={card.label}
              delay={i * 0.04}
              className="rounded-xl border border-border bg-card p-6"
            >
              <card.icon className="size-6 text-primary" />
              <p className="mt-4 font-mono text-xs uppercase tracking-widest text-muted-foreground">
                {card.label}
              </p>
              {'href' in card && card.href ? (
                <a
                  href={card.href}
                  className="mt-1 block text-sm font-semibold text-foreground transition-colors hover:text-primary"
                >
                  {card.value}
                </a>
              ) : (
                <p className="mt-1 text-sm font-semibold text-foreground">{card.value}</p>
              )}
              {'sub' in card && card.sub && (
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{card.sub}</p>
              )}
            </Reveal>
          ))}
        </div>
      </section>

      <section className="border-y border-border bg-muted/30">
        <div className="mx-auto grid max-w-7xl items-start gap-12 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:gap-16 lg:px-8 lg:py-24">
          <div>
            <SectionHeading
              eyebrow="Send a Message"
              title="We'll respond during business hours"
              description="Use the form for general inquiries, delivery questions, or support. For urgent same-day requests, call us directly."
            />
            <ul className="mt-8 space-y-3 text-sm text-muted-foreground">
              <li className="flex items-start gap-2">
                <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" />
                Need pricing? Use the{' '}
                <Link href="/main-website/quote" className="font-semibold text-primary hover:underline">
                  quote request form
                </Link>{' '}
                for faster routing.
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" />
                Tracking issues? Try the{' '}
                <Link href="/main-website/track" className="font-semibold text-primary hover:underline">
                  tracking page
                </Link>{' '}
                first, then contact us if needed.
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" />
                Regulated delivery questions welcome — we can walk through workflow requirements.
              </li>
            </ul>
          </div>
          <Reveal>
            <div className="rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-8">
              <ContactForm />
            </div>
          </Reveal>
        </div>
      </section>

      <CtaSection />
    </>
  )
}
