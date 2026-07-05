'use client'

import { Suspense } from 'react'
import { TrackingDemo } from '@/components/site/tracking-demo'
import { SectionHeading } from '@/components/site/section-heading'
import { Reveal } from '@/components/animations/reveal'
import { DEMO_TRACKING_CODE } from '@/data/trackingDemo'
import { Lock, PackageSearch } from 'lucide-react'

function TrackingDemoFallback() {
  return (
    <div className="mx-auto h-32 max-w-3xl animate-pulse rounded-xl border border-border bg-muted/50" />
  )
}

export function TrackPageContent() {
  return (
    <>
      <section className="mx-auto max-w-3xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-24">
        <SectionHeading
          eyebrow="Track Delivery"
          title="Check your delivery status"
          description="Enter your tracking code to see an example of how Quick-Run Express keeps customers informed from pickup through completion."
          align="center"
          className="mx-auto"
        />
        <div className="mt-10">
          <Suspense fallback={<TrackingDemoFallback />}>
            <TrackingDemo />
          </Suspense>
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
                Current status, estimated arrival, delivery timeline, and notification history — all in one view.
              </p>
            </Reveal>
            <Reveal delay={0.05} className="rounded-xl border border-border bg-card p-6">
              <Lock className="size-8 text-primary" />
              <h3 className="mt-4 text-lg font-bold uppercase tracking-tight">
                Privacy first
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Tracking only requires your delivery code. No account or personal login needed.
              </p>
            </Reveal>
            <Reveal delay={0.1} className="rounded-xl border border-border bg-card p-6">
              <span className="font-mono text-2xl font-bold text-primary">{DEMO_TRACKING_CODE}</span>
              <h3 className="mt-4 text-lg font-bold uppercase tracking-tight">
                Try the demo
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Use the sample code above to preview what a live delivery looks like in our system.
              </p>
            </Reveal>
          </div>
        </div>
      </section>
    </>
  )
}
