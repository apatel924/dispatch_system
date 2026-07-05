'use client'

import { motion } from 'framer-motion'
import {
  MapPin,
  BellRing,
  UserCheck,
  ShieldCheck,
  CalendarClock,
  ClipboardCheck,
} from 'lucide-react'
import { SectionHeading } from '@/components/site/section-heading'
import { FeatureCard } from '@/components/site/cards'
import { whyQuickRun } from '@/data/content'
import { staggerContainer } from '@/components/animations/motion-variants'

const icons = [MapPin, BellRing, UserCheck, ShieldCheck, CalendarClock, ClipboardCheck]

export function WhySection() {
  return (
    <section className="bg-muted py-20 lg:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeading
          eyebrow="Why Quick-Run"
          title="Local delivery, handled properly"
          description="Everything we do is built around dependable Edmonton deliveries with clear updates and verified completion."
        />
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.15 }}
          className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3"
        >
          {whyQuickRun.map((item, i) => (
            <FeatureCard
              key={item.title}
              icon={icons[i % icons.length]}
              title={item.title}
              description={item.description}
            />
          ))}
        </motion.div>
      </div>
    </section>
  )
}
