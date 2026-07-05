'use client'

import { motion } from 'framer-motion'
import { SectionHeading } from '@/components/site/section-heading'
import { ServiceCard } from '@/components/site/cards'
import { MagneticButton } from '@/components/site/magnetic-button'
import { services } from '@/data/services'
import { staggerContainer } from '@/components/animations/motion-variants'

export function ServicesOverview() {
  return (
    <section className="bg-background py-20 lg:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col items-start justify-between gap-6 lg:flex-row lg:items-end">
          <SectionHeading
            eyebrow="What we deliver"
            title="Delivery services for Edmonton"
            description="From urgent same-day runs to structured regulated workflows, we cover the way Edmonton businesses move goods."
          />
          <div className="shrink-0">
            <MagneticButton href="/main-website/services" variant="outline">
              View all services
            </MagneticButton>
          </div>
        </div>
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.1 }}
          className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3"
        >
          {services.map((s) => (
            <ServiceCard
              key={s.slug}
              icon={s.icon}
              title={s.title}
              description={s.short}
              benefit={s.benefit}
              href={`/main-website/services#${s.slug}`}
            />
          ))}
        </motion.div>
      </div>
    </section>
  )
}
