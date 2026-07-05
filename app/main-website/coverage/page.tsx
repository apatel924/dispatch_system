import type { Metadata } from 'next'
import Image from 'next/image'
import { MapPin } from 'lucide-react'
import { PageHero } from '@/components/site/page-hero'
import { SectionHeading } from '@/components/site/section-heading'
import { Reveal } from '@/components/animations/reveal'
import { PostalChecker } from '@/components/site/postal-checker'
import { CtaSection } from '@/components/site/cta-section'
import { coverageCities, coverageItems } from '@/data/content'
import { images } from '@/lib/images'

export const metadata: Metadata = {
  title: 'Coverage Area',
  description:
    'Quick-Run Express delivers across Edmonton and surrounding service areas. Check your postal code to see if you are in our coverage zone.',
}

export default function CoveragePage() {
  return (
    <>
      <PageHero
        eyebrow="Coverage Area"
        title="Delivering Across Edmonton"
        description="Quick-Run Express focuses on Edmonton and the surrounding region. Check your postal code below to confirm availability for your pickup and destination."
        image={images.marketing.albertaMap}
        imageAlt="Stylized map of the Edmonton delivery coverage area"
        ctas={[
          { label: 'Request a Quote', href: '/main-website/quote', variant: 'primary' },
          { label: 'Contact Us', href: '/main-website/contact', variant: 'outline' },
        ]}
      />

      {/* Edmonton focus */}
      <section className="border-b border-border bg-ink">
        <div className="mx-auto grid max-w-7xl items-center gap-10 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:gap-16 lg:px-8 lg:py-24">
          <Reveal>
            <div className="relative overflow-hidden rounded-2xl border border-white/10">
              <div className="relative aspect-[16/10] w-full">
                <Image
                  src={images.marketing.edmontonSkyline}
                  alt="Edmonton skyline"
                  fill
                  sizes="(max-width: 1024px) 100vw, 50vw"
                  className="object-cover"
                />
              </div>
            </div>
          </Reveal>
          <div>
            <SectionHeading
              tone="dark"
              eyebrow="Local Focus"
              title="Built for Edmonton deliveries"
              description="Our network is centred on Edmonton and the communities that surround it — not long-haul corridors. That means faster local runs, clearer ETAs, and drivers who know the area."
            />
            <ul className="mt-8 space-y-4">
              {[
                'Same-day and scheduled delivery across the city',
                'Business routes in Sherwood Park, St. Albert, Leduc, and nearby areas',
                'Regulated delivery workflows for licensed Edmonton retailers',
              ].map((item) => (
                <li key={item} className="flex items-start gap-3 text-white/70">
                  <span className="mt-1.5 size-2 shrink-0 rounded-full bg-primary" />
                  <span className="text-sm leading-relaxed">{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* Postal checker */}
      <section className="mx-auto max-w-3xl px-4 py-20 sm:px-6 lg:px-8 lg:py-28">
        <SectionHeading
          eyebrow="Check Availability"
          title="Are we in your area?"
          description="Enter your postal code to see an example of how we confirm coverage. Final availability is always confirmed based on your specific pickup and destination."
          align="center"
          className="mx-auto"
        />
        <div className="mt-10">
          <PostalChecker />
        </div>
      </section>

      {/* Coverage cities */}
      <section className="border-y border-border bg-muted/30">
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8 lg:py-28">
          <SectionHeading
            eyebrow="Service Areas"
            title="Neighbourhoods & nearby communities"
            description="We actively support deliveries across Edmonton and these surrounding communities."
          />
          <div className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {coverageCities.map((city, i) => (
              <Reveal
                key={city}
                delay={i * 0.03}
                className="flex items-center gap-3 rounded-xl border border-border bg-card p-5"
              >
                <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <MapPin className="size-5" />
                </span>
                <span className="font-semibold text-card-foreground">{city}</span>
              </Reveal>
            ))}
          </div>
          <p className="mt-8 text-sm leading-relaxed text-muted-foreground">
            {
              "Don't see your area listed? We're often able to accommodate nearby locations — reach out and we'll confirm."
            }
          </p>
        </div>
      </section>

      {/* What coverage includes */}
      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8 lg:py-28">
        <SectionHeading
          eyebrow="What's Included"
          title="More than just a delivery zone"
          description="Our coverage spans the full range of services we offer across the Edmonton region."
          align="center"
          className="mx-auto"
        />
        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {coverageItems.map((item, i) => (
            <Reveal
              key={item.title}
              delay={i * 0.05}
              className="rounded-xl border border-border bg-card p-6"
            >
              <h3 className="text-lg font-bold uppercase tracking-tight text-card-foreground">
                {item.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {item.description}
              </p>
            </Reveal>
          ))}
        </div>
      </section>

      <CtaSection />
    </>
  )
}
