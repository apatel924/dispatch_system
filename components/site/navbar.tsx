'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Menu } from 'lucide-react'
import { cn } from '@/lib/utils'
import { navLinks } from '@/lib/site'
import { images } from '@/lib/images'
import { MobileMenu } from './mobile-menu'

export function Navbar() {
  const pathname = usePathname()
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  // On non-home routes, always render the solid bar.
  const forceSolid = pathname !== '/main-website'
  const solid = scrolled || forceSolid

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <>
      <header
        className={cn(
          'fixed inset-x-0 top-0 z-50 transition-all duration-300',
          solid
            ? 'border-b border-border bg-background/95 shadow-sm backdrop-blur'
            : 'border-b border-transparent bg-transparent',
        )}
      >
        <nav
          className={cn(
            'mx-auto flex max-w-7xl items-center justify-between px-4 transition-all duration-300 sm:px-6 lg:px-8',
            solid ? 'h-16' : 'h-20',
          )}
          aria-label="Primary"
        >
          <Link
            href="/main-website"
            aria-label="Quick-Run Express — home"
            className="flex shrink-0 items-center"
          >
            <Image
              src={images.brand.logo}
              alt="Quick-Run Express"
              width={180}
              height={120}
              priority
              className={cn(
                'w-auto object-contain transition-all duration-300',
                solid ? 'h-10' : 'h-12',
              )}
              style={{ width: 'auto', height: 'auto' }}
            />
          </Link>

          <div className="hidden items-center gap-7 lg:flex">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                data-active={pathname === link.href}
                className={cn(
                  'nav-underline text-sm font-medium text-foreground/80 transition-colors hover:text-foreground',
                  pathname === link.href && 'text-foreground',
                )}
              >
                {link.label}
              </Link>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/main-website/quote"
              className="hidden rounded-md bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-[var(--signal-dark)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:inline-flex"
            >
              Request a Quote
            </Link>
            <button
              type="button"
              onClick={() => setMenuOpen(true)}
              className="inline-flex size-11 items-center justify-center rounded-md border border-border bg-background/80 text-foreground transition-colors hover:bg-accent lg:hidden"
              aria-label="Open menu"
            >
              <Menu className="size-5" />
            </button>
          </div>
        </nav>
      </header>

      <MobileMenu
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        pathname={pathname}
      />
    </>
  )
}
