import Image from 'next/image'
import { cn } from '@/lib/utils'

export function PhoneMockup({
  src,
  alt,
  className,
  priority,
}: {
  src: string
  alt: string
  className?: string
  priority?: boolean
}) {
  return (
    <div
      className={cn(
        'relative mx-auto w-full max-w-[300px] overflow-hidden rounded-[2.25rem] border-[6px] border-ink bg-ink shadow-2xl shadow-black/20',
        className,
      )}
    >
      <div className="relative aspect-[9/19] w-full overflow-hidden rounded-[1.75rem] bg-white">
        <Image
          src={src || '/placeholder.svg'}
          alt={alt}
          fill
          priority={priority}
          sizes="300px"
          className="object-cover object-top"
        />
      </div>
    </div>
  )
}
