import Image from 'next/image'
import { MagneticButton } from './magnetic-button'
import { Reveal } from '@/components/animations/reveal'
import { images } from '@/lib/images'

type Props = {
  title?: string
  description?: string
}

export function CtaSection({
  title = 'Ready to make your deliveries easier?',
  description = 'Speak with Quick-Run Express about same-day, scheduled, business, or regulated delivery service in Edmonton.',
}: Props) {
  return (
    <section className="relative overflow-hidden bg-ink">
      <div className="absolute inset-0">
        <Image
          src={images.heroes.vanEvening}
          alt="Quick-Run Express delivery van at a building entrance in the evening"
          fill
          sizes="100vw"
          className="object-cover object-right"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-ink via-ink/85 to-ink/20" />
      </div>

      <div className="relative mx-auto max-w-7xl px-4 py-24 sm:px-6 lg:px-8 lg:py-32">
        <div className="max-w-xl">
          {/* animated route-line accent */}
          <div className="mb-6 h-px w-24 bg-gradient-to-r from-primary to-transparent" />
          <Reveal>
            <h2 className="text-balance text-4xl font-bold uppercase leading-[0.95] tracking-tight text-white sm:text-5xl lg:text-6xl">
              {title}
            </h2>
          </Reveal>
          <Reveal delay={0.1}>
            <p className="mt-5 text-pretty text-lg leading-relaxed text-white/70">
              {description}
            </p>
          </Reveal>
          <Reveal delay={0.15}>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <MagneticButton href="/main-website/quote" variant="primary">
                Request a Quote
              </MagneticButton>
              <MagneticButton href="/main-website/contact" variant="outline" arrow={false}>
                Contact Quick-Run
              </MagneticButton>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  )
}
