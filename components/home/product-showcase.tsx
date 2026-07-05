'use client'

import Image from 'next/image'
import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  MapPinned,
  MessageSquareText,
  LayoutDashboard,
  ShieldCheck,
  BellRing,
  Clock,
  PackageCheck,
  ListChecks,
  type LucideIcon,
} from 'lucide-react'
import { SectionHeading } from '@/components/site/section-heading'
import { FloatingStatusCard } from '@/components/site/floating-status-card'
import { cn } from '@/lib/utils'
import { images } from '@/lib/images'

type Tab = {
  id: string
  tabLabel: string
  tabIcon: LucideIcon
  image: string
  frame: 'browser' | 'phone'
  label: string
  title: string
  description: string
  cards: { icon: LucideIcon; title: string; subtitle: string }[]
}

const tabs: Tab[] = [
  {
    id: 'tracking',
    tabLabel: 'Live Tracking',
    tabIcon: MapPinned,
    image: images.mockups.trackingUi,
    frame: 'browser',
    label: 'Live Tracking',
    title: 'See deliveries move in real time',
    description:
      'Customers and businesses can follow a delivery from pickup to drop-off, with a clear map view and delivery timeline.',
    cards: [
      { icon: Clock, title: 'Estimated arrival updated', subtitle: 'Live ETA' },
      { icon: MapPinned, title: 'Driver en route', subtitle: 'On the way' },
    ],
  },
  {
    id: 'updates',
    tabLabel: 'Delivery Updates',
    tabIcon: MessageSquareText,
    image: images.mockups.smsMockup,
    frame: 'phone',
    label: 'Delivery Updates',
    title: 'Status updates customers can rely on',
    description:
      'Automatic messages keep recipients informed at each stage — reducing missed deliveries and unnecessary calls.',
    cards: [
      { icon: BellRing, title: 'Customer notified', subtitle: 'SMS sent' },
      { icon: PackageCheck, title: 'Delivery completed', subtitle: 'Confirmed' },
    ],
  },
  {
    id: 'business',
    tabLabel: 'Business Visibility',
    tabIcon: LayoutDashboard,
    image: images.mockups.businessDashboard,
    frame: 'browser',
    label: 'Business Visibility',
    title: 'A clear view of business deliveries',
    description:
      'Businesses get visibility across active, scheduled, and completed deliveries — all in one place. Shown here as a product preview.',
    cards: [
      { icon: LayoutDashboard, title: 'Deliveries at a glance', subtitle: 'Overview' },
      { icon: PackageCheck, title: 'Proof of delivery recorded', subtitle: 'Captured' },
    ],
  },
  {
    id: 'verification',
    tabLabel: 'Verification Workflow',
    tabIcon: ShieldCheck,
    image: images.mockups.verificationUi,
    frame: 'browser',
    label: 'Verification Workflow',
    title: 'Documented, verified completion',
    description:
      'For regulated deliveries, each verification step is recorded with timestamps and proof of delivery. Shown here as a product preview.',
    cards: [
      { icon: ListChecks, title: 'Required checks completed', subtitle: 'Verified' },
      { icon: ShieldCheck, title: 'Proof of delivery recorded', subtitle: 'Audit ready' },
    ],
  },
]

export function ProductShowcase() {
  const [active, setActive] = useState(0)
  const tab = tabs[active]

  return (
    <section className="relative overflow-hidden bg-ink py-20 lg:py-28">
      <div className="absolute inset-0 bg-route-grid-dark opacity-60" aria-hidden="true" />
      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeading
          eyebrow="The platform"
          title="Built to keep every delivery visible"
          description="Tracking, updates, business visibility, and verification — the tools behind dependable Edmonton delivery."
          tone="dark"
          align="center"
          className="mx-auto"
        />

        {/* Tabs */}
        <div
          role="tablist"
          aria-label="Platform features"
          className="mx-auto mt-10 flex max-w-3xl flex-wrap justify-center gap-2"
        >
          {tabs.map((t, i) => {
            const selected = i === active
            return (
              <button
                key={t.id}
                role="tab"
                aria-selected={selected}
                onClick={() => setActive(i)}
                className={cn(
                  'relative inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-medium transition-colors',
                  selected ? 'text-white' : 'text-white/55 hover:text-white/80',
                )}
              >
                {selected && (
                  <motion.span
                    layoutId="tab-pill"
                    className="absolute inset-0 rounded-full bg-primary"
                    transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                  />
                )}
                <span className="relative z-10 flex items-center gap-2">
                  <t.tabIcon className="size-4" />
                  {t.tabLabel}
                </span>
              </button>
            )
          })}
        </div>

        {/* Stage — fixed height to avoid layout shift */}
        <div className="relative mt-12 min-h-[440px] sm:min-h-[520px] lg:min-h-[560px]">
          <AnimatePresence mode="wait">
            <motion.div
              key={tab.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
              className="grid items-center gap-10 lg:grid-cols-[1.4fr_1fr]"
            >
              {/* Image */}
              <div className="relative">
                {tab.frame === 'browser' ? (
                  <div className="overflow-hidden rounded-xl border border-white/10 bg-card shadow-2xl shadow-black/40">
                    <div className="flex items-center gap-2 border-b border-border bg-muted/60 px-4 py-3">
                      <span className="size-2.5 rounded-full bg-border" />
                      <span className="size-2.5 rounded-full bg-border" />
                      <span className="size-2.5 rounded-full bg-border" />
                      <div className="ml-2 rounded bg-background px-2.5 py-1 font-mono text-[10px] text-muted-foreground">
                        app.quickrunexpress.ca
                      </div>
                    </div>
                    <div className="relative aspect-[16/10] w-full">
                      <Image
                        src={tab.image || '/placeholder.svg'}
                        alt={tab.title}
                        fill
                        sizes="(max-width: 1024px) 100vw, 60vw"
                        className="object-cover object-top"
                      />
                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink/70 to-transparent p-4">
                        <span className="rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground">
                          {tab.label}
                        </span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex justify-center">
                    <div className="relative w-full max-w-[280px] overflow-hidden rounded-[2.25rem] border-[6px] border-charcoal bg-charcoal shadow-2xl shadow-black/40">
                      <div className="relative aspect-[9/19] w-full overflow-hidden rounded-[1.75rem] bg-white">
                        <Image
                          src={tab.image || '/placeholder.svg'}
                          alt={tab.title}
                          fill
                          sizes="280px"
                          className="object-cover object-top"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Floating cards beside image */}
                <div className="absolute -right-3 top-6 hidden w-48 lg:block">
                  <FloatingStatusCard
                    icon={tab.cards[0].icon}
                    title={tab.cards[0].title}
                    subtitle={tab.cards[0].subtitle}
                    delay={0.2}
                  />
                </div>
                <div className="absolute -left-3 bottom-6 hidden w-48 lg:block">
                  <FloatingStatusCard
                    icon={tab.cards[1].icon}
                    title={tab.cards[1].title}
                    subtitle={tab.cards[1].subtitle}
                    delay={0.35}
                  />
                </div>
              </div>

              {/* Copy */}
              <div>
                <span className="inline-flex items-center gap-2 rounded-full border border-white/15 px-3 py-1 font-mono text-xs uppercase tracking-widest text-primary">
                  <tab.tabIcon className="size-3.5" />
                  {tab.label}
                </span>
                <h3 className="mt-4 text-balance text-2xl font-bold uppercase tracking-tight text-white sm:text-3xl">
                  {tab.title}
                </h3>
                <p className="mt-3 text-pretty leading-relaxed text-white/65">
                  {tab.description}
                </p>
                <div className="mt-6 flex flex-col gap-3 sm:hidden">
                  {tab.cards.map((c) => (
                    <div
                      key={c.title}
                      className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/[0.03] px-4 py-3"
                    >
                      <c.icon className="size-4 text-primary" />
                      <span className="text-sm font-medium text-white">
                        {c.title}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </section>
  )
}
