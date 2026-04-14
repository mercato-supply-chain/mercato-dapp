import { cn } from '@/lib/utils'

type MercatoLogoProps = {
  className?: string
}

/** Brand mark from `/mercato.svg`. Use next to visible “MERCATO” text; decorative when that text is present. */
export function MercatoLogo({ className }: MercatoLogoProps) {
  return (
    <img
      src="/mercato.svg"
      alt=""
      aria-hidden
      className={cn('h-5 w-auto max-w-full object-contain', className)}
    />
  )
}
