'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Scale } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useI18n } from '@/lib/i18n/provider'
import { formatCurrency } from '@/lib/format'
import { useWallet } from '@/hooks/use-wallet'
import { useRepaymentEscrow } from '@/hooks/use-repayment-escrow'
import {
  MERCATO_DISPUTE_RESOLVER_ADDRESS,
} from '@/lib/trustless/config'

export type ResolveDisputeTarget = {
  dealId: string
  escrowContractAddress: string
  milestoneId: string
  milestoneTitle: string
  milestoneIndex: number
  milestoneAmount: number
  investorAddress: string | null
  pymeAddress: string | null
}

type SplitPreset = 'investor' | 'pyme' | 'split'

interface AdminResolveDisputeDialogProps {
  target: ResolveDisputeTarget | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

function roundUsdc(n: number): number {
  return Math.round(n * 100) / 100
}

export function AdminResolveDisputeDialog({
  target,
  open,
  onOpenChange,
}: AdminResolveDisputeDialogProps) {
  const { t } = useI18n()
  const { walletInfo, isConnected, handleConnect, provider } = useWallet()
  const { resolveRepaymentDispute, isWorking } = useRepaymentEscrow()
  const [preset, setPreset] = useState<SplitPreset>('investor')
  const [investorAmount, setInvestorAmount] = useState('')
  const [pymeAmount, setPymeAmount] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const total = target?.milestoneAmount ?? 0

  useEffect(() => {
    if (!open || !target) return
    setPreset('investor')
    setInvestorAmount(String(roundUsdc(target.milestoneAmount)))
    setPymeAmount('0')
  }, [open, target])

  const applyPreset = (next: SplitPreset) => {
    setPreset(next)
    if (!target) return
    if (next === 'investor') {
      setInvestorAmount(String(roundUsdc(target.milestoneAmount)))
      setPymeAmount('0')
    } else if (next === 'pyme') {
      setInvestorAmount('0')
      setPymeAmount(String(roundUsdc(target.milestoneAmount)))
    } else {
      const half = roundUsdc(target.milestoneAmount / 2)
      setInvestorAmount(String(half))
      setPymeAmount(String(roundUsdc(target.milestoneAmount - half)))
    }
  }

  const handleSubmit = async () => {
    if (!target || !walletInfo?.address) {
      toast.error(t('adminPending.connectWallet'))
      return
    }
    if (
      MERCATO_DISPUTE_RESOLVER_ADDRESS &&
      walletInfo.address !== MERCATO_DISPUTE_RESOLVER_ADDRESS
    ) {
      toast.error(t('adminDispute.resolverWalletRequired'))
      return
    }

    const invAmt = Number.parseFloat(investorAmount || '0')
    const pymeAmt = Number.parseFloat(pymeAmount || '0')
    if (!Number.isFinite(invAmt) || !Number.isFinite(pymeAmt)) {
      toast.error(t('adminDispute.amountsInvalid'))
      return
    }
    if (Math.abs(invAmt + pymeAmt - total) > 0.02) {
      toast.error(
        t('adminDispute.amountsMustSum', { amount: formatCurrency(total) }),
      )
      return
    }

    const distributions: Array<{ address: string; amount: number }> = []
    if (invAmt > 0) {
      if (!target.investorAddress) {
        toast.error(t('adminCreateEscrow.investorMissing'))
        return
      }
      distributions.push({ address: target.investorAddress, amount: invAmt })
    }
    if (pymeAmt > 0) {
      if (!target.pymeAddress) {
        toast.error(t('adminDispute.pymeMissing'))
        return
      }
      distributions.push({ address: target.pymeAddress, amount: pymeAmt })
    }
    if (distributions.length === 0) {
      toast.error(t('adminDispute.amountsInvalid'))
      return
    }

    setSubmitting(true)
    try {
      await resolveRepaymentDispute({
        dealId: target.dealId,
        contractId: target.escrowContractAddress,
        disputeResolver: walletInfo.address,
        milestoneIndex: target.milestoneIndex,
        distributions,
        provider,
      })
      toast.success(
        t('adminDispute.resolveSuccess', { title: target.milestoneTitle }),
      )
      onOpenChange(false)
      window.location.reload()
    } catch (err) {
      console.error(err)
      toast.error(
        err instanceof Error ? err.message : t('adminDispute.resolveFail'),
      )
    } finally {
      setSubmitting(false)
    }
  }

  const busy = submitting || isWorking

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Scale className="h-5 w-5" aria-hidden />
            {t('adminDispute.resolveTitle')}
          </DialogTitle>
          <DialogDescription>
            {t('adminDispute.resolveDescription', {
              title: target?.milestoneTitle ?? '',
              amount: formatCurrency(total),
            })}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant={preset === 'investor' ? 'default' : 'outline'}
              onClick={() => applyPreset('investor')}
              disabled={busy}
            >
              {t('adminDispute.presetInvestor')}
            </Button>
            <Button
              type="button"
              size="sm"
              variant={preset === 'pyme' ? 'default' : 'outline'}
              onClick={() => applyPreset('pyme')}
              disabled={busy}
            >
              {t('adminDispute.presetPyme')}
            </Button>
            <Button
              type="button"
              size="sm"
              variant={preset === 'split' ? 'default' : 'outline'}
              onClick={() => applyPreset('split')}
              disabled={busy}
            >
              {t('adminDispute.presetSplit')}
            </Button>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="dispute-investor-amt">
                {t('adminDispute.investorAmount')}
              </Label>
              <Input
                id="dispute-investor-amt"
                type="number"
                min="0"
                step="0.01"
                value={investorAmount}
                onChange={(e) => {
                  setPreset('split')
                  setInvestorAmount(e.target.value)
                }}
                disabled={busy}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="dispute-pyme-amt">
                {t('adminDispute.pymeAmount')}
              </Label>
              <Input
                id="dispute-pyme-amt"
                type="number"
                min="0"
                step="0.01"
                value={pymeAmount}
                onChange={(e) => {
                  setPreset('split')
                  setPymeAmount(e.target.value)
                }}
                disabled={busy}
              />
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            {t('adminDispute.resolveHint')}
          </p>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          {!isConnected ? (
            <Button type="button" onClick={handleConnect}>
              {t('adminPending.connectWalletShort')}
            </Button>
          ) : (
            <Button type="button" onClick={handleSubmit} disabled={busy || !target}>
              {busy ? t('adminDispute.resolving') : t('adminDispute.resolveCta')}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
