'use client'

import { useCallback, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { AlertCircle, Landmark, Loader2 } from 'lucide-react'
import { signTransaction } from '@/lib/trustless/wallet-kit'
import { useWallet } from '@/hooks/use-wallet'
import { PollarWalletKitLimitations } from '@/lib/mercato-wallet'
import type { SendTransactionResponse } from '@defindex/sdk'

const PLACEHOLDER = `{
  "caller": "G…your-signing-address",
  "name": "Mercato Vault",
  "symbol": "mVLT",
  "vaultFeeBps": 100,
  "upgradable": true,
  "roles": {
    "emergencyManager": "G…",
    "feeReceiver": "G…",
    "manager": "G…",
    "rebalanceManager": "G…"
  },
  "assets": [
    {
      "address": "C…soroban-asset-contract",
      "strategies": [
        { "address": "C…strategy", "name": "Strategy label", "paused": false }
      ]
    }
  ]
}`

async function readErrorMessage(response: Response): Promise<string> {
  try {
    const data = (await response.json()) as { error?: unknown }
    if (typeof data?.error === 'string' && data.error) return data.error
  } catch {
    /* ignore */
  }
  return `Request failed (${response.status})`
}

type Props = {
  configuredVaultAddress: string
}

export function AdminDefindexVaultPanel({ configuredVaultAddress }: Props) {
  const { walletInfo, canSignTransactions } = useWallet()
  const [jsonText, setJsonText] = useState('')
  const [busy, setBusy] = useState(false)

  const hasVaultEnv = Boolean(configuredVaultAddress.trim())

  const signAndSubmit = useCallback(
    async (unsignedXdr: string, signerAddress: string): Promise<SendTransactionResponse> => {
      const signedXdr = await signTransaction({
        unsignedTransaction: unsignedXdr,
        address: signerAddress,
      })

      const submitResponse = await fetch('/api/defindex/submit', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ xdr: signedXdr }),
      })

      if (!submitResponse.ok) {
        throw new Error(await readErrorMessage(submitResponse))
      }

      return (await submitResponse.json()) as SendTransactionResponse
    },
    []
  )

  const onBuildAndSubmit = useCallback(async () => {
    const address = walletInfo?.address?.trim()
    if (!address) {
      toast.error('Connect your admin wallet first (Freighter / Albedo).')
      return
    }
    if (!canSignTransactions) {
      toast.error(PollarWalletKitLimitations)
      return
    }

    let config: Record<string, unknown>
    try {
      const parsed = JSON.parse(jsonText || '{}')
      config = (
        parsed && typeof parsed === 'object' && 'config' in parsed
          ? (parsed as { config: Record<string, unknown> }).config
          : parsed
      ) as Record<string, unknown>
    } catch {
      toast.error('Invalid JSON. Fix the payload and try again.')
      return
    }

    const existingCaller =
      typeof config.caller === 'string' ? config.caller.trim() : ''
    if (existingCaller && existingCaller !== address) {
      toast.error('JSON `caller` must match your connected wallet address.')
      return
    }
    if (!existingCaller) {
      config.caller = address
    }

    setBusy(true)
    try {
      const res = await fetch('/api/defindex/admin/create-vault', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      })

      if (!res.ok) {
        throw new Error(await readErrorMessage(res))
      }

      const { xdr } = (await res.json()) as { xdr: string }
      if (!xdr) {
        throw new Error('No XDR returned from DeFindex.')
      }

      const submitted = await signAndSubmit(xdr, address)
      if (submitted?.success === false) {
        toast.error('Transaction was not successful on-chain.')
        return
      }

      toast.success('Vault creation submitted.', {
        description: submitted?.txHash ? `Hash: ${submitted.txHash}` : undefined,
      })
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Vault creation failed.')
    } finally {
      setBusy(false)
    }
  }, [canSignTransactions, jsonText, signAndSubmit, walletInfo?.address])

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Landmark className="h-4 w-4" aria-hidden />
          Mercato DeFindex vault (admin)
        </CardTitle>
        <CardDescription>
          Only admins can request vault-creation XDRs. Paste a full{' '}
          <code className="text-xs">CreateVaultParams</code> JSON (see{' '}
          <a
            className="underline underline-offset-2"
            href="https://docs.defindex.io"
            target="_blank"
            rel="noreferrer"
          >
            DeFindex docs
          </a>
          ) — <code className="text-xs">caller</code> defaults to your connected wallet if omitted. After deployment, set{' '}
          <code className="text-xs">NEXT_PUBLIC_DEFINDEX_VAULT_ADDRESS</code> to the new vault <code className="text-xs">C…</code>{' '}
          contract.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-md border bg-muted/30 px-3 py-2 text-xs">
          <p className="font-medium text-foreground">Configured vault (env)</p>
          <p className="mt-1 break-all font-mono text-muted-foreground">
            {hasVaultEnv ? configuredVaultAddress : '— none — investors see setup instructions until this is set'}
          </p>
        </div>

        {!canSignTransactions && walletInfo?.address && (
          <div className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/5 px-3 py-2 text-xs text-amber-800 dark:text-amber-200">
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>Use a Stellar Wallets Kit wallet to sign vault deployment.</span>
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="create-vault-json">Create vault parameters (JSON)</Label>
          <Textarea
            id="create-vault-json"
            rows={14}
            placeholder={PLACEHOLDER}
            value={jsonText}
            onChange={(e) => setJsonText(e.target.value)}
            className="font-mono text-xs"
            disabled={busy}
          />
        </div>

        <Button
          className="gap-2"
          disabled={busy || !jsonText.trim()}
          onClick={() => void onBuildAndSubmit()}
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
          Build XDR &amp; sign transaction
        </Button>
      </CardContent>
    </Card>
  )
}
