import Link from 'next/link'
import Image from 'next/image'
import { Phone, Mail, MapPin } from 'lucide-react'
import { footerSections, siteConfig } from '@/lib/site'
import { images } from '@/lib/images'

export function Footer() {
  return (
    <footer className="border-t border-white/10 bg-ink text-white">
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="grid gap-10 lg:grid-cols-5">
          <div className="lg:col-span-2">
            <div className="inline-flex rounded-lg bg-white p-3">
              <Image
                src={images.brand.logo}
                alt="Quick-Run Express"
                width={180}
                height={120}
                className="h-12 w-auto object-contain"
                style={{ width: 'auto', height: 'auto' }}
              />
            </div>
            <p className="mt-5 max-w-sm text-pretty text-sm leading-relaxed text-white/60">
              {siteConfig.description}
            </p>
            <ul className="mt-6 space-y-3 text-sm text-white/70">
              <li>
                <a
                  href={`tel:${siteConfig.phoneHref}`}
                  className="inline-flex items-center gap-3 transition-colors hover:text-primary"
                >
                  <Phone className="size-4 text-primary" />
                  {siteConfig.phone}
                </a>
              </li>
              <li>
                <a
                  href={`mailto:${siteConfig.email}`}
                  className="inline-flex items-center gap-3 transition-colors hover:text-primary"
                >
                  <Mail className="size-4 text-primary" />
                  {siteConfig.email}
                </a>
              </li>
              <li className="inline-flex items-center gap-3">
                <MapPin className="size-4 text-primary" />
                {siteConfig.city}
              </li>
            </ul>
          </div>

          {footerSections.map((section) => (
            <div key={section.title}>
              <h3 className="font-mono text-xs font-semibold uppercase tracking-widest text-white/50">
                {section.title}
              </h3>
              <ul className="mt-4 space-y-3">
                {section.links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="text-sm text-white/75 transition-colors hover:text-white"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 border-t border-white/10 pt-8">
          <p className="text-xs leading-relaxed text-white/45">
            Regulated and specialty delivery services are subject to
            availability, service agreements, retailer requirements, and
            applicable laws.
          </p>
          <div className="mt-4 flex flex-col gap-2 text-xs text-white/45 sm:flex-row sm:items-center sm:justify-between">
            <p>
              &copy; {new Date().getFullYear()} {siteConfig.name}. All rights
              reserved.
            </p>
            <p className="font-mono">{siteConfig.city}</p>
          </div>
        </div>
      </div>
    </footer>
  )
}
