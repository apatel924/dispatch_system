import { cn } from '@/lib/utils'
import { Reveal } from '@/components/animations/reveal'

type Props = {
  eyebrow?: string
  title: string
  description?: string
  align?: 'left' | 'center'
  tone?: 'light' | 'dark'
  className?: string
}

export function SectionHeading({
  eyebrow,
  title,
  description,
  align = 'left',
  tone = 'light',
  className,
}: Props) {
  return (
    <div
      className={cn(
        'max-w-2xl',
        align === 'center' && 'mx-auto text-center',
        className,
      )}
    >
      {eyebrow && (
        <Reveal>
          <div
            className={cn(
              'mb-3 inline-flex items-center gap-2 font-mono text-xs font-medium uppercase tracking-widest',
              tone === 'dark' ? 'text-primary' : 'text-primary',
            )}
          >
            <span className="h-px w-6 bg-primary" />
            {eyebrow}
          </div>
        </Reveal>
      )}
      <Reveal delay={0.05}>
        <h2
          className={cn(
            'text-balance text-3xl font-bold uppercase leading-[0.95] tracking-tight sm:text-4xl lg:text-5xl',
            tone === 'dark' ? 'text-white' : 'text-foreground',
          )}
        >
          {title}
        </h2>
      </Reveal>
      {description && (
        <Reveal delay={0.1}>
          <p
            className={cn(
              'mt-4 text-pretty text-base leading-relaxed sm:text-lg',
              tone === 'dark' ? 'text-white/70' : 'text-muted-foreground',
            )}
          >
            {description}
          </p>
        </Reveal>
      )}
    </div>
  )
}
