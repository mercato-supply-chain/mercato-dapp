'use client'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Wallet, Copy, ExternalLink, Unplug } from 'lucide-react'
import { toast } from 'sonner'

const EXPLORER_NETWORK =
  process.env.NEXT_PUBLIC_TRUSTLESS_NETWORK === 'mainnet' ? 'public' : 'testnet'

interface WalletNavProps {
  isConnected: boolean
  address: string | undefined
  truncatedAddress: string | null
  onConnect: () => void
  onDisconnect: () => void
  /** Desktop: dropdown. Mobile: inline block. */
  variant: 'desktop' | 'mobile'
}

export function WalletNav({
  isConnected,
  address,
  truncatedAddress,
  onConnect,
  onDisconnect,
  variant,
}: WalletNavProps) {
  const copyAddress = () => {
    if (address) {
      navigator.clipboard.writeText(address)
      toast.success('Wallet address copied')
    }
  }

  if (variant === 'desktop') {
    if (isConnected && address) {
      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="gap-2 font-mono tabular-nums"
            >
              <Wallet className="h-4 w-4" aria-hidden />
              {truncatedAddress}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium leading-none">Stellar Wallet</p>
                <p className="text-xs leading-none text-muted-foreground font-mono break-all">
                  {address}
                </p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={copyAddress} className="cursor-pointer">
              <Copy className="mr-2 h-4 w-4" aria-hidden />
              Copy Address
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <a
                href={`https://stellar.expert/explorer/${EXPLORER_NETWORK}/account/${address}`}
                target="_blank"
                rel="noopener noreferrer"
                className="cursor-pointer"
              >
                <ExternalLink className="mr-2 h-4 w-4" aria-hidden />
                View on Explorer
              </a>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={onDisconnect}
              className="cursor-pointer text-destructive focus:text-destructive"
            >
              <Unplug className="mr-2 h-4 w-4" aria-hidden />
              Disconnect
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )
    }
    return (
      <Button variant="outline" size="sm" className="gap-2" onClick={onConnect}>
        <Wallet className="h-4 w-4" aria-hidden />
        Connect Wallet
      </Button>
    )
  }

  // Mobile
  if (isConnected && address) {
    return (
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2 px-2 py-1.5">
          <Wallet className="h-4 w-4 text-primary" aria-hidden />
          <span className="text-sm font-medium">Wallet Connected</span>
        </div>
        <p className="px-2 text-xs text-muted-foreground font-mono break-all">
          {address}
        </p>
        <div className="flex gap-2 px-2">
          <Button
            variant="outline"
            size="sm"
            className="flex-1 gap-1"
            onClick={copyAddress}
          >
            <Copy className="h-3 w-3" aria-hidden />
            Copy
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="flex-1 gap-1 text-destructive hover:text-destructive"
            onClick={onDisconnect}
          >
            <Unplug className="h-3 w-3" aria-hidden />
            Disconnect
          </Button>
        </div>
      </div>
    )
  }
  return (
    <Button variant="outline" size="sm" className="gap-2" onClick={onConnect}>
      <Wallet className="h-4 w-4" aria-hidden />
      Connect Wallet
    </Button>
  )
}
