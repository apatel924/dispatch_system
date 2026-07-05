'use client'

import { motion } from 'framer-motion'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

type Props = {
  icon: LucideIcon
  title: string
  subtitle?: string
  className?: string
  delay?: number
  float?: boolean
}

export function FloatingStatusCard({
  icon: Icon,
  title,
  subtitle,
  className,
  delay = 0,
  float = true,
}: Props) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12, scale: 0.95 }}
      whileInView={{ opacity: 1, y: 0, scale: 1 }}
      viewport={{ once: true }}
      transition={{ delay, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className={cn('pointer-events-none select-none', className)}
    >
      <motion.div
        animate={
          float
            ? { y: [0, -6, 0] }
            : undefined
        }
        transition={
          float
            ? {
                duration: 4 + delay,
                repeat: Infinity,
                ease: 'easeInOut',
              }
            : undefined
        }
        className="flex items-center gap-3 rounded-lg border border-border bg-card/95 px-4 py-3 shadow-lg shadow-black/10 backdrop-blur"
      >
        <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
          <Icon className="size-4" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold leading-tight text-foreground">
            {title}
          </p>
          {subtitle && (
            <p className="text-xs text-muted-foreground">{subtitle}</p>
          )}
        </div>
      </motion.div>
    </motion.div>
  )
}
