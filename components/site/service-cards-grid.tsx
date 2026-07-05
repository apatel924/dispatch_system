'use client'

import { motion } from 'framer-motion'
import { ServiceCard } from '@/components/site/cards'
import { services } from '@/data/services'
import { staggerContainer } from '@/components/animations/motion-variants'

export function ServiceCardsGrid() {
  return (
    <motion.div
      variants={staggerContainer}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.1 }}
      className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3"
    >
      {services.map((service) => (
        <ServiceCard
          key={service.slug}
          icon={service.icon}
          title={service.title}
          description={service.short}
          benefit={service.benefit}
          href={`#${service.slug}`}
        />
      ))}
    </motion.div>
  )
}
