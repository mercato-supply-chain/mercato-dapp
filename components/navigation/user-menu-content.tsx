'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import {
  Copy,
  ExternalLink,
  LayoutDashboard,
  LogOut,
  Settings,
  Unplug,
  Wallet,
  ChevronRight,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import { UserAvatar, localizedUserType } from '@/components/navigation/user-avatar'
import type { NavProfile, NavUser, WalletNavProps } from '@/components/navigation/user-nav-types'
import { getRoleTheme } from '@/lib/dashboard/role-theme'
import {
  activeUserMenuGroupId,
  getUserMenu,
  isUserMenuItemActive,
  type UserMenuItem,
} from '@/lib/navigation/user-menu-model'
import { useI18n } from '@/lib/i18n/provider'
import { cn } from '@/lib/utils'

const EXPLORER_NETWORK =
  process.env.NEXT_PUBLIC_TRUSTLESS_NETWORK === 'mainnet' ? 'public' : 'testnet'

export function displayName(profile: NavProfile | null, email?: string) {
  return profile?.full_name || profile?.contact_name || profile?.company_name || email || ''
}

type UserMenuContentProps = {
  user: NavUser
  profile: NavProfile | null
  wallet?: WalletNavProps
  onLogout: () => void | Promise<void>
  /** Render as dropdown items (desktop) or plain links (mobile sheet) */
  variant: 'dropdown' | 'mobile'
  onNavigate?: () => void
}

export function UserMenuHeader({
  user,
  profile,
  className,
}: {
  user: NavUser
  profile: NavProfile | null
  className?: string
}) {
  const { t } = useI18n()
  const name = displayName(profile, user.email)
  const userType = profile?.user_type
  const theme = userType ? getRoleTheme(userType) : null

  return (
    <div className={cn('px-3 py-3', className)}>
      <div className="flex items-start gap-3">
        <UserAvatar
          name={name || user.email || '?'}
          userType={userType}
          avatarUrl={profile?.avatar_url}
          size="md"
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold leading-tight">{name || user.email}</p>
          <p className="truncate text-xs text-muted-foreground">{user.email}</p>
          {userType && (
            <span
              className={cn(
                'mt-2 inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1',
                theme?.badge,
              )}
            >
              {localizedUserType(userType, t)}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

function WalletSummary({
  wallet,
  variant,
  onNavigate,
}: {
  wallet: WalletNavProps
  variant: 'dropdown' | 'mobile'
  onNavigate?: () => void
}) {
  const { t } = useI18n()

  const walletLabel =
    wallet.provider === 'pollar' || wallet.isEmbedded
      ? t('wallet.labelPollarEmbedded')
      : t('wallet.labelStellar')

  const statusLabel =
    wallet.status === 'pending'
      ? t('wallet.statusPending')
      : wallet.status === 'active'
        ? t('wallet.statusActive')
        : null

  const copyAddress = () => {
    if (!wallet.address) return
    void navigator.clipboard.writeText(wallet.address)
    toast.success(t('wallet.addressCopied'))
  }

  if (variant === 'mobile') {
    return (
      <WalletSummaryMobile wallet={wallet} walletLabel={walletLabel} statusLabel={statusLabel} onNavigate={onNavigate} />
    )
  }

  return (
    <div className="mx-2 mb-1 rounded-xl border border-border/70 bg-muted/30 p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-muted-foreground">{walletLabel}</p>
        {wallet.isConnected && statusLabel && (
          <span
            className={cn(
              'rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase',
              wallet.status === 'active'
                ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
                : 'bg-amber-500/15 text-amber-800 dark:text-amber-400',
            )}
          >
            {statusLabel}
          </span>
        )}
      </div>

      {wallet.isConnected && wallet.address ? (
        <>
          <div className="flex items-center gap-1">
            <p className="min-w-0 flex-1 truncate font-mono text-xs text-foreground">
              {wallet.truncatedAddress ?? wallet.address}
            </p>
            <Button variant="outline" size="icon" className="h-7 w-7 shrink-0" onClick={copyAddress}>
              <Copy className="h-3 w-3" aria-hidden />
              <span className="sr-only">{t('wallet.copy')}</span>
            </Button>
            <Button variant="outline" size="icon" className="h-7 w-7 shrink-0" asChild>
              <a
                href={`https://stellar.expert/explorer/${EXPLORER_NETWORK}/account/${wallet.address}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <ExternalLink className="h-3 w-3" aria-hidden />
                <span className="sr-only">{t('userMenu.explorer')}</span>
              </a>
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7 shrink-0 text-destructive hover:text-destructive"
              onClick={wallet.onDisconnect}
            >
              <Unplug className="h-3 w-3" aria-hidden />
              <span className="sr-only">{t('wallet.disconnect')}</span>
            </Button>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="mt-1.5 h-7 w-full justify-between px-1 text-xs text-muted-foreground"
            asChild
            onClick={onNavigate}
          >
            <Link href="/dashboard/wallets">
              {t('userMenu.manageWallets')}
              <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </Button>
        </>
      ) : (
        <div className="space-y-1.5">
          <p className="text-xs text-muted-foreground">{t('userMenu.walletNotConnected')}</p>
          <Button variant="outline" size="sm" className="h-8 w-full text-xs" onClick={wallet.onConnect}>
            <Wallet className="mr-1.5 h-3.5 w-3.5" aria-hidden />
            {t('wallet.connectStellarMenu')}
          </Button>
          <Button variant="secondary" size="sm" className="h-8 w-full text-xs" onClick={wallet.onConnectPollar}>
            {t('wallet.continuePollarEmbedded')}
          </Button>
        </div>
      )}
    </div>
  )
}

function WalletSummaryMobile({
  wallet,
  walletLabel,
  statusLabel,
  onNavigate,
}: {
  wallet: WalletNavProps
  walletLabel: string
  statusLabel: string | null
  onNavigate?: () => void
}) {
  const { t } = useI18n()

  return (
    <div className="mx-2 mb-3 rounded-xl border border-border/70 bg-muted/30 p-3">
      <p className="text-xs font-medium text-muted-foreground">{walletLabel}</p>
      {wallet.isConnected && wallet.address ? (
        <>
          <p className="mt-1 font-mono text-xs break-all">{wallet.address}</p>
          {statusLabel && <p className="mt-1 text-[11px] text-muted-foreground">{statusLabel}</p>}
          <Link
            href="/dashboard/wallets"
            className="mt-2 flex items-center text-xs font-medium text-emerald-700 dark:text-emerald-400"
            onClick={onNavigate}
          >
            {t('userMenu.manageWallets')}
            <ChevronRight className="ml-0.5 h-3.5 w-3.5" />
          </Link>
        </>
      ) : (
        <div className="mt-2 flex flex-col gap-2">
          <Button variant="outline" size="sm" className="w-full justify-start" onClick={wallet.onConnect}>
            {t('wallet.connectStellarMenu')}
          </Button>
          <Button variant="secondary" size="sm" className="w-full justify-start" onClick={wallet.onConnectPollar}>
            {t('wallet.continuePollarEmbedded')}
          </Button>
        </div>
      )}
    </div>
  )
}

function MenuDestination({
  item,
  active,
  onNavigate,
  emphasize,
}: {
  item: UserMenuItem
  active: boolean
  onNavigate?: () => void
  emphasize?: boolean
}) {
  const { t } = useI18n()
  const Icon = item.icon
  const hint = item.hintKey ? t(item.hintKey) : null

  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      className={cn(
        'flex w-full items-start gap-2.5 rounded-lg px-2 py-2 text-left transition-colors',
        active
          ? 'bg-foreground/5 text-foreground'
          : 'text-foreground hover:bg-muted/60',
        emphasize && !active && 'bg-muted/40',
      )}
      aria-current={active ? 'page' : undefined}
    >
      <Icon className={cn('mt-0.5 h-4 w-4 shrink-0', active ? 'opacity-100' : 'opacity-70')} aria-hidden />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2 text-sm font-medium leading-tight">
          <span className="truncate">{t(item.labelKey)}</span>
          {active && <span className="ml-auto h-1.5 w-1.5 shrink-0 rounded-full bg-current" />}
        </span>
        {hint ? <span className="mt-0.5 block text-xs leading-snug text-muted-foreground">{hint}</span> : null}
      </span>
    </Link>
  )
}

function NavSections({
  userType,
  variant,
  onNavigate,
}: {
  userType: string
  variant: 'dropdown' | 'mobile'
  onNavigate?: () => void
}) {
  const { t } = useI18n()
  const pathname = usePathname()
  const menu = getUserMenu(userType)
  const suggestedGroupId = activeUserMenuGroupId(pathname, menu.groups)
  const [groupOverride, setGroupOverride] = useState<string | null>(null)
  const [seenPath, setSeenPath] = useState(pathname)
  if (pathname !== seenPath) {
    setSeenPath(pathname)
    setGroupOverride(null)
  }
  const groupId = groupOverride ?? suggestedGroupId
  const visibleGroups = menu.switchGroups
    ? menu.groups.filter((group) => group.id === groupId)
    : menu.groups
  const activeGroup = menu.groups.find((group) => group.id === groupId) ?? menu.groups[0]

  const switcher = menu.switchGroups ? (
    <div
      role="tablist"
      aria-label={t('userMenu.groupsLabel')}
      className="mx-2 mb-1 grid grid-cols-3 gap-1 rounded-lg bg-muted/60 p-1"
    >
      {menu.groups.map((group) => {
        const selected = group.id === activeGroup?.id
        return (
          <button
            key={group.id}
            type="button"
            role="tab"
            aria-selected={selected}
            className={cn(
              'rounded-md px-1.5 py-1.5 text-xs font-medium transition-colors',
              selected ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
            )}
            onClick={() => setGroupOverride(group.id)}
          >
            {t(group.titleKey)}
          </button>
        )
      })}
    </div>
  ) : null

  const lists = visibleGroups.map((group) => (
    <div key={group.id} className="px-2">
      {menu.switchGroups ? null : (
        <p className="mb-1 px-2 text-xs font-medium text-muted-foreground">{t(group.titleKey)}</p>
      )}
      <ul className="space-y-0.5">
        {group.items.map((item, index) => {
          const active = isUserMenuItemActive(pathname, item)
          const link = (
            <MenuDestination
              item={item}
              active={active}
              onNavigate={onNavigate}
              emphasize={!menu.switchGroups && index === 0}
            />
          )
          return (
            <li key={item.href}>
              {variant === 'dropdown' ? (
                <DropdownMenuItem asChild className="cursor-pointer p-0 focus:bg-transparent">
                  {link}
                </DropdownMenuItem>
              ) : (
                link
              )}
            </li>
          )
        })}
      </ul>
    </div>
  ))

  return (
    <div className="space-y-1">
      {switcher}
      {lists}
    </div>
  )
}

export function UserMenuContent({
  user,
  profile,
  wallet,
  onLogout,
  variant,
  onNavigate,
}: UserMenuContentProps) {
  const { t } = useI18n()
  const userType = profile?.user_type ?? 'pyme'

  if (variant === 'mobile') {
    return (
      <>
        <UserMenuHeader user={user} profile={profile} />
        {wallet && <WalletSummary wallet={wallet} variant="mobile" onNavigate={onNavigate} />}
        <div className="my-2 border-t border-border" />
        <NavSections userType={userType} variant="mobile" onNavigate={onNavigate} />
        <div className="my-2 border-t border-border" />
        <div className="flex flex-col gap-1 px-2 pb-2">
          <Link
            href="/dashboard"
            onClick={onNavigate}
            className="flex items-center gap-2 rounded-lg px-2 py-2 text-sm font-medium hover:bg-muted/60"
          >
            <LayoutDashboard className="h-4 w-4" aria-hidden />
            {t('nav.dashboard')}
          </Link>
          <Link
            href="/settings"
            onClick={onNavigate}
            className="flex items-center gap-2 rounded-lg px-2 py-2 text-sm font-medium hover:bg-muted/60"
          >
            <Settings className="h-4 w-4" aria-hidden />
            {t('nav.settings')}
          </Link>
          <Button
            type="button"
            variant="ghost"
            className="justify-start text-destructive hover:text-destructive"
            onClick={() => void onLogout()}
          >
            <LogOut className="mr-2 h-4 w-4" aria-hidden />
            {t('nav.logout')}
          </Button>
        </div>
      </>
    )
  }

  return (
    <>
      <UserMenuHeader user={user} profile={profile} />
      {wallet && (
        <>
          <DropdownMenuSeparator className="my-0" />
          <WalletSummary wallet={wallet} variant="dropdown" onNavigate={onNavigate} />
        </>
      )}
      <DropdownMenuSeparator className="my-1" />
      <NavSections userType={userType} variant="dropdown" onNavigate={onNavigate} />
      <DropdownMenuSeparator className="my-1" />
      <DropdownMenuGroup>
        <DropdownMenuItem asChild className="cursor-pointer">
          <Link href="/dashboard" className="flex items-center gap-2">
            <LayoutDashboard className="h-4 w-4" aria-hidden />
            {t('nav.dashboard')}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild className="cursor-pointer">
          <Link href="/settings" className="flex items-center gap-2">
            <Settings className="h-4 w-4" aria-hidden />
            {t('nav.settings')}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem
          className="cursor-pointer text-destructive focus:text-destructive"
          onSelect={() => void onLogout()}
        >
          <LogOut className="mr-2 h-4 w-4" aria-hidden />
          {t('nav.logout')}
        </DropdownMenuItem>
      </DropdownMenuGroup>
    </>
  )
}
