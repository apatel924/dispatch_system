'use client'

import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import type { WorkflowStep } from '@/data/workflow'

export function RouteTimeline({
  steps,
  tone = 'dark',
}: {
  steps: WorkflowStep[]
  tone?: 'light' | 'dark'
}) {
  return (
    <div className="mt-14">
      {/* Desktop: horizontal */}
      <div className="hidden lg:block">
        <div className="relative">
          <div
            className={cn(
              'absolute left-0 right-0 top-7 h-px',
              tone === 'dark' ? 'bg-white/15' : 'bg-border',
            )}
          />
          <motion.div
            className="absolute left-0 top-7 h-px origin-left bg-primary"
            initial={{ scaleX: 0 }}
            whileInView={{ scaleX: 1 }}
            viewport={{ once: true, amount: 0.6 }}
            transition={{ duration: 1.2, ease: 'easeInOut' }}
            style={{ right: 0 }}
          />
          <div
            className="grid gap-6"
            style={{ gridTemplateColumns: `repeat(${steps.length}, 1fr)` }}
          >
            {steps.map((step, i) => (
              <motion.div
                key={step.number}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.12, duration: 0.5 }}
                className="relative"
              >
                <span
                  className={cn(
                    'relative z-10 flex size-14 items-center justify-center rounded-full font-mono text-sm font-bold',
                    tone === 'dark'
                      ? 'bg-primary text-primary-foreground ring-4 ring-ink'
                      : 'bg-primary text-primary-foreground ring-4 ring-background',
                  )}
                >
                  {step.number}
                </span>
                <h3
                  className={cn(
                    'mt-5 text-lg font-bold uppercase tracking-tight',
                    tone === 'dark' ? 'text-white' : 'text-foreground',
                  )}
                >
                  {step.title}
                </h3>
                <p
                  className={cn(
                    'mt-2 text-sm leading-relaxed',
                    tone === 'dark' ? 'text-white/60' : 'text-muted-foreground',
                  )}
                >
                  {step.description}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </div>

      {/* Mobile: vertical */}
      <div className="lg:hidden">
        <div className="relative space-y-8 pl-14">
          <div
            className={cn(
              'absolute bottom-0 left-7 top-0 w-px -translate-x-1/2',
              tone === 'dark' ? 'bg-white/15' : 'bg-border',
            )}
          />
          {steps.map((step, i) => (
            <motion.div
              key={step.number}
              initial={{ opacity: 0, x: -16 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08, duration: 0.45 }}
              className="relative"
            >
              <span
                className={cn(
                  'absolute -left-14 flex size-14 items-center justify-center rounded-full font-mono text-sm font-bold',
                  'bg-primary text-primary-foreground',
                  tone === 'dark' ? 'ring-4 ring-ink' : 'ring-4 ring-background',
                )}
              >
                {step.number}
              </span>
              <h3
                className={cn(
                  'text-lg font-bold uppercase tracking-tight',
                  tone === 'dark' ? 'text-white' : 'text-foreground',
                )}
              >
                {step.title}
              </h3>
              <p
                className={cn(
                  'mt-1.5 text-sm leading-relaxed',
                  tone === 'dark' ? 'text-white/60' : 'text-muted-foreground',
                )}
              >
                {step.description}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  )
}
