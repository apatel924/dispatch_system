import Image from 'next/image'
import { cn } from '@/lib/utils'

type Props = {
  src: string
  alt: string
  label?: string
  url?: string
  className?: string
  priority?: boolean
}

export function BrowserMockup({
  src,
  alt,
  label,
  url = 'app.quickrunexpress.ca',
  className,
  priority,
}: Props) {
  return (
    <div
      className={cn(
        'overflow-hidden rounded-xl border border-border bg-card shadow-xl shadow-black/5 ring-1 ring-black/5',
        className,
      )}
    >
      <div className="flex items-center gap-2 border-b border-border bg-muted/60 px-4 py-3">
        <span className="size-3 rounded-full bg-border" />
        <span className="size-3 rounded-full bg-border" />
        <span className="size-3 rounded-full bg-border" />
        <div className="ml-3 flex-1">
          <div className="inline-flex max-w-full items-center rounded-md bg-background px-3 py-1 font-mono text-[11px] text-muted-foreground">
            {url}
          </div>
        </div>
      </div>
      <div className="relative aspect-[16/10] w-full">
        <Image
          src={src || '/placeholder.svg'}
          alt={alt}
          fill
          priority={priority}
          sizes="(max-width: 1024px) 100vw, 60vw"
          className="object-cover object-top"
        />
        {label && (
          <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-ink/80 to-transparent p-4">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground">
              {label}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
