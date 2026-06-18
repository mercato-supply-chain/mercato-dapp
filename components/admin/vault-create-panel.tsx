'use client'

import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import {
  ChevronDown,
  ChevronUp,
  Copy,
  CheckCircle2,
  ExternalLink,
  Info,
  Landmark,
  Loader2,
  Wand2,
} from 'lucide-react'
import { VaultDeploymentChecklist } from '@/components/admin/vault-deployment-checklist'
import { useAdminVaultTransactions } from '@/hooks/use-admin-vault-transactions'
import { resolveDeployedVaultAddress } from '@/lib/defindex/extract-vault-address'
import type { SendTransactionResponse } from '@defindex/sdk'

export const LAST_DEPLOY_STORAGE_KEY = 'mercato:admin-last-vault-deploy'

interface VaultFormState {
  name: string
  symbol: string
  vaultFeeBps: string
  upgradable: boolean
  emergencyManager: string
  feeReceiver: string
  manager: string
  rebalanceManager: string
  assetAddress: string
  strategyAddress: string
  strategyName: string
}

const DEFAULTS: VaultFormState = {
  name: 'Mercato Vault',
  symbol: 'mVLT',
  vaultFeeBps: '100',
  upgradable: true,
  emergencyManager: '',
  feeReceiver: '',
  manager: '',
  rebalanceManager: '',
  assetAddress: '',
  strategyAddress: '',
  strategyName: 'Primary Strategy',
}

const TESTNET_PRESETS = {
  blendUsdc: {
    label: 'BlendUSDC',
    asset: 'CAQCFVLOBK5GIULPNZRGATJJMIZL5BSP7X5YJVMGCPTUEPFM4AVSRCJU',
    strategy: 'CALLOM5I7XLQPPOPQMYAHUWW4N7O3JKT42KQ4ASEEVBXDJQNJOALFSUY',
    strategyName: 'USDC Blend Strategy',
  },
  xlm: {
    label: 'XLM',
    asset: 'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC',
    strategy: 'CDVLOSPJPQOTB6ZCWO5VSGTOLGMKTXSFWYTUP572GTPNOWX4F76X3HPM',
    strategyName: 'XLM Blend Strategy',
  },
} as const

async function readErrorMessage(response: Response): Promise<string> {
  try {
    const data = (await response.json()) as { error?: unknown }
    if (typeof data?.error === 'string' && data.error) return data.error
  } catch {
    /* ignore */
  }
  return `Request failed (${response.status})`
}

function buildConfig(form: VaultFormState, callerAddress: string): Record<string, unknown> {
  const feeBps = Number(form.vaultFeeBps)
  return {
    caller: callerAddress,
    name: form.name.trim(),
    symbol: form.symbol.trim(),
    vaultFeeBps: Number.isFinite(feeBps) ? feeBps : 100,
    upgradable: form.upgradable,
    roles: {
      emergencyManager: form.emergencyManager.trim() || callerAddress,
      feeReceiver: form.feeReceiver.trim() || callerAddress,
      manager: form.manager.trim() || callerAddress,
      rebalanceManager: form.rebalanceManager.trim() || callerAddress,
    },
    assets: form.assetAddress.trim()
      ? [
          {
            address: form.assetAddress.trim(),
            strategies: form.strategyAddress.trim()
              ? [
                  {
                    address: form.strategyAddress.trim(),
                    name: form.strategyName.trim() || 'Primary Strategy',
                    paused: false,
                  },
                ]
              : [],
          },
        ]
      : [],
  }
}

type VaultCreatePanelProps = {
  onDeployed?: (payload: { txHash: string | null; vaultAddress: string | null }) => void
}

export function VaultCreatePanel({ onDeployed }: VaultCreatePanelProps) {
  const { walletAddress, provider, signAndSubmit } = useAdminVaultTransactions()
  const [form, setForm] = useState<VaultFormState>(DEFAULTS)
  const [busy, setBusy] = useState(false)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [copied, setCopied] = useState(false)
  const [lastTxHash, setLastTxHash] = useState<string | null>(null)
  const [lastVaultAddress, setLastVaultAddress] = useState<string | null>(null)

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(LAST_DEPLOY_STORAGE_KEY)
      if (!raw) return
      const parsed = JSON.parse(raw) as { txHash?: string; vaultAddress?: string }
      if (parsed.txHash) setLastTxHash(parsed.txHash)
      if (parsed.vaultAddress) setLastVaultAddress(parsed.vaultAddress)
    } catch {
      /* ignore */
    }
  }, [])

  useEffect(() => {
    if (!lastTxHash) return
    try {
      sessionStorage.setItem(
        LAST_DEPLOY_STORAGE_KEY,
        JSON.stringify({ txHash: lastTxHash, vaultAddress: lastVaultAddress }),
      )
    } catch {
      /* ignore */
    }
  }, [lastTxHash, lastVaultAddress])

  const set = (key: keyof VaultFormState) =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((prev) => ({ ...prev, [key]: e.target.value }))

  const fillPreset = (preset: typeof TESTNET_PRESETS[keyof typeof TESTNET_PRESETS]) => {
    setForm((prev) => ({
      ...prev,
      assetAddress: preset.asset,
      strategyAddress: preset.strategy,
      strategyName: preset.strategyName,
    }))
  }

  const previewJson = JSON.stringify(
    buildConfig(form, walletAddress ?? 'G…your-wallet'),
    null,
    2,
  )

  const handleCopyJson = async () => {
    await navigator.clipboard.writeText(previewJson)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const onDeploy = useCallback(async () => {
    const address = walletAddress?.trim()
    if (!address) {
      toast.error('Connect your admin wallet first.')
      return
    }
    if (!form.assetAddress.trim()) {
      toast.error('Asset address is required to create a vault.')
      return
    }

    const config = buildConfig(form, address)
    setBusy(true)
    setLastTxHash(null)
    setLastVaultAddress(null)
    try {
      const res = await fetch('/api/defindex/admin/create-vault', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      })
      if (!res.ok) throw new Error(await readErrorMessage(res))

      const createPayload = (await res.json()) as {
        xdr?: string
        simulationResponse?: string
      }
      const { xdr } = createPayload
      if (!xdr) throw new Error('No XDR returned from DeFindex.')

      const submitted = (await signAndSubmit(xdr, address)) as SendTransactionResponse
      if (submitted?.success === false) {
        toast.error('Transaction was not successful on-chain.')
        return
      }

      const vaultAddress = resolveDeployedVaultAddress(createPayload, submitted)
      const txHash = submitted?.txHash ?? null
      if (txHash) setLastTxHash(txHash)
      if (vaultAddress) setLastVaultAddress(vaultAddress)
      onDeployed?.({ txHash, vaultAddress })

      toast.success('Vault deployed! Check the next steps below.', {
        description: vaultAddress
          ? `Vault: ${vaultAddress.slice(0, 8)}…`
          : txHash
            ? `Tx: ${txHash}`
            : undefined,
      })
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Vault creation failed.')
    } finally {
      setBusy(false)
    }
  }, [form, onDeployed, signAndSubmit, walletAddress])

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Create new vault</CardTitle>
        <CardDescription>
          Fill in the parameters or use the testnet presets below. Role fields left blank default to your connected wallet.
          See the{' '}
          <a
            href="https://docs.defindex.io/api-integration-guide/creating-a-defindex-vault"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-0.5 underline underline-offset-2"
          >
            DeFindex vault guide <ExternalLink className="h-3 w-3" />
          </a>{' '}
          for full documentation.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {walletAddress && provider !== 'pollar' && (
          <div className="flex items-start gap-2 rounded-md border border-blue-500/30 bg-blue-500/5 px-3 py-2 text-xs text-blue-800 dark:text-blue-200">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>
              Signing with <strong>Freighter / Albedo</strong>. If you&apos;re using a Pollar embedded wallet, sign in via the wallet button and it will be used automatically.
            </span>
          </div>
        )}

        <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-4">
          <div className="mb-2 flex items-center gap-2">
            <Info className="h-3.5 w-3.5 shrink-0 text-blue-500" aria-hidden />
            <p className="text-xs font-semibold text-blue-700 dark:text-blue-400">Testnet quick-fill</p>
          </div>
          <p className="mb-3 text-xs text-muted-foreground">
            On testnet, DeFindex strategies use <strong>BlendUSDC</strong> — a test token from{' '}
            <a href="https://testnet.blend.capital" target="_blank" rel="noreferrer" className="underline underline-offset-2">
              testnet.blend.capital
            </a>
            , <em>not</em> regular USDC. Get BlendUSDC from their faucet before deploying a USDC vault.
          </p>
          <div className="flex flex-wrap gap-2">
            {Object.entries(TESTNET_PRESETS).map(([key, preset]) => (
              <Button
                key={key}
                type="button"
                variant="outline"
                size="sm"
                className="h-7 gap-1.5 text-xs"
                onClick={() => fillPreset(preset)}
                disabled={busy}
              >
                <Wand2 className="h-3 w-3" aria-hidden />
                Fill {preset.label} preset
              </Button>
            ))}
          </div>
        </div>

        <div>
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Vault identity</p>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="vault-name">Name</Label>
              <Input
                id="vault-name"
                value={form.name}
                onChange={set('name')}
                placeholder="Mercato Vault"
                disabled={busy}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="vault-symbol">Symbol</Label>
              <Input
                id="vault-symbol"
                value={form.symbol}
                onChange={set('symbol')}
                placeholder="mVLT"
                disabled={busy}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="vault-fee">
                Fee (bps)
                <span className="ml-1.5 text-xs text-muted-foreground">
                  {Number(form.vaultFeeBps) / 100}%
                </span>
              </Label>
              <Input
                id="vault-fee"
                type="number"
                min={0}
                max={10000}
                value={form.vaultFeeBps}
                onChange={set('vaultFeeBps')}
                placeholder="100"
                disabled={busy}
              />
            </div>
          </div>
          <div className="mt-4 flex items-center gap-3">
            <Switch
              id="vault-upgradable"
              checked={form.upgradable}
              onCheckedChange={(v) => setForm((p) => ({ ...p, upgradable: v }))}
              disabled={busy}
            />
            <Label htmlFor="vault-upgradable" className="cursor-pointer">
              Upgradable contract
              <span className="ml-1 text-xs text-muted-foreground">(recommended for testnet)</span>
            </Label>
          </div>
        </div>

        <Separator />

        <div>
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Asset &amp; strategy</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="asset-address">
                Asset contract address <span className="text-destructive">*</span>
              </Label>
              <Input
                id="asset-address"
                value={form.assetAddress}
                onChange={set('assetAddress')}
                placeholder="C… (use preset above for testnet)"
                className="font-mono text-xs"
                disabled={busy}
              />
              <p className="text-[11px] text-muted-foreground">
                Testnet BlendUSDC: <code className="rounded bg-muted px-0.5">CAQCFVL…RCJU</code>
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="strategy-address">Strategy contract address</Label>
              <Input
                id="strategy-address"
                value={form.strategyAddress}
                onChange={set('strategyAddress')}
                placeholder="C… (leave blank for no strategy)"
                className="font-mono text-xs"
                disabled={busy}
              />
            </div>
            {form.strategyAddress.trim() && (
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="strategy-name">Strategy label</Label>
                <Input
                  id="strategy-name"
                  value={form.strategyName}
                  onChange={set('strategyName')}
                  placeholder="Primary Strategy"
                  disabled={busy}
                />
              </div>
            )}
          </div>
        </div>

        <Separator />

        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Roles</p>
          <p className="mb-3 text-xs text-muted-foreground">
            Leave any field blank to default to your connected wallet address (
            <span className="font-mono">{walletAddress ? walletAddress.slice(0, 8) + '…' : 'not connected'}</span>).
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            {(
              [
                { id: 'manager', label: 'Manager', key: 'manager' },
                { id: 'rebalance-manager', label: 'Rebalance manager', key: 'rebalanceManager' },
                { id: 'fee-receiver', label: 'Fee receiver', key: 'feeReceiver' },
                { id: 'emergency-manager', label: 'Emergency manager', key: 'emergencyManager' },
              ] as const
            ).map(({ id, label, key }) => (
              <div key={id} className="space-y-1.5">
                <Label htmlFor={id}>{label}</Label>
                <Input
                  id={id}
                  value={form[key]}
                  onChange={set(key)}
                  placeholder="G… (defaults to your wallet)"
                  className="font-mono text-xs"
                  disabled={busy}
                />
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-border bg-muted/30">
          <button
            type="button"
            className="flex w-full items-center justify-between px-4 py-2.5 text-sm font-medium"
            onClick={() => setShowAdvanced((p) => !p)}
          >
            <span>Preview JSON payload</span>
            {showAdvanced ? <ChevronUp className="h-4 w-4" aria-hidden /> : <ChevronDown className="h-4 w-4" aria-hidden />}
          </button>
          {showAdvanced && (
            <div className="relative border-t border-border">
              <pre className="max-h-64 overflow-auto p-4 text-[11px] leading-relaxed text-muted-foreground">
                {previewJson}
              </pre>
              <button
                type="button"
                onClick={() => void handleCopyJson()}
                className="absolute right-3 top-3 rounded-md border border-border bg-background p-1.5 text-muted-foreground hover:text-foreground"
                title="Copy JSON"
              >
                {copied ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
              </button>
            </div>
          )}
        </div>

        {lastTxHash && (
          <VaultDeploymentChecklist
            txHash={lastTxHash}
            vaultAddress={lastVaultAddress}
            managerAddress={walletAddress ?? ''}
            strategyAddress={form.strategyAddress.trim()}
          />
        )}

        <Button
          className="gap-2"
          disabled={busy || !form.assetAddress.trim()}
          onClick={() => void onDeploy()}
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Landmark className="h-4 w-4" aria-hidden />}
          {busy ? 'Deploying vault…' : 'Build XDR & deploy vault'}
        </Button>
      </CardContent>
    </Card>
  )
}
