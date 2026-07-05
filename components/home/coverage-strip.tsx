'use client'

import Image from 'next/image'
import Link from 'next/link'
import { ArrowRight, MapPin } from 'lucide-react'
import { Reveal } from '@/components/animations/reveal'
import { coverageCities } from '@/data/content'
import { images } from '@/lib/images'

export function CoverageStrip() {
  return (
    <section className="relative overflow-hidden bg-foreground py-20 text-background md:py-28">
      <div className="mx-auto grid max-w-7xl items-center gap-12 px-4 lg:grid-cols-2 lg:gap-16">
        <Reveal>
          <span className="inline-flex items-center gap-2 rounded-full border border-background/20 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-background/70">
            <MapPin className="size-3.5 text-primary" />
            Coverage
          </span>
          <h2 className="mt-5 font-display text-4xl font-bold uppercase leading-[0.95] tracking-tight text-balance md:text-5xl">
            Edmonton &amp;<br />
            <span className="text-primary">surrounding communities</span>
          </h2>
          <p className="mt-5 max-w-md text-base leading-relaxed text-background/70">
            Quick-Run Express focuses on local Edmonton deliveries and nearby
            communities — same-day runs, business routes, and regulated service
            with drivers who know the area.
          </p>

          <ul className="mt-8 grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3">
            {coverageCities.map((city) => (
              <li
                key={city}
                className="flex items-center gap-2 text-sm font-medium text-background/80"
              >
                <span className="size-1.5 rounded-full bg-primary" />
                {city}
              </li>
            ))}
          </ul>

          <Link
            href="/main-website/coverage"
            className="group mt-10 inline-flex items-center gap-2 text-sm font-semibold text-primary"
          >
            View full coverage map
            <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
          </Link>
        </Reveal>

        <Reveal delay={0.15}>
          <div className="relative mx-auto max-w-md overflow-hidden rounded-2xl border border-background/10 bg-background/5 p-4">
            <Image
              src={images.marketing.albertaMap}
              alt="Map showing Quick-Run Express Edmonton delivery coverage area"
              width={1456}
              height={1080}
              className="h-auto w-full rounded-xl"
            />
            <div className="pointer-events-none absolute inset-x-4 bottom-4 flex flex-col gap-2 rounded-xl border border-background/15 bg-foreground/80 px-4 py-3 backdrop-blur sm:inset-x-8 sm:bottom-6 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-[11px] uppercase tracking-widest text-background/50">
                  Service hub
                </p>
                <p className="text-sm font-semibold">Edmonton, AB</p>
              </div>
              <div className="sm:text-right">
                <p className="text-[11px] uppercase tracking-widest text-background/50">
                  Coverage
                </p>
                <p className="text-sm font-semibold text-primary">City &amp; nearby</p>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  )
}
