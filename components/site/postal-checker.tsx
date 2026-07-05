'use client'

import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { CheckCircle2, HelpCircle, XCircle, Search } from 'lucide-react'
import { SERVICE_PREFIXES, NEARBY_PREFIXES } from '@/data/content'
import { cn } from '@/lib/utils'

type Result = 'available' | 'confirm' | 'outside' | null

const config = {
  available: {
    icon: CheckCircle2,
    text: 'Service may be available in your area.',
    sub: 'Submit a quote and we will confirm based on your pickup and destination.',
    cls: 'border-primary/30 bg-primary/5 text-foreground',
    iconCls: 'text-primary',
  },
  confirm: {
    icon: HelpCircle,
    text: 'Please contact us to confirm.',
    sub: 'Your area may be reachable depending on scheduling and requirements.',
    cls: 'border-amber-500/30 bg-amber-500/5 text-foreground',
    iconCls: 'text-amber-600',
  },
  outside: {
    icon: XCircle,
    text: 'Outside our current service area.',
    sub: 'Reach out and we will let you know if options are available.',
    cls: 'border-border bg-muted text-foreground',
    iconCls: 'text-muted-foreground',
  },
}

export function PostalChecker() {
  const [value, setValue] = useState('')
  const [result, setResult] = useState<Result>(null)

  function check(e: React.FormEvent) {
    e.preventDefault()
    // Front-end demo only — not real geographic validation.
    const prefix = value.trim().toUpperCase().slice(0, 2)
    if (SERVICE_PREFIXES.includes(prefix)) setResult('available')
    else if (NEARBY_PREFIXES.includes(prefix)) setResult('confirm')
    else setResult('outside')
  }

  const active = result ? config[result] : null

  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <form onSubmit={check} className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <label htmlFor="postal" className="sr-only">
            Enter your postal code
          </label>
          <input
            id="postal"
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Enter your postal code (e.g. T5J)"
            className="w-full rounded-md border border-input bg-background py-3 pl-10 pr-3 font-mono text-sm uppercase text-foreground placeholder:font-sans placeholder:normal-case placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
        <button
          type="submit"
          className="inline-flex items-center justify-center rounded-md bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-[var(--signal-dark)]"
        >
          Check area
        </button>
      </form>

      <AnimatePresence mode="wait">
        {active && (
          <motion.div
            key={result}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25 }}
            className={cn(
              'mt-4 flex items-start gap-3 rounded-lg border p-4',
              active.cls,
            )}
          >
            <active.icon className={cn('mt-0.5 size-5 shrink-0', active.iconCls)} />
            <div>
              <p className="text-sm font-semibold">{active.text}</p>
              <p className="mt-0.5 text-sm text-muted-foreground">{active.sub}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <p className="mt-3 font-mono text-[11px] text-muted-foreground">
        Demonstration only — not real geographic validation.
      </p>
    </div>
  )
}
