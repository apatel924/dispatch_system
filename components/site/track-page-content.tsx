'use client'

import Link from 'next/link'
import { SectionHeading } from '@/components/site/section-heading'
import { Reveal } from '@/components/animations/reveal'
import { Lock, MessageSquare, PackageSearch } from 'lucide-react'

export function TrackPageContent() {
  return (
    <>
      <section className="mx-auto max-w-3xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-24">
        <SectionHeading
          eyebrow="Track Delivery"
          title="Check your delivery status"
          description="Quick Run Express sends a secure tracking link by SMS when your driver is assigned. Open that link or paste the code from it below."
          align="center"
          className="mx-auto"
        />
        <div className="mt-10 rounded-xl border border-border bg-card p-6 text-center shadow-sm sm:p-8">
          <p className="text-sm text-muted-foreground">
            Have your secure tracking code? Open your link directly or go to{' '}
            <Link href="/track" className="font-semibold text-primary hover:underline">
              /track/your-code
            </Link>
            .
          </p>
          <p className="mt-4 text-xs text-muted-foreground">
            Order reference numbers (for example QRX-28491) are display labels only and cannot be
            used to access tracking.
          </p>
        </div>
      </section>

      <section className="border-t border-border bg-muted/30">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
          <div className="grid gap-8 md:grid-cols-3">
            <Reveal className="rounded-xl border border-border bg-card p-6">
              <PackageSearch className="size-8 text-primary" />
              <h3 className="mt-4 text-lg font-bold uppercase tracking-tight">
                What you can see
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Current status, estimated arrival, delivery progress, and the option to add delivery
                instructions — all in one view.
              </p>
            </Reveal>
            <Reveal delay={0.05} className="rounded-xl border border-border bg-card p-6">
              <Lock className="size-8 text-primary" />
              <h3 className="mt-4 text-lg font-bold uppercase tracking-tight">
                Privacy first
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Only the secure link from your SMS can load tracking. No account login is required,
                and order numbers are never accepted as credentials.
              </p>
            </Reveal>
            <Reveal delay={0.1} className="rounded-xl border border-border bg-card p-6">
              <MessageSquare className="size-8 text-primary" />
              <h3 className="mt-4 text-lg font-bold uppercase tracking-tight">
                Need your link?
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Check the text message from Quick Run Express when your driver was assigned, or{' '}
                <Link href="/main-website/contact" className="font-semibold text-primary hover:underline">
                  contact support
                </Link>{' '}
                if you need help.
              </p>
            </Reveal>
          </div>
        </div>
      </section>
    </>
  )
}
