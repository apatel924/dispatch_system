'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { ArrowRight, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { fadeUp } from '@/components/animations/motion-variants'

export function ServiceCard({
  icon: Icon,
  title,
  description,
  benefit,
  href = '/main-website/services',
}: {
  icon: LucideIcon
  title: string
  description: string
  benefit: string
  href?: string
}) {
  return (
    <motion.div variants={fadeUp} className="h-full">
      <Link
        href={href}
        className="group relative flex h-full flex-col rounded-xl border border-border bg-card p-6 transition-all duration-300 hover:-translate-y-1 hover:border-foreground/20 hover:shadow-xl hover:shadow-black/5"
      >
        <span className="inline-flex size-12 items-center justify-center rounded-lg bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
          <Icon className="size-6" />
        </span>
        <h3 className="mt-5 text-xl font-bold uppercase tracking-tight text-foreground">
          {title}
        </h3>
        <p className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">
          {description}
        </p>
        <p className="mt-4 text-sm font-medium text-foreground">{benefit}</p>
        <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-primary">
          Learn more
          <ArrowRight className="size-4 transition-transform duration-200 group-hover:translate-x-1" />
        </span>
      </Link>
    </motion.div>
  )
}

export function FeatureCard({
  icon: Icon,
  title,
  description,
  tone = 'light',
}: {
  icon: LucideIcon
  title: string
  description: string
  tone?: 'light' | 'dark'
}) {
  return (
    <motion.div
      variants={fadeUp}
      className={cn(
        'group relative flex h-full flex-col rounded-xl border p-6 transition-all duration-300 hover:-translate-y-1',
        tone === 'dark'
          ? 'border-white/10 bg-white/[0.03] hover:border-primary/40'
          : 'border-border bg-card hover:border-foreground/20 hover:shadow-lg hover:shadow-black/5',
      )}
    >
      <span
        className={cn(
          'inline-flex size-11 items-center justify-center rounded-lg',
          tone === 'dark'
            ? 'bg-primary/15 text-primary'
            : 'bg-primary/10 text-primary',
        )}
      >
        <Icon className="size-5" />
      </span>
      <h3
        className={cn(
          'mt-5 text-lg font-bold uppercase tracking-tight',
          tone === 'dark' ? 'text-white' : 'text-foreground',
        )}
      >
        {title}
      </h3>
      <p
        className={cn(
          'mt-2 text-sm leading-relaxed',
          tone === 'dark' ? 'text-white/60' : 'text-muted-foreground',
        )}
      >
        {description}
      </p>
    </motion.div>
  )
}
