'use client'

import { motion, type Variants } from 'framer-motion'
import type { ReactNode } from 'react'
import { fadeUp, staggerContainer } from './motion-variants'

type RevealProps = {
  children: ReactNode
  className?: string
  variants?: Variants
  delay?: number
  once?: boolean
  amount?: number
  as?: 'div' | 'section' | 'li' | 'span' | 'ul'
}

export function Reveal({
  children,
  className,
  variants = fadeUp,
  delay = 0,
  once = true,
  amount = 0.3,
}: RevealProps) {
  return (
    <motion.div
      className={className}
      variants={variants}
      initial="hidden"
      whileInView="show"
      viewport={{ once, amount }}
      transition={delay ? { delay } : undefined}
    >
      {children}
    </motion.div>
  )
}

type StaggerProps = {
  children: ReactNode
  className?: string
  once?: boolean
  amount?: number
}

export function Stagger({
  children,
  className,
  once = true,
  amount = 0.2,
}: StaggerProps) {
  return (
    <motion.div
      className={className}
      variants={staggerContainer}
      initial="hidden"
      whileInView="show"
      viewport={{ once, amount }}
    >
      {children}
    </motion.div>
  )
}

export function StaggerItem({
  children,
  className,
  variants = fadeUp,
}: {
  children: ReactNode
  className?: string
  variants?: Variants
}) {
  return (
    <motion.div className={className} variants={variants}>
      {children}
    </motion.div>
  )
}
