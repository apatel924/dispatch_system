'use client'

import { motion } from 'framer-motion'

type RouteLineProps = {
  className?: string
  /** SVG path data */
  d?: string
  viewBox?: string
  strokeWidth?: number
  /** show pickup/destination dots */
  dots?: boolean
}

/**
 * An animated red route line that "draws" itself into view.
 * Used as a decorative directional accent that echoes the logo.
 */
export function RouteLine({
  className,
  d = 'M 8 12 C 40 12, 30 60, 70 60 S 110 30, 152 30',
  viewBox = '0 0 160 72',
  strokeWidth = 2,
  dots = true,
}: RouteLineProps) {
  return (
    <svg
      className={className}
      viewBox={viewBox}
      fill="none"
      aria-hidden="true"
      preserveAspectRatio="none"
    >
      <motion.path
        d={d}
        stroke="var(--signal)"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray="6 6"
        initial={{ pathLength: 0, opacity: 0 }}
        whileInView={{ pathLength: 1, opacity: 1 }}
        viewport={{ once: true, amount: 0.4 }}
        transition={{ duration: 1.1, ease: 'easeInOut' }}
      />
      {dots && (
        <>
          <circle cx="8" cy="12" r="4" fill="var(--signal)" />
          <circle cx="152" cy="30" r="4" fill="var(--signal)" />
        </>
      )}
    </svg>
  )
}
