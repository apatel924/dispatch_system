'use client'

import Link from 'next/link'
import { useRef, type ReactNode } from 'react'
import { motion } from 'framer-motion'
import { ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'

type Variant = 'primary' | 'dark' | 'outline' | 'ghost'

const base =
  'group relative inline-flex items-center justify-center gap-2 rounded-md px-6 py-3 text-sm font-semibold tracking-wide transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background'

const variants: Record<Variant, string> = {
  primary:
    'bg-primary text-primary-foreground hover:bg-[var(--signal-dark)] shadow-sm',
  dark: 'bg-ink text-white hover:bg-charcoal',
  outline:
    'border border-border bg-background text-foreground hover:border-foreground/40',
  ghost: 'text-foreground hover:text-primary',
}

type Props = {
  href: string
  children: ReactNode
  variant?: Variant
  className?: string
  arrow?: boolean
}

export function MagneticButton({
  href,
  children,
  variant = 'primary',
  className,
  arrow = true,
}: Props) {
  const ref = useRef<HTMLAnchorElement>(null)

  function handleMove(e: React.MouseEvent<HTMLAnchorElement>) {
    const el = ref.current
    if (!el) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    if (window.matchMedia('(pointer: coarse)').matches) return
    const rect = el.getBoundingClientRect()
    const x = e.clientX - rect.left - rect.width / 2
    const y = e.clientY - rect.top - rect.height / 2
    el.style.transform = `translate(${x * 0.18}px, ${y * 0.28}px)`
  }

  function reset() {
    const el = ref.current
    if (el) el.style.transform = 'translate(0px, 0px)'
  }

  return (
    <motion.span
      className="inline-block"
      whileTap={{ scale: 0.97 }}
      style={{ display: 'inline-block' }}
    >
      <Link
        ref={ref}
        href={href}
        onMouseMove={handleMove}
        onMouseLeave={reset}
        className={cn(base, variants[variant], 'will-change-transform', className)}
        style={{ transition: 'transform 0.2s ease, background-color 0.2s ease' }}
      >
        {children}
        {arrow && (
          <ArrowRight className="size-4 transition-transform duration-200 group-hover:translate-x-1" />
        )}
      </Link>
    </motion.span>
  )
}
