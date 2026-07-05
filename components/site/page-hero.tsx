'use client'

import Image from 'next/image'
import { motion } from 'framer-motion'
import { Reveal } from '@/components/animations/reveal'
import { MagneticButton } from './magnetic-button'

type Cta = { label: string; href: string; variant?: 'primary' | 'outline' | 'dark' }

type Props = {
  eyebrow: string
  title: string
  description: string
  image: string
  imageAlt: string
  ctas?: Cta[]
}

export function PageHero({
  eyebrow,
  title,
  description,
  image,
  imageAlt,
  ctas,
}: Props) {
  return (
    <section className="relative overflow-hidden bg-ink pt-28 pb-20 sm:pt-32 lg:pt-40 lg:pb-28">
      <div className="absolute inset-0">
        <Image
          src={image || '/placeholder.svg'}
          alt={imageAlt}
          fill
          priority
          sizes="100vw"
          className="object-cover object-center opacity-40"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-ink via-ink/90 to-ink/40" />
        <div className="absolute inset-0 bg-gradient-to-t from-ink to-transparent" />
      </div>

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl">
          <Reveal>
            <div className="mb-4 inline-flex items-center gap-2 font-mono text-xs font-medium uppercase tracking-widest text-primary">
              <span className="h-px w-6 bg-primary" />
              {eyebrow}
            </div>
          </Reveal>
          <div className="overflow-hidden">
            <motion.h1
              initial={{ y: '110%' }}
              animate={{ y: 0 }}
              transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
              className="text-balance text-4xl font-bold uppercase leading-[0.95] tracking-tight text-white sm:text-5xl lg:text-6xl"
            >
              {title}
            </motion.h1>
          </div>
          <Reveal delay={0.15}>
            <p className="mt-5 max-w-xl text-pretty text-lg leading-relaxed text-white/70">
              {description}
            </p>
          </Reveal>
          {ctas && ctas.length > 0 && (
            <Reveal delay={0.2}>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                {ctas.map((cta) => (
                  <MagneticButton
                    key={cta.href}
                    href={cta.href}
                    variant={cta.variant ?? 'primary'}
                    arrow={cta.variant !== 'outline'}
                  >
                    {cta.label}
                  </MagneticButton>
                ))}
              </div>
            </Reveal>
          )}
        </div>
      </div>
    </section>
  )
}
