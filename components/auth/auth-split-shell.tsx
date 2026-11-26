import type { ReactNode } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { MercatoLogo } from '@/components/mercato-logo'
import { LanguageSwitcher } from '@/components/language-switcher'
import { ThemeToggle } from '@/components/theme-toggle'

export function AuthSplitShell({
  asideTitle,
  asideBody,
  children,
}: {
  asideTitle: string
  asideBody: string
  children: ReactNode
}) {
  return (
    <div className="grid min-h-screen lg:grid-cols-[minmax(0,1.05fr)_minmax(28rem,1fr)]">
      <aside className="relative hidden min-h-[16rem] overflow-hidden bg-[hsl(151_45%_12%)] lg:block">
        <Image
          src="/hero-photo.png"
          alt=""
          fill
          priority
          sizes="(min-width: 1024px) 52vw, 100vw"
          className="object-cover object-[58%_center]"
          aria-hidden
        />
        <div
          className="absolute inset-0 bg-gradient-to-t from-[hsl(151_45%_8%)] via-[hsl(151_45%_10%/0.55)] to-[hsl(151_45%_12%/0.25)]"
          aria-hidden
        />
        <div className="relative z-10 flex h-full min-h-screen flex-col justify-end px-10 pb-14 pt-10 xl:px-14">
          <p className="max-w-[18ch] font-display text-[clamp(2.25rem,4.2vw,3.75rem)] font-normal leading-[1.06] tracking-tight text-white text-balance">
            {asideTitle}
          </p>
          <p className="mt-5 max-w-sm text-base leading-relaxed text-white/75">{asideBody}</p>
        </div>
      </aside>

      <div className="relative flex min-h-screen flex-col overflow-y-auto bg-background">
        <div className="flex items-center justify-between px-5 py-4 sm:px-8">
          <Link
            href="/"
            className="flex items-center gap-2 text-lg tracking-tight text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-brand-mid">
              <MercatoLogo onBrand className="h-4" />
            </span>
            <span className="font-display text-xl">MERCATO</span>
          </Link>
          <div className="flex items-center gap-1">
            <LanguageSwitcher />
            <ThemeToggle />
          </div>
        </div>

        <div className="relative isolate overflow-hidden px-5 py-6 lg:hidden">
          <div className="absolute inset-0 bg-[hsl(151_45%_12%)]" aria-hidden />
          <Image
            src="/hero-photo.png"
            alt=""
            fill
            sizes="100vw"
            className="object-cover object-center opacity-50"
            aria-hidden
          />
          <div
            className="absolute inset-0 bg-gradient-to-t from-background via-[hsl(151_45%_10%/0.45)] to-[hsl(151_45%_10%/0.2)]"
            aria-hidden
          />
          <p className="relative z-10 max-w-[20ch] font-display text-3xl font-normal leading-[1.08] tracking-tight text-white">
            {asideTitle}
          </p>
        </div>

        <main id="main" tabIndex={-1} className="flex flex-1 flex-col justify-center px-5 pb-16 pt-4 sm:px-10 lg:px-16 xl:px-24">
          <div className="mx-auto w-full max-w-[26rem]">{children}</div>
        </main>
      </div>
    </div>
  )
}
