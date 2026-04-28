'use client'

import { useEffect, useState, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useWallet } from '@/hooks/use-wallet'
import { ThemeToggle } from '@/components/theme-toggle'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'
import { Menu } from 'lucide-react'
import { MercatoLogo } from '@/components/mercato-logo'
import { NavLinks } from '@/components/navigation/nav-links'
import { UserNav, type NavProfile, type NavUser } from '@/components/navigation/user-nav'
import { NotificationDropdown } from '@/components/notifications/notification-dropdown'
import { LanguageSwitcher } from '@/components/language-switcher'
import { useI18n } from '@/lib/i18n/provider'

export function Navigation() {
  const router = useRouter()
  const { t } = useI18n()
  const supabase = useMemo(() => createClient(), [])
  const [user, setUser] = useState<NavUser | null>(null)
  const [profile, setProfile] = useState<NavProfile | null>(null)
  const {
    walletInfo,
    isConnected,
    truncatedAddress,
    handleConnect,
    handleDisconnect,
  } = useWallet()

  useEffect(() => {
    const init = async () => {
      const { data: { user: u } } = await supabase.auth.getUser()
      setUser(u)
      if (u) {
        const { data: p } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', u.id)
          .single()
        setProfile(p)
      }
    }
    init()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        const newUser = session?.user ?? null
        setUser(newUser)
        if (newUser) {
          supabase
            .from('profiles')
            .select('*')
            .eq('id', newUser.id)
            .single()
            .then(({ data }) => setProfile(data))
        } else {
          setProfile(null)
        }
      }
    )
    return () => subscription.unsubscribe()
  }, [supabase])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/')
    router.refresh()
  }

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur transition-[box-shadow,background-color] duration-200 ease-out supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <div className="flex items-center gap-8">
          <Link
            href="/"
            className="group flex items-center gap-2 rounded-md outline-offset-4 transition-[opacity,transform] duration-200 ease-out hover:opacity-90 active:scale-[0.98] motion-reduce:active:scale-100"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary transition-transform duration-200 ease-out group-hover:scale-[1.03] motion-reduce:group-hover:scale-100">
              <MercatoLogo className="h-5" />
            </div>
            <span className="text-xl font-semibold tracking-tight">MERCATO</span>
          </Link>
          <NavLinks variant="desktop" />
        </div>

        <div className="flex items-center gap-4">
          <div className="hidden items-center gap-3 md:flex">
            <LanguageSwitcher />
            <ThemeToggle />
            {user?.id && <NotificationDropdown userId={user.id} variant="desktop" />}
            <UserNav
              variant="desktop"
              user={user}
              profile={profile}
              onLogout={handleLogout}
              wallet={{
                isConnected,
                address: walletInfo?.address,
                truncatedAddress,
                onConnect: handleConnect,
                onDisconnect: handleDisconnect,
              }}
            />
          </div>

          <div className="flex items-center gap-2 md:hidden">
            <LanguageSwitcher />
            <ThemeToggle />
            {user?.id && <NotificationDropdown userId={user.id} variant="mobile" />}
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" aria-label={t('nav.openMenu')}>
                  <Menu className="h-5 w-5" aria-hidden />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[300px] overscroll-contain">
                <nav className="flex flex-col gap-4" aria-label={t('nav.main')}>
                  <NavLinks variant="mobile" />
                  <div className="my-2 border-t border-border" />
                  <UserNav
                    variant="mobile"
                    user={user}
                    profile={profile}
                    onLogout={handleLogout}
                    wallet={{
                      isConnected,
                      address: walletInfo?.address,
                      truncatedAddress,
                      onConnect: handleConnect,
                      onDisconnect: handleDisconnect,
                    }}
                  />
                </nav>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>
    </header>
  )
}
