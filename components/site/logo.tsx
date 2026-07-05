import Image from 'next/image'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { images } from '@/lib/images'

export function Logo({
  className,
  priority = false,
}: {
  className?: string
  priority?: boolean
}) {
  return (
    <Link
      href="/main-website"
      className={cn('inline-flex items-center', className)}
      aria-label="Quick-Run Express — home"
    >
      <Image
        src={images.brand.logo}
        alt="Quick-Run Express"
        width={220}
        height={150}
        priority={priority}
        className="h-full w-auto object-contain"
        style={{ width: 'auto', height: 'auto' }}
      />
    </Link>
  )
}
