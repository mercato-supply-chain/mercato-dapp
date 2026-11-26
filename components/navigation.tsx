'use client'

import { useState, useCallback, useSyncExternalStore } from 'react'
import { cn } from '@/lib/utils'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { signOutApp } from '@/lib/auth/sign-out-app'
import { useOptionalWallet } from '@/hooks/use-wallet'
import { ThemeToggle } from '@/components/theme-toggle'
import { Button } from '@/components/ui/button'
import { MobileNavSheet } from '@/components/navigation/mobile-nav-sheet'
import { MercatoLogo } from '@/components/mercato-logo'
import { NavLinks } from '@/components/navigation/nav-links'
import { PublicNavLinks } from '@/components/navigation/public-nav-links'
import { UserNav } from '@/components/navigation/user-nav'
import { NotificationDropdown } from '@/components/notifications/notification-dropdown'
import { LanguageSwitcher } from '@/components/language-switcher'
import { useI18n } from '@/lib/i18n/provider'
import { useNavAuth } from '@/components/providers/nav-auth-provider'

const NAV_HEIGHT_PX = 64

export function Navigation({ overHero = false }: { overHero?: boolean } = {}) {
  const router = useRouter()
  const { t } = useI18n()
  const { user, profile, ready: authReady, clear: clearNavAuth } = useNavAuth()
  const [mobileOpen, setMobileOpen] = useState(false)

  const subscribeScroll = useCallback(
    (onStoreChange: () => void) => {
      if (overHero) return () => {}
      window.addEventListener('scroll', onStoreChange, { passive: true })
      return () => window.removeEventListener('scroll', onStoreChange)
    },
    [overHero],
  )
  const isScrolled = useSyncExternalStore(
    subscribeScroll,
    () => (overHero ? true : window.scrollY > 8),
    () => overHero,
  )

  const wallet = useOptionalWallet()

  const handleLogout = async () => {
    clearNavAuth()
    const disconnectSignsOutApp = wallet?.provider === 'pollar'
    if (wallet) {
      try {
        await wallet.handleDisconnect()
      } catch (e) {
        console.error('[Navigation] wallet disconnect during logout failed', e)
      }
    }
    if (!disconnectSignsOutApp) {
      try {
        await signOutApp()
      } catch (e) {
        console.error('[Navigation] signOutApp failed', e)
      }
    }
    router.replace('/')
    router.refresh()
  }

  const isAuthenticated = authReady && !!user
  const closeMobile = () => setMobileOpen(false)
  const logoHref = isAuthenticated ? '/dashboard' : '/'
  const walletProps = wallet
    ? {
        isConnected: wallet.isConnected,
        address: wallet.walletInfo?.address,
        truncatedAddress: wallet.truncatedAddress,
        onConnect: wallet.handleConnect,
        onConnectPollar: wallet.connectPollarWallet,
        onDisconnect: wallet.handleDisconnect,
        provider: wallet.provider,
        status: wallet.status,
        isEmbedded: wallet.isEmbedded,
      }
    : undefined

  return (
    <>
      <header
        className={cn(
          'fixed inset-x-0 top-0 z-50 w-full',
          'transition-[background-color,box-shadow,border-color,backdrop-filter] duration-300 ease-out motion-reduce:transition-none',
          (overHero || isScrolled) && 'border-b',
          overHero || isScrolled
            ? 'border-border/60 bg-background shadow-[0_1px_3px_hsl(var(--foreground)/0.04)]'
            : 'border-transparent bg-transparent',
        )}
      >
      <div className="container mx-auto flex h-16 items-center justify-between gap-4 px-4">
        <div className="flex min-w-0 items-center gap-4 lg:gap-8">
          <Link
            href={logoHref}
            className="group flex shrink-0 items-center gap-2 rounded-md outline-offset-4 transition-[opacity,transform] duration-200 ease-out hover:opacity-90 active:scale-[0.98] motion-reduce:active:scale-100"
          >
            <MercatoLogo className="h-8 w-8 transition-transform duration-200 ease-out group-hover:scale-[1.03] motion-reduce:group-hover:scale-100" />
            <span className="text-xl font-semibold tracking-tight">{t('common.brand')}</span>
          </Link>
          {authReady &&
            (isAuthenticated ? (
              <NavLinks variant="desktop" />
            ) : (
              <PublicNavLinks variant="desktop" />
            ))}
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <LanguageSwitcher />
          <ThemeToggle />
          {isAuthenticated && <NotificationDropdown />}
          <div className="hidden items-center gap-2 md:flex md:gap-3">
            {authReady && !isAuthenticated && (
              <>
                <Button variant="ghost" size="sm" asChild>
                  <Link href="/auth/login">{t('nav.login')}</Link>
                </Button>
                <Button size="sm" asChild className="rounded-full px-5">
                  <Link href="/auth/sign-up">{t('nav.getStarted')}</Link>
                </Button>
              </>
            )}
            {authReady && isAuthenticated && (
              <UserNav
                variant="desktop"
                user={user}
                profile={profile}
                onLogout={handleLogout}
                wallet={walletProps}
              />
            )}
          </div>

          <div className={cn('flex items-center gap-1.5', isAuthenticated ? 'md:hidden' : 'xl:hidden')}>
            <MobileNavSheet
              open={mobileOpen}
              onOpenChange={setMobileOpen}
              menuLabel={t('nav.openMenu')}
            >
              <nav className="flex flex-col gap-4" aria-label={t('nav.main')}>
                {authReady &&
                  (isAuthenticated ? (
                    <NavLinks variant="mobile" onNavigate={closeMobile} />
                  ) : (
                    <PublicNavLinks variant="mobile" onNavigate={closeMobile} />
                  ))}
                <div className="my-2 border-t border-border" />
                <UserNav
                  variant="mobile"
                  user={authReady ? user : null}
                  profile={profile}
                  onLogout={handleLogout}
                  wallet={isAuthenticated ? walletProps : undefined}
                />
              </nav>
            </MobileNavSheet>
          </div>
        </div>
      </div>
    </header>
      <div className="shrink-0" style={{ height: NAV_HEIGHT_PX }} aria-hidden />
    </>
  )
}
