'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { useSearchParams } from 'next/navigation'
import { AnimatePresence, motion } from 'framer-motion'
import {
  Search,
  Truck,
  Check,
  Clock,
  Bell,
  MapPin,
  AlertCircle,
  Headset,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { DEMO_TRACKING_CODE, demoDelivery } from '@/data/trackingDemo'
import { images } from '@/lib/images'

type View = 'idle' | 'found' | 'notfound'

function resolveView(code: string): View {
  const normalized = code.trim().toUpperCase()
  if (!normalized) return 'idle'
  if (normalized === DEMO_TRACKING_CODE) return 'found'
  return 'notfound'
}

export function TrackingDemo({ initialCode = '' }: { initialCode?: string }) {
  const searchParams = useSearchParams()
  const codeFromUrl = searchParams.get('code') ?? initialCode
  const [code, setCode] = useState(codeFromUrl)
  const [view, setView] = useState<View>(() => resolveView(codeFromUrl))

  useEffect(() => {
    setCode(codeFromUrl)
    setView(resolveView(codeFromUrl))
  }, [codeFromUrl, initialCode])

  function submit(e: React.FormEvent) {
    e.preventDefault()
    setView(resolveView(code))
  }

  return (
    <div className="mx-auto w-full max-w-3xl">
      <form
        onSubmit={submit}
        className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 shadow-sm sm:flex-row sm:items-center sm:p-5"
      >
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <label htmlFor="tracking-code" className="sr-only">
            Tracking code
          </label>
          <input
            id="tracking-code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder={`Enter tracking code (try ${DEMO_TRACKING_CODE})`}
            className="w-full rounded-md border border-input bg-background py-3 pl-10 pr-3 font-mono text-sm uppercase text-foreground placeholder:font-sans placeholder:normal-case placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
        <button
          type="submit"
          className="inline-flex w-full shrink-0 items-center justify-center gap-2 rounded-md bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-[var(--signal-dark)] sm:w-auto"
        >
          <Truck className="size-4" />
          Track
        </button>
      </form>
      <p className="mt-2.5 px-1 font-mono text-[11px] text-muted-foreground">
        Demonstration tracking only. No personal data is shown.
      </p>

      <AnimatePresence mode="wait">
        {view === 'found' && <FoundState key="found" />}
        {view === 'notfound' && <NotFoundState key="notfound" />}
      </AnimatePresence>
    </div>
  )
}

function NotFoundState() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className="mt-5 flex items-start gap-3 rounded-xl border border-border bg-muted p-4 sm:p-5"
    >
      <AlertCircle className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
      <div>
        <p className="text-sm font-semibold text-foreground">
          Tracking information is unavailable in this demonstration.
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          Try the demo code{' '}
          <span className="font-mono text-foreground">{DEMO_TRACKING_CODE}</span>{' '}
          to view a sample delivery.
        </p>
      </div>
    </motion.div>
  )
}

function FoundState() {
  const d = demoDelivery
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4 }}
      className="mt-5 overflow-hidden rounded-xl border border-border bg-card"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-muted/50 px-4 py-4 sm:px-5">
        <div className="min-w-0">
          <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
            Tracking code
          </p>
          <p className="truncate font-mono text-lg font-bold text-foreground">
            {d.code}
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1.5 text-sm font-semibold text-primary">
          <Truck className="size-4" />
          {d.status}
        </span>
      </div>

      <div className="grid gap-4 p-4 sm:grid-cols-2 sm:gap-5 sm:p-5">
        <div className="flex items-start gap-3 rounded-lg border border-border p-4">
          <Clock className="mt-0.5 size-5 shrink-0 text-primary" />
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Estimated arrival
            </p>
            <p className="text-sm font-semibold text-foreground">
              {d.estimatedArrival}
            </p>
          </div>
        </div>
        <div className="flex items-start gap-3 rounded-lg border border-border p-4">
          <MapPin className="mt-0.5 size-5 shrink-0 text-primary" />
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Delivery type
            </p>
            <p className="text-sm font-semibold text-foreground">
              {d.deliveryType}
            </p>
          </div>
        </div>
      </div>

      <div className="relative mx-4 mb-4 overflow-hidden rounded-lg border border-border sm:mx-5 sm:mb-5">
        <div className="relative aspect-[16/9] w-full sm:aspect-[16/7]">
          <Image
            src={images.mockups.trackingUi}
            alt="Example delivery route on a map"
            fill
            sizes="(max-width: 768px) 100vw, 700px"
            className="object-cover object-left"
          />
        </div>
        <span className="absolute left-3 top-3 rounded bg-ink/80 px-2 py-1 font-mono text-[10px] uppercase tracking-wide text-white">
          Map preview
        </span>
      </div>

      <div className="grid gap-5 px-4 pb-6 sm:px-5 lg:grid-cols-2">
        <div>
          <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Delivery timeline
          </p>
          <ol className="space-y-3">
            {d.steps.map((s) => (
              <li key={s.label} className="flex items-center gap-3">
                <span
                  className={cn(
                    'flex size-7 shrink-0 items-center justify-center rounded-full',
                    s.status === 'complete' &&
                      'bg-primary text-primary-foreground',
                    s.status === 'current' &&
                      'bg-primary/15 text-primary ring-2 ring-primary',
                    s.status === 'pending' && 'bg-muted text-muted-foreground',
                  )}
                >
                  {s.status === 'complete' ? (
                    <Check className="size-4" />
                  ) : s.status === 'current' ? (
                    <Truck className="size-3.5" />
                  ) : (
                    <span className="size-2 rounded-full bg-current" />
                  )}
                </span>
                <div className="flex min-w-0 flex-1 flex-col gap-0.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-2">
                  <span
                    className={cn(
                      'text-sm',
                      s.status === 'pending'
                        ? 'text-muted-foreground'
                        : 'font-medium text-foreground',
                    )}
                  >
                    {s.label}
                  </span>
                  <span className="shrink-0 font-mono text-xs text-muted-foreground">
                    {s.time}
                  </span>
                </div>
              </li>
            ))}
          </ol>
        </div>

        <div>
          <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Notification history
          </p>
          <ul className="space-y-2.5">
            {d.notifications.map((n) => (
              <li
                key={n.title}
                className="flex items-center gap-3 rounded-lg border border-border px-3 py-2.5"
              >
                <Bell className="size-4 shrink-0 text-primary" />
                <span className="min-w-0 flex-1 text-sm text-foreground">{n.title}</span>
                <span className="shrink-0 font-mono text-xs text-muted-foreground">
                  {n.time}
                </span>
              </li>
            ))}
          </ul>
          <a
            href="/main-website/contact"
            className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline"
          >
            <Headset className="size-4" />
            Contact support
          </a>
        </div>
      </div>
    </motion.div>
  )
}
