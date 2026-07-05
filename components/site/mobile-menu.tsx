'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { X, ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { navLinks } from '@/lib/site'
import { images } from '@/lib/images'

type Props = {
  open: boolean
  onClose: () => void
  pathname: string
}

export function MobileMenu({ open, onClose, pathname }: Props) {
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [open])

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[60] flex flex-col bg-background lg:hidden"
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -12 }}
          transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="flex h-20 items-center justify-between border-b border-border px-4 sm:px-6">
            <Image
              src={images.brand.logo}
              alt="Quick-Run Express"
              width={180}
              height={120}
              className="h-11 w-auto object-contain"
            />
            <button
              type="button"
              onClick={onClose}
              className="inline-flex size-11 items-center justify-center rounded-md border border-border text-foreground hover:bg-accent"
              aria-label="Close menu"
            >
              <X className="size-5" />
            </button>
          </div>

          <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-4 py-6 sm:px-6">
            {navLinks.map((link, i) => (
              <motion.div
                key={link.href}
                initial={{ opacity: 0, x: -16 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.05 + i * 0.04 }}
              >
                <Link
                  href={link.href}
                  onClick={onClose}
                  className={cn(
                    'flex items-center justify-between border-b border-border/60 py-4 text-2xl font-semibold uppercase tracking-tight font-heading',
                    pathname === link.href
                      ? 'text-primary'
                      : 'text-foreground',
                  )}
                >
                  {link.label}
                  <ArrowRight className="size-5 text-muted-foreground" />
                </Link>
              </motion.div>
            ))}
          </nav>

          <div className="grid grid-cols-1 gap-3 border-t border-border px-4 py-6 sm:px-6">
            <Link
              href="/main-website/track"
              onClick={onClose}
              className="inline-flex items-center justify-center rounded-md border border-border px-5 py-3.5 text-base font-semibold text-foreground"
            >
              Track Delivery
            </Link>
            <Link
              href="/main-website/quote"
              onClick={onClose}
              className="inline-flex items-center justify-center rounded-md bg-primary px-5 py-3.5 text-base font-semibold text-primary-foreground"
            >
              Request a Quote
            </Link>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
