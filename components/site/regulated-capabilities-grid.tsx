'use client'

import { motion } from 'framer-motion'
import {
  ShieldCheck,
  UserCheck,
  FileText,
  ScrollText,
  AlertTriangle,
  BadgeCheck,
} from 'lucide-react'
import { FeatureCard } from '@/components/site/cards'
import { staggerContainer } from '@/components/animations/motion-variants'

const capabilities = [
  {
    icon: UserCheck,
    title: 'Named-recipient confirmation',
    description:
      'Drivers confirm the delivery is handed to the named recipient on the order.',
  },
  {
    icon: BadgeCheck,
    title: 'Age & identity verification',
    description:
      'Verification steps are completed and recorded at the door where required.',
  },
  {
    icon: FileText,
    title: 'Signature & photo proof',
    description:
      'A signature or delivery photo is captured as documented proof of delivery.',
  },
  {
    icon: ScrollText,
    title: 'Event logging',
    description:
      'Each completion is recorded with a timestamp for an auditable trail.',
  },
  {
    icon: AlertTriangle,
    title: 'Failed-delivery documentation',
    description:
      'If a delivery cannot be completed, the reason is documented for the retailer.',
  },
  {
    icon: ShieldCheck,
    title: 'Compliance-aligned workflow',
    description:
      'A structured process designed to support AGLC-aligned delivery requirements.',
  },
]

export function RegulatedCapabilitiesGrid() {
  return (
    <motion.div
      variants={staggerContainer}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.1 }}
      className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3"
    >
      {capabilities.map((c) => (
        <FeatureCard
          key={c.title}
          icon={c.icon}
          title={c.title}
          description={c.description}
        />
      ))}
    </motion.div>
  )
}
