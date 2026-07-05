'use client'

import { motion } from 'framer-motion'
import {
  Building2,
  Repeat,
  BellRing,
  ClipboardCheck,
  Truck,
  Users,
} from 'lucide-react'
import { FeatureCard } from '@/components/site/cards'
import { staggerContainer } from '@/components/animations/motion-variants'

const benefits = [
  {
    icon: Repeat,
    title: 'Recurring routes',
    description:
      'Set up regular delivery runs that repeat on the schedule your business needs.',
  },
  {
    icon: Truck,
    title: 'On-demand support',
    description:
      'Add same-day or scheduled deliveries whenever demand spikes, without hiring drivers.',
  },
  {
    icon: BellRing,
    title: 'Customer notifications',
    description:
      'Your customers stay informed with status updates from pickup through to completion.',
  },
  {
    icon: ClipboardCheck,
    title: 'Proof of completion',
    description:
      'Every delivery is closed out with signature or photo proof for your records.',
  },
  {
    icon: Users,
    title: 'Professional drivers',
    description:
      'Deliveries are handled by drivers who represent your business well at the door.',
  },
  {
    icon: Building2,
    title: 'No fleet to manage',
    description:
      'Outsource delivery logistics so your team can focus on running the business.',
  },
]

export function BusinessBenefitsGrid() {
  return (
    <motion.div
      variants={staggerContainer}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.1 }}
      className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3"
    >
      {benefits.map((b) => (
        <FeatureCard
          key={b.title}
          icon={b.icon}
          title={b.title}
          description={b.description}
        />
      ))}
    </motion.div>
  )
}
