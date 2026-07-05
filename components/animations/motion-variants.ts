import type { Variants } from 'framer-motion'

const ease = [0.22, 1, 0.36, 1] as const

const show = {
  opacity: 1,
  y: 0,
  x: 0,
  scale: 1,
  transition: { duration: 0.5, ease },
}

// Each variant exposes both `show` and `visible` as the active state so that
// components can use either key interchangeably.
export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 24 },
  show,
  visible: show,
}

export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: 0.5 } },
  visible: { opacity: 1, transition: { duration: 0.5 } },
}

const staggerShow = {
  transition: { staggerChildren: 0.1, delayChildren: 0.05 },
}

export const staggerContainer: Variants = {
  hidden: {},
  show: staggerShow,
  visible: staggerShow,
}

const scaleShow = {
  opacity: 1,
  scale: 1,
  transition: { duration: 0.5, ease },
}

export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.96 },
  show: scaleShow,
  visible: scaleShow,
}

const fromLeftShow = {
  opacity: 1,
  x: 0,
  transition: { duration: 0.55, ease },
}

export const fromLeft: Variants = {
  hidden: { opacity: 0, x: -32 },
  show: fromLeftShow,
  visible: fromLeftShow,
}

const fromRightShow = {
  opacity: 1,
  x: 0,
  transition: { duration: 0.55, ease },
}

export const fromRight: Variants = {
  hidden: { opacity: 0, x: 32 },
  show: fromRightShow,
  visible: fromRightShow,
}
