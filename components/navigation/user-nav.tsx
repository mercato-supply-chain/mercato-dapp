'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Package,
  TrendingUp,
  User,
  UserPlus,
  LogOut,
  Settings,
  LayoutDashboard,
  Plus,
  DollarSign,
  CheckCircle2,
  ShieldCheck,
  Wallet,
  Copy,
  ExternalLink,
  Unplug,
} from 'lucide-react'
import { toast } from 'sonner'

const EXPLORER_NETWORK =
  process.env.NEXT_PUBLIC_TRUSTLESS_NETWORK === 'mainnet' ? 'public' : 'testnet'

export interface NavProfile {
  full_name?: string
  contact_name?: string
  company_name?: string
  user_type?: string
}

export interface NavUser {
  id: string
  email?: string
}

export interface WalletNavProps {
  isConnected: boolean
  address: string | undefined
  truncatedAddress: string | null
  onConnect: () => void
  onDisconnect: () => void
}

interface UserNavProps {
  user: NavUser | null
  profile: NavProfile | null
  onLogout: () => void
  /** Wallet state and handlers; when provided, wallet is shown inside the user menu */
  wallet?: WalletNavProps
  /** Desktop: dropdown. Mobile: vertical links. */
  variant: 'desktop' | 'mobile'
}

const displayName = (profile: NavProfile | null, email?: string) =>
  profile?.full_name || profile?.contact_name || profile?.company_name || email

export function UserNav({ user, profile, onLogout, wallet, variant }: UserNavProps) {
  const copyAddress = () => {
    if (wallet?.address) {
      navigator.clipboard.writeText(wallet.address)
      toast.success('Wallet address copied')
    }
  }

  if (!user) {
    if (variant === 'desktop') {
      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="gap-2">
              <User className="h-4 w-4" aria-hidden />
              Account
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuItem asChild>
              <Link href="/auth/login" className="cursor-pointer">
                <User className="mr-2 h-4 w-4" aria-hidden />
                Login
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/auth/sign-up" className="cursor-pointer">
              <UserPlus className="mr-2 h-4 w-4" aria-hidden />
                Sign up
              </Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )
    }
    return (
      <div className="mt-4 flex flex-col gap-2">
        <Button variant="outline" asChild>
          <Link href="/auth/login">Login</Link>
        </Button>
        <Button asChild>
          <Link href="/auth/sign-up">Get Started</Link>
        </Button>
      </div>
    )
  }

  const name = displayName(profile, user.email)
  const userType = profile?.user_type

  if (variant === 'desktop') {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="gap-2">
            <User className="h-4 w-4" aria-hidden />
            {name}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>
            <div className="flex flex-col space-y-1">
              <p className="text-sm font-medium leading-none">
                {profile?.full_name || profile?.contact_name || profile?.company_name}
              </p>
              <p className="text-xs leading-none text-muted-foreground">
                {user.email}
              </p>
              {userType && (
                <p className="text-xs leading-none text-muted-foreground capitalize">
                  {userType}
                </p>
              )}
            </div>
          </DropdownMenuLabel>
          {wallet && (
            <>
              <DropdownMenuSeparator />
              {wallet.isConnected && wallet.address ? (
                <>
                  <DropdownMenuLabel>
                    <p className="text-xs font-medium leading-none text-muted-foreground">
                      Stellar Wallet
                    </p>
                    <p className="mt-0.5 text-xs font-mono break-all">
                      {wallet.address}
                    </p>
                  </DropdownMenuLabel>
                  <DropdownMenuItem onClick={copyAddress} className="cursor-pointer">
                    <Copy className="mr-2 h-4 w-4" aria-hidden />
                    Copy Address
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <a
                      href={`https://stellar.expert/explorer/${EXPLORER_NETWORK}/account/${wallet.address}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="cursor-pointer"
                    >
                      <ExternalLink className="mr-2 h-4 w-4" aria-hidden />
                      View on Explorer
                    </a>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={wallet.onDisconnect}
                    className="cursor-pointer text-destructive focus:text-destructive"
                  >
                    <Unplug className="mr-2 h-4 w-4" aria-hidden />
                    Disconnect Wallet
                  </DropdownMenuItem>
                </>
              ) : (
                <DropdownMenuItem onClick={wallet.onConnect} className="cursor-pointer">
                  <Wallet className="mr-2 h-4 w-4" aria-hidden />
                  Connect Wallet
                </DropdownMenuItem>
              )}
            </>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link href="/dashboard" className="cursor-pointer">
              <LayoutDashboard className="mr-2 h-4 w-4" aria-hidden />
              Dashboard
            </Link>
          </DropdownMenuItem>
          {userType === 'admin' && (
            <DropdownMenuItem asChild>
              <Link href="/dashboard/admin" className="cursor-pointer">
                <ShieldCheck className="mr-2 h-4 w-4" aria-hidden />
                Milestone approvals
              </Link>
            </DropdownMenuItem>
          )}
          {userType === 'pyme' && (
            <>
              <DropdownMenuItem asChild>
                <Link href="/create-deal" className="cursor-pointer">
                  <Plus className="mr-2 h-4 w-4" aria-hidden />
                  Create Deal
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/marketplace?filter=funded" className="cursor-pointer">
                  <TrendingUp className="mr-2 h-4 w-4" aria-hidden />
                  Browse Investors
                </Link>
              </DropdownMenuItem>
            </>
          )}
          {userType === 'investor' && (
            <>
              <DropdownMenuItem asChild>
                <Link href="/marketplace" className="cursor-pointer">
                  <Package className="mr-2 h-4 w-4" aria-hidden />
                  Browse Deals
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/dashboard/investments" className="cursor-pointer">
                  <DollarSign className="mr-2 h-4 w-4" aria-hidden />
                  My Investments
                </Link>
              </DropdownMenuItem>
            </>
          )}
          {userType === 'supplier' && (
            <>
              <DropdownMenuItem asChild>
                <Link href="/dashboard/supplier-profile" className="cursor-pointer">
                  <Package className="mr-2 h-4 w-4" aria-hidden />
                  Products & Categories
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/dashboard/deals" className="cursor-pointer">
                  <TrendingUp className="mr-2 h-4 w-4" aria-hidden />
                  Active Deals
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/dashboard/deliveries" className="cursor-pointer">
                  <CheckCircle2 className="mr-2 h-4 w-4" aria-hidden />
                  Delivery Proof
                </Link>
              </DropdownMenuItem>
            </>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link href="/settings" className="cursor-pointer">
              <Settings className="mr-2 h-4 w-4" aria-hidden />
              Settings
            </Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={onLogout} className="cursor-pointer">
            <LogOut className="mr-2 h-4 w-4" aria-hidden />
            Log out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    )
  }

  // Mobile: vertical list
  const linkClass = 'flex items-center gap-2 text-sm font-medium'
  return (
    <>
      <div className="my-2 border-t border-border" />
      <div className="px-2 py-1.5">
        <p className="text-sm font-medium">{displayName(profile, user.email)}</p>
        <p className="text-xs text-muted-foreground">{user.email}</p>
      </div>
      {wallet && (
        <>
          <div className="my-2 border-t border-border" />
          {wallet.isConnected && wallet.address ? (
            <div className="flex flex-col gap-2 px-2">
              <p className="text-xs font-medium text-muted-foreground">Stellar Wallet</p>
              <p className="text-xs font-mono break-all">{wallet.address}</p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={copyAddress}>
                  <Copy className="mr-2 h-3 w-3" aria-hidden />
                  Copy
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                  onClick={wallet.onDisconnect}
                >
                  <Unplug className="mr-2 h-3 w-3" aria-hidden />
                  Disconnect
                </Button>
              </div>
            </div>
          ) : (
            <Button variant="outline" size="sm" className="gap-2 justify-start w-full" onClick={wallet.onConnect}>
              <Wallet className="h-4 w-4" aria-hidden />
              Connect Wallet
            </Button>
          )}
        </>
      )}
      <Link href="/dashboard" className={linkClass}>
        <LayoutDashboard className="h-4 w-4" aria-hidden />
        Dashboard
      </Link>
      {userType === 'admin' && (
        <Link href="/dashboard/admin" className={linkClass}>
          <ShieldCheck className="h-4 w-4" aria-hidden />
          Milestone approvals
        </Link>
      )}
      {userType === 'pyme' && (
        <>
          <Link href="/create-deal" className={linkClass}>
            <Plus className="h-4 w-4" aria-hidden />
            Create Deal
          </Link>
          <Link href="/marketplace?filter=funded" className={linkClass}>
            <TrendingUp className="h-4 w-4" aria-hidden />
            Browse Investors
          </Link>
        </>
      )}
      {userType === 'investor' && (
        <>
          <Link href="/marketplace" className={linkClass}>
            <Package className="h-4 w-4" aria-hidden />
            Browse Deals
          </Link>
          <Link href="/dashboard/investments" className={linkClass}>
            <DollarSign className="h-4 w-4" aria-hidden />
            My Investments
          </Link>
        </>
      )}
      {userType === 'supplier' && (
        <>
          <Link href="/dashboard/supplier-profile" className={linkClass}>
            <Package className="h-4 w-4" aria-hidden />
            Products & Categories
          </Link>
          <Link href="/dashboard/deals" className={linkClass}>
            <TrendingUp className="h-4 w-4" aria-hidden />
            Active Deals
          </Link>
          <Link href="/dashboard/deliveries" className={linkClass}>
            <CheckCircle2 className="h-4 w-4" aria-hidden />
            Delivery Proof
          </Link>
        </>
      )}
      <Link href="/settings" className={linkClass}>
        <Settings className="h-4 w-4" aria-hidden />
        Settings
      </Link>
      <Button variant="ghost" className="justify-start" onClick={onLogout}>
        <LogOut className="mr-2 h-4 w-4" aria-hidden />
        Log out
      </Button>
    </>
  )
}
