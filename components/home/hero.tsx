'use client'

import Image from 'next/image'
import { motion } from 'framer-motion'
import {
  UserCheck,
  BellRing,
  Truck,
  ShieldCheck,
  MapPin,
  Bell,
  PackageCheck,
} from 'lucide-react'
import { MagneticButton } from '@/components/site/magnetic-button'
import { FloatingStatusCard } from '@/components/site/floating-status-card'
import { useParallax } from '@/components/animations/use-parallax'
import { images } from '@/lib/images'

const trustItems = [
  { icon: MapPin, label: 'Edmonton-based service' },
  { icon: Bell, label: 'Delivery status updates' },
  { icon: PackageCheck, label: 'Proof of delivery' },
  { icon: ShieldCheck, label: 'Regulated delivery support' },
]

const headingWords = ['Fast', 'delivery.', 'Clear', 'updates.', 'Verified', 'completion.']

export function Hero() {
  const imageRef = useParallax({ yPercent: 14, scaleFrom: 1.08, scaleTo: 1 })

  return (
    <section className="relative overflow-hidden bg-background pt-20">
      {/* subtle diagonal speed accent */}
      <div
        aria-hidden="true"
        className="absolute right-0 top-0 hidden h-full w-1/2 bg-muted/40 lg:block"
        style={{ clipPath: 'polygon(18% 0, 100% 0, 100% 100%, 0 100%)' }}
      />

      <div className="relative mx-auto grid max-w-7xl items-center gap-10 px-4 py-12 sm:px-6 lg:grid-cols-2 lg:gap-8 lg:py-20 lg:px-8">
        {/* Left */}
        <div className="relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 font-mono text-xs font-medium uppercase tracking-widest text-foreground/70"
          >
            <span className="size-1.5 rounded-full bg-primary" />
            Edmonton Delivery Services
          </motion.div>

          <h1 className="mt-5 text-balance text-5xl font-bold uppercase leading-[0.92] tracking-tight text-foreground sm:text-6xl lg:text-7xl">
            {headingWords.map((word, i) => (
              <span key={i} className="inline-block overflow-hidden align-bottom">
                <motion.span
                  className={i % 2 === 0 ? 'mr-[0.25em] inline-block' : 'inline-block'}
                  initial={{ y: '110%' }}
                  animate={{ y: 0 }}
                  transition={{
                    delay: 0.1 + i * 0.07,
                    duration: 0.6,
                    ease: [0.22, 1, 0.36, 1],
                  }}
                >
                  {word}
                </motion.span>
                {i % 2 === 1 ? <br /> : null}
              </span>
            ))}
          </h1>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5, duration: 0.6 }}
            className="mt-6 max-w-lg text-pretty text-lg leading-relaxed text-muted-foreground"
          >
            Quick-Run Express provides dependable same-day, scheduled, business,
            and regulated delivery services throughout Edmonton.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6, duration: 0.5 }}
            className="mt-8 flex flex-col gap-3 sm:flex-row"
          >
            <MagneticButton href="/main-website/quote" variant="primary">
              Request a Quote
            </MagneticButton>
            <MagneticButton href="/main-website/track" variant="outline" arrow={false}>
              Track a Delivery
            </MagneticButton>
          </motion.div>

          <motion.ul
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8, duration: 0.6 }}
            className="mt-10 grid grid-cols-2 gap-x-6 gap-y-3 sm:max-w-md"
          >
            {trustItems.map((item) => (
              <li
                key={item.label}
                className="flex items-center gap-2 text-sm text-foreground/80"
              >
                <item.icon className="size-4 shrink-0 text-primary" />
                {item.label}
              </li>
            ))}
          </motion.ul>
        </div>

        {/* Right: van + floating cards */}
        <div className="relative">
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            className="relative overflow-hidden rounded-2xl border border-border shadow-2xl shadow-black/10"
            style={{ clipPath: 'polygon(0 0, 100% 0, 100% 100%, 0 92%)' }}
          >
            <div className="relative aspect-[4/3] w-full">
              <Image
                ref={imageRef as never}
                src={images.heroes.vanDriving}
                alt="Quick-Run Express delivery van driving through Edmonton"
                fill
                priority
                sizes="(max-width: 1024px) 100vw, 50vw"
                className="object-cover"
              />
            </div>
          </motion.div>

          {/* Floating status cards */}
          <div className="absolute -left-3 top-8 hidden w-52 sm:block">
            <FloatingStatusCard
              icon={UserCheck}
              title="Driver assigned"
              subtitle="On the way to pickup"
              delay={0.9}
            />
          </div>
          <div className="absolute -right-2 top-1/3 hidden w-52 sm:block">
            <FloatingStatusCard
              icon={BellRing}
              title="Customer notified"
              subtitle="SMS update sent"
              delay={1.1}
            />
          </div>
          <div className="absolute -left-2 bottom-16 hidden w-52 sm:block">
            <FloatingStatusCard
              icon={Truck}
              title="Delivery in transit"
              subtitle="Tracking live"
              delay={1.3}
            />
          </div>
          <div className="absolute -right-3 bottom-2 hidden w-52 sm:block">
            <FloatingStatusCard
              icon={ShieldCheck}
              title="Delivery verified"
              subtitle="Proof captured"
              delay={1.5}
            />
          </div>
        </div>
      </div>
    </section>
  )
}
