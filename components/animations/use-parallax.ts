'use client'

import { useRef } from 'react'

function prefersReducedMotion() {
  if (typeof window === 'undefined') return true
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/**
 * Lightweight hero image ref — GSAP ScrollTrigger removed to avoid dev/runtime overhead.
 * Parallax was causing scroll-linked repaints; static hero is more stable on lower-end machines.
 */
export function useParallax(_options?: {
  yPercent?: number
  scaleFrom?: number
  scaleTo?: number
}) {
  const ref = useRef<HTMLElement | null>(null)

  if (typeof window !== 'undefined' && prefersReducedMotion()) {
    return ref
  }

  return ref
}
