'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Search, Truck, Lock } from 'lucide-react'
import { DEMO_TRACKING_CODE } from '@/data/trackingDemo'

export function TrackingBar() {
  const router = useRouter()
  const [code, setCode] = useState('')

  function submit(e: React.FormEvent) {
    e.preventDefault()
    const q = code.trim().toUpperCase()
    router.push(q ? `/main-website/track?code=${encodeURIComponent(q)}` : '/main-website/track')
  }

  return (
    <div className="relative z-20 mx-auto -mt-8 max-w-5xl px-4 sm:px-6 lg:-mt-12 lg:px-8">
      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-xl shadow-black/10">
        <div className="grid items-center gap-5 p-6 sm:p-8 lg:grid-cols-[1fr_auto]">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Truck className="size-5" />
              </span>
              <h2 className="text-xl font-bold uppercase tracking-tight text-foreground">
                Track your delivery
              </h2>
            </div>
            <form onSubmit={submit} className="mt-4 flex flex-col gap-3 sm:flex-row">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <label htmlFor="home-track" className="sr-only">
                  Tracking code
                </label>
                <input
                  id="home-track"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="Enter your tracking code"
                  className="w-full rounded-md border border-input bg-background py-3 pl-10 pr-3 font-mono text-sm uppercase text-foreground placeholder:font-sans placeholder:normal-case placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>
              <button
                type="submit"
                className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-[var(--signal-dark)]"
              >
                Track
              </button>
            </form>
            <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
              <Lock className="size-3" />
              No personal information is required to check a delivery status.
            </p>
          </div>

          <div className="hidden h-full items-center border-l border-border pl-8 lg:flex">
            <div>
              <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
                Demo code
              </p>
              <p className="mt-1 font-mono text-xl font-bold text-foreground sm:text-2xl">
                {DEMO_TRACKING_CODE}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
