import Image from 'next/image'
import { cn } from '@/lib/utils'
import { images } from '@/lib/images'

export function Logo({
  collapsed = false,
  className,
}: {
  collapsed?: boolean
  className?: string
}) {
  return (
    <div className={cn('flex items-center justify-center', className)}>
      <Image
        src={images.brand.logo}
        alt="Quick-Run Express"
        width={180}
        height={56}
        className={cn(
          'object-contain transition-all duration-300',
          collapsed ? 'h-9 w-9' : 'h-14 w-auto max-w-[180px]',
        )}
        style={{
          width: 'auto',
          height: 'auto',
          ...(collapsed ? { objectPosition: 'left center' } : {}),
        }}
        priority
      />
    </div>
  )
}
