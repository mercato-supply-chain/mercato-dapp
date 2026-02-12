'use client'

import { useEffect, useState, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useWallet } from '@/hooks/use-wallet'
import { ThemeToggle } from '@/components/theme-toggle'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'
import { Package, Menu } from 'lucide-react'
import { NavLinks } from '@/components/navigation/nav-links'
import { WalletNav } from '@/components/navigation/wallet-nav'
import { UserNav, type NavProfile, type NavUser } from '@/components/navigation/user-nav'

export function Navigation() {
  const router = useRouter()
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
    <header className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <div className="flex items-center gap-8">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
              <Package className="h-5 w-5 text-primary-foreground" aria-hidden />
            </div>
            <span className="text-xl font-semibold tracking-tight">MERCATO</span>
          </Link>
          <NavLinks variant="desktop" />
        </div>

        <div className="flex items-center gap-4">
          <div className="hidden items-center gap-3 md:flex">
            <ThemeToggle />
            <WalletNav
              variant="desktop"
              isConnected={isConnected}
              address={walletInfo?.address}
              truncatedAddress={truncatedAddress}
              onConnect={handleConnect}
              onDisconnect={handleDisconnect}
            />
            <UserNav
              variant="desktop"
              user={user}
              profile={profile}
              onLogout={handleLogout}
            />
          </div>

          <div className="flex items-center gap-2 md:hidden">
            <ThemeToggle />
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="Open menu">
                  <Menu className="h-5 w-5" aria-hidden />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[300px] overscroll-contain">
                <nav className="flex flex-col gap-4" aria-label="Main">
                  <NavLinks variant="mobile" />
                  <div className="my-2 border-t border-border" />
                  <WalletNav
                    variant="mobile"
                    isConnected={isConnected}
                    address={walletInfo?.address}
                    truncatedAddress={truncatedAddress}
                    onConnect={handleConnect}
                    onDisconnect={handleDisconnect}
                  />
                  <UserNav
                    variant="mobile"
                    user={user}
                    profile={profile}
                    onLogout={handleLogout}
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
