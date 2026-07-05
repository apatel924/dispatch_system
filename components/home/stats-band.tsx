'use client'

import { motion } from 'framer-motion'
import { stats } from '@/data/content'
import { staggerContainer, fadeUp } from '@/components/animations/motion-variants'

export function StatsBand() {
  return (
    <section className="border-y border-border bg-card">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.3 }}
          className="grid grid-cols-2 gap-8 lg:grid-cols-4"
        >
          {stats.map((stat) => (
            <motion.div key={stat.label} variants={fadeUp} className="text-center lg:text-left">
              <div className="font-heading text-3xl font-bold uppercase tracking-tight text-primary sm:text-4xl">
                {stat.value}
              </div>
              <div className="mt-2 font-heading text-lg font-semibold uppercase tracking-wide text-foreground">
                {stat.label}
              </div>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{stat.sublabel}</p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  )
}
