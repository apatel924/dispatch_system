import { SectionHeading } from '@/components/site/section-heading'
import { FaqAccordion } from '@/components/site/faq-accordion'
import { MagneticButton } from '@/components/site/magnetic-button'
import { faqs } from '@/data/content'

export function FaqSection() {
  return (
    <section className="bg-background py-20 lg:py-28">
      <div className="mx-auto grid max-w-7xl gap-12 px-4 sm:px-6 lg:grid-cols-[0.9fr_1.1fr] lg:px-8">
        <div className="lg:sticky lg:top-28 lg:self-start">
          <SectionHeading
            eyebrow="Questions"
            title="Frequently asked questions"
            description="Everything you need to know about delivering with Quick-Run Express in Edmonton."
          />
          <div className="mt-8">
            <MagneticButton href="/main-website/contact" variant="primary">
              Still have questions?
            </MagneticButton>
          </div>
        </div>
        <FaqAccordion items={faqs} />
      </div>
    </section>
  )
}
