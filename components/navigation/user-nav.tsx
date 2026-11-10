'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { User, UserPlus, ChevronDown } from 'lucide-react'
import { UserAvatar } from '@/components/navigation/user-avatar'
import { UserMenuContent, displayName } from '@/components/navigation/user-menu-content'
import type { NavProfile, NavUser, WalletNavProps } from '@/components/navigation/user-nav-types'
import { useMounted } from '@/hooks/use-mounted'
import { useI18n } from '@/lib/i18n/provider'
export type { NavProfile, NavUser, WalletNavProps } from '@/components/navigation/user-nav-types'
export { localizedUserType } from '@/components/navigation/user-avatar'

interface UserNavProps {
  user: NavUser | null
  profile: NavProfile | null
  onLogout: () => void | Promise<void>
  wallet?: WalletNavProps
  variant: 'desktop' | 'mobile'
}

export function UserNav({ user, profile, onLogout, wallet, variant }: UserNavProps) {
  const { t } = useI18n()
  const mounted = useMounted()

  if (!user) {
    if (variant === 'desktop') {
      const accountTrigger = (
        <Button variant="ghost" size="sm" className="gap-2" type="button">
          <User className="h-4 w-4" aria-hidden />
          {t('nav.account')}
        </Button>
      )
      if (!mounted) {
        return accountTrigger
      }
      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>{accountTrigger}</DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuItem asChild>
              <Link href="/auth/login" className="cursor-pointer">
                <User className="mr-2 h-4 w-4" aria-hidden />
                {t('nav.login')}
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/auth/sign-up" className="cursor-pointer">
                <UserPlus className="mr-2 h-4 w-4" aria-hidden />
                {t('nav.signUp')}
              </Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )
    }
    return (
      <div className="mt-4 flex flex-col gap-2">
        <Button variant="outline" asChild>
          <Link href="/auth/login">{t('nav.login')}</Link>
        </Button>
        <Button asChild>
          <Link href="/auth/sign-up">{t('nav.getStarted')}</Link>
        </Button>
      </div>
    )
  }

  const name = displayName(profile, user.email)
  const shortName = name.split(' ')[0] || name

  if (variant === 'desktop') {
    const userTrigger = (
      <Button
        variant="ghost"
        size="sm"
        type="button"
        className="h-10 gap-2 rounded-full pl-1 pr-2 hover:bg-muted/60"
      >
        <UserAvatar
          name={name || '?'}
          userType={profile?.user_type}
          avatarUrl={profile?.avatar_url}
          size="sm"
        />
        <span className="max-w-[7rem] truncate text-sm font-medium hidden sm:inline">
          {shortName}
        </span>
        <ChevronDown className="h-3.5 w-3.5 text-muted-foreground opacity-70" aria-hidden />
      </Button>
    )
    if (!mounted) {
      return userTrigger
    }
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>{userTrigger}</DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          className="w-[22rem] max-h-[min(32rem,var(--radix-dropdown-menu-content-available-height))] overflow-y-auto p-0"
          sideOffset={8}
        >
          <UserMenuContent
            user={user}
            profile={profile}
            wallet={wallet}
            onLogout={onLogout}
            variant="dropdown"
          />
        </DropdownMenuContent>
      </DropdownMenu>
    )
  }

  return (
    <UserMenuContent
      user={user}
      profile={profile}
      wallet={wallet}
      onLogout={onLogout}
      variant="mobile"
    />
  )
}
