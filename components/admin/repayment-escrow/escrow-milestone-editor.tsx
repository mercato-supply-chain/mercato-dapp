'use client'

import { useEffect, useRef, useState } from 'react'
import { ArrowDownRight } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import { isLikelyStellarAddress } from '@/lib/defindex/stellar-address'
import { useI18n } from '@/lib/i18n/provider'
import { CopyableCodeLine } from '@/components/admin/copyable-code-line'

export type EscrowMilestoneEditorProps = {
  readonly totalGrossed: number
  readonly milestoneDescription: string
  readonly milestoneAmount: number
  /** Derived display percentage; always computed from the authoritative amount. */
  readonly percent: number
  readonly generatedReceiver: string
  readonly receiver: string
  readonly onDescriptionChange: (description: string) => void
  /** Parent recalculates the amount from the grossed total. */
  readonly onPercentChange: (percent: number) => void
  /** Parent recalculates the percentage from the authoritative amount. */
  readonly onAmountChange: (amount: number) => void
  /** `null` restores the generated investor receiver. */
  readonly onReceiverOverride: (receiver: string | null) => void
}

const TWO_DP_PATTERN = /^\d+(\.\d{0,2})?$/

function parsePositive(value: string): number | null {
  const trimmed = value.trim().replace(',', '.')
  if (!TWO_DP_PATTERN.test(trimmed)) return null
  const parsed = Number.parseFloat(trimmed)
  if (!Number.isFinite(parsed) || parsed <= 0) return null
  return parsed
}

/**
 * First-milestone editor for the repayment deployment review.
 * Percentage and amount are never independently editable: editing either
 * commits one authoritative value and the other is re-derived downstream.
 */
export function EscrowMilestoneEditor({
  totalGrossed,
  milestoneDescription,
  milestoneAmount,
  percent,
  generatedReceiver,
  receiver,
  onDescriptionChange,
  onPercentChange,
  onAmountChange,
  onReceiverOverride,
}: EscrowMilestoneEditorProps) {
  const { t } = useI18n()
  const [percentText, setPercentText] = useState(() => String(percent))
  const [amountText, setAmountText] = useState(() => String(milestoneAmount))
  const [overrideText, setOverrideText] = useState('')
  const [overrideChecked, setOverrideChecked] = useState(false)

  const committedAmountRef = useRef(milestoneAmount)
  const committedPercentRef = useRef(percent)

  // Resyncs only on external mutations (reset/review switch), never on the
  // echo produced by this editor's own commits.
  useEffect(() => {
    if (milestoneAmount !== committedAmountRef.current) {
      committedAmountRef.current = milestoneAmount
      setAmountText(String(milestoneAmount))
    }
  }, [milestoneAmount])

  useEffect(() => {
    if (percent !== committedPercentRef.current) {
      committedPercentRef.current = percent
      setPercentText(String(percent))
    }
  }, [percent])

  const receiverOverridden = receiver !== generatedReceiver

  const handlePercentCommit = (raw: string) => {
    const parsed = parsePositive(raw)
    if (parsed === null) {
      setPercentText(String(committedPercentRef.current))
      return
    }
    committedPercentRef.current = parsed
    setPercentText(String(parsed))
    onPercentChange(parsed)
  }

  const handleAmountCommit = (raw: string) => {
    const parsed = parsePositive(raw)
    if (parsed === null || parsed > totalGrossed) {
      setAmountText(String(committedAmountRef.current))
      return
    }
    committedAmountRef.current = parsed
    setAmountText(String(parsed))
    onAmountChange(parsed)
  }

  const proposedOverride = overrideText.trim()
  const overrideValid = isLikelyStellarAddress(proposedOverride)
  const overrideChanged = overrideValid && proposedOverride !== generatedReceiver

  const handleOverrideToggle = (checked: boolean) => {
    setOverrideChecked(checked)
    if (checked && overrideChanged) {
      onReceiverOverride(proposedOverride)
      return
    }
    onReceiverOverride(null)
  }

  const remaining = Math.max(0, totalGrossed - milestoneAmount)

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="repayment-milestone-description">{t('repaymentEscrow.milestoneEditor.descLabel')}</Label>
        <Input
          id="repayment-milestone-description"
          value={milestoneDescription}
          onChange={(e) => onDescriptionChange(e.target.value)}
          placeholder="Repayment milestone 1"
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="repayment-milestone-percent">{t('repaymentEscrow.milestoneEditor.percentLabel')}</Label>
          <div className="relative">
            <Input
              id="repayment-milestone-percent"
              type="number"
              min="0"
              max="100"
              step="0.1"
              inputMode="decimal"
              value={percentText}
              onChange={(e) => setPercentText(e.target.value)}
              onBlur={(e) => handlePercentCommit(e.target.value)}
            />
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
              %
            </span>
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="repayment-milestone-amount">{t('repaymentEscrow.milestoneEditor.amountLabel')}</Label>
          <Input
            id="repayment-milestone-amount"
            type="number"
            min="0"
            step="0.01"
            inputMode="decimal"
            value={amountText}
            onChange={(e) => setAmountText(e.target.value)}
            onBlur={(e) => handleAmountCommit(e.target.value)}
          />
        </div>
      </div>

      <div className="flex items-center justify-between rounded-md border border-border bg-muted/40 px-3 py-2 text-sm">
        <span className="flex items-center gap-2 text-muted-foreground">
          <ArrowDownRight className="h-4 w-4 shrink-0" aria-hidden />
          {t('repaymentEscrow.milestoneEditor.remaining')}
        </span>
        <span className="font-medium tabular-nums">
          {remaining.toLocaleString('es-MX', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}{' '}
          USDC
        </span>
      </div>

      <div className="space-y-2 rounded-md border border-border p-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium">{t('repaymentEscrow.milestoneEditor.receiverTitle')}</span>
          {receiverOverridden ? (
            <Badge className="border-transparent bg-amber-500/15 text-amber-700 dark:text-amber-400">
              {t('repaymentEscrow.milestoneEditor.overridden')}
            </Badge>
          ) : (
            <Badge variant="secondary">{t('repaymentEscrow.milestoneEditor.generated')}</Badge>
          )}
        </div>

        <CopyableCodeLine value={generatedReceiver} label={t('repaymentEscrow.milestoneEditor.originalReceiver')} />

        {!receiverOverridden ? (
          <div className="space-y-1.5">
            <Label htmlFor="repayment-receiver-override-input">{t('repaymentEscrow.milestoneEditor.altAddress')}</Label>
            <Input
              id="repayment-receiver-override-input"
              className="font-mono text-xs"
              value={overrideText}
              placeholder={generatedReceiver}
              onChange={(e) => setOverrideText(e.target.value)}
            />
            {overrideText.trim() !== '' && !overrideValid && (
              <p className="text-xs text-destructive">{t('repaymentEscrow.milestoneEditor.invalidAddress')}</p>
            )}
            {overrideValid && !overrideChanged && (
              <p className="text-xs text-muted-foreground">{t('repaymentEscrow.milestoneEditor.sameAddress')}</p>
            )}
            <div className="flex items-start gap-3 rounded-md bg-muted/60 px-3 py-2">
              <Switch
                id="repayment-receiver-override-once"
                checked={overrideChecked}
                disabled={!overrideChanged}
                onCheckedChange={handleOverrideToggle}
              />
              <Label
                htmlFor="repayment-receiver-override-once"
                className="cursor-pointer text-xs font-normal leading-snug text-muted-foreground"
              >
                {t('repaymentEscrow.milestoneEditor.onceNote')}
              </Label>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <CopyableCodeLine value={receiver} label={t('repaymentEscrow.milestoneEditor.appliedReceiver')} />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setOverrideText('')
                setOverrideChecked(false)
                onReceiverOverride(null)
              }}
            >
              {t('repaymentEscrow.milestoneEditor.backToGenerated')}
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
