'use client'

import { motion } from 'framer-motion'
import { Quote } from 'lucide-react'
import { SectionHeading } from '@/components/site/section-heading'
import { testimonials } from '@/data/content'
import { staggerContainer, fadeUp } from '@/components/animations/motion-variants'

export function Testimonials() {
  return (
    <section className="bg-background py-20 lg:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeading
          eyebrow="Trusted locally"
          title="What Edmonton businesses say"
          description="Built for the businesses that depend on reliable local delivery, every single day."
        />
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.2 }}
          className="mt-14 grid gap-6 md:grid-cols-3"
        >
          {testimonials.map((t) => (
            <motion.figure
              key={t.name}
              variants={fadeUp}
              className="flex flex-col rounded-2xl border border-border bg-card p-7 shadow-sm"
            >
              <Quote className="h-8 w-8 text-primary" aria-hidden="true" />
              <blockquote className="mt-4 flex-1 text-pretty leading-relaxed text-foreground">
                {t.quote}
              </blockquote>
              <figcaption className="mt-6 flex items-center gap-3 border-t border-border pt-5">
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-primary font-heading text-sm font-bold text-primary-foreground">
                  {t.initials}
                </span>
                <span>
                  <span className="block font-semibold text-foreground">{t.name}</span>
                  <span className="block text-sm text-muted-foreground">{t.role}</span>
                </span>
              </figcaption>
            </motion.figure>
          ))}
        </motion.div>
      </div>
    </section>
  )
}
