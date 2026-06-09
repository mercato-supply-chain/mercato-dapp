'use client'

import * as React from 'react'
import { AlertCircle, ArrowLeft, ArrowRight, Wallet } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import { DealFactRow } from '@/components/deals/deal-fact-row'
import { StepIndicator } from '@/components/ramp/step-indicator'
import { VaultToDealAllocator } from '@/components/vault-to-deal-allocator'
import { useDefindex } from '@/hooks/useDefindex'
import { getLocalizedCategoryLabel } from '@/lib/categories'
import { computeInvestorReturns } from '@/lib/deals/investor-metrics'
import { formatDate } from '@/lib/date-utils'
import { formatCurrency } from '@/lib/format'
import type { Deal } from '@/lib/types'
import { useI18n } from '@/lib/i18n/provider'

const TOTAL_STEPS = 3

type DealFundDialogProps = {
  deal: Deal
  open: boolean
  onOpenChange: (open: boolean) => void
  isFunding: boolean
  isConnected: boolean
  walletAddress?: string
  onConnect: () => void
  onConfirmFund: () => void
  trigger?: React.ReactNode
  triggerSize?: 'default' | 'lg'
}

export function DealFundDialog({
  deal,
  open,
  onOpenChange,
  isFunding,
  isConnected,
  walletAddress,
  onConnect,
  onConfirmFund,
  trigger,
  triggerSize = 'lg',
}: DealFundDialogProps) {
  const { t, messages } = useI18n()
  const { walletBalance, refreshBalances } = useDefindex()
  const [step, setStep] = React.useState(1)

  const apr = deal.yieldAPR ?? 0
  const { profit, total } = computeInvestorReturns(deal.priceUSDC, apr, deal.term)
  const categoryLabel = deal.category
    ? getLocalizedCategoryLabel(deal.category, messages)
    : null

  const hasEnoughFunds = walletBalance >= deal.priceUSDC
  const progress = (step / TOTAL_STEPS) * 100

  React.useEffect(() => {
    if (!open) setStep(1)
  }, [open])

  React.useEffect(() => {
    if (open && isConnected) void refreshBalances()
  }, [open, isConnected, refreshBalances])

  const handleNext = () => {
    if (step < TOTAL_STEPS) setStep((current) => current + 1)
  }

  const handleBack = () => {
    if (step > 1) setStep((current) => current - 1)
  }

  const canAdvanceFromMethod = isConnected && hasEnoughFunds

  const defaultTrigger = (
    <Button size={triggerSize} className="gap-2 shadow-sm">
      <Wallet className="h-5 w-5" aria-hidden />
      {t('deals.fundThisDeal')} · {formatCurrency(deal.priceUSDC)}
    </Button>
  )

  const stepTitle =
    step === 1
      ? t('dealDetail.fundWizardReviewTitle')
      : step === 2
        ? t('dealDetail.fundWizardMethodTitle')
        : t('dealDetail.fundWizardConfirmTitle')

  const stepDescription =
    step === 1
      ? t('dealDetail.fundWizardReviewDescription')
      : step === 2
        ? t('dealDetail.fundWizardMethodDescription')
        : t('dealDetail.fundWizardConfirmDescription')

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {trigger ? <DialogTrigger asChild>{trigger}</DialogTrigger> : <DialogTrigger asChild>{defaultTrigger}</DialogTrigger>}
      <DialogContent className="flex max-h-[min(90vh,720px)] flex-col gap-0 overflow-hidden p-0 sm:max-w-lg">
        <DialogHeader className="shrink-0 space-y-4 border-b px-6 py-4">
          <div>
            <DialogTitle>{t('dealDetail.fundDialogTitle')}</DialogTitle>
            <DialogDescription className="mt-1.5">{stepDescription}</DialogDescription>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{t('dealDetail.fundWizardStepProgress', { current: step, total: TOTAL_STEPS })}</span>
              <span className="font-medium text-foreground">{stepTitle}</span>
            </div>
            <Progress value={progress} className="h-1.5" />
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <StepIndicator step={1} current={step} label={t('dealDetail.fundWizardStepReview')} />
              <Separator orientation="vertical" className="hidden h-5 sm:block" />
              <StepIndicator step={2} current={step} label={t('dealDetail.fundWizardStepMethod')} />
              <Separator orientation="vertical" className="hidden h-5 sm:block" />
              <StepIndicator step={3} current={step} label={t('dealDetail.fundWizardStepConfirm')} />
            </div>
          </div>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
          {step === 1 && (
            <div className="space-y-4">
              <div className="rounded-lg border border-border bg-muted/30 p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {t('dealDetail.fundWizardProduct')}
                </p>
                <p className="mt-1 text-lg font-semibold leading-snug">{deal.productName}</p>
                {deal.description && (
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{deal.description}</p>
                )}
              </div>

              <div className="rounded-lg border border-border p-1">
                <DealFactRow label={t('dealDetail.dealAmount')}>
                  <span className="tabular-nums">{formatCurrency(deal.priceUSDC)} USDC</span>
                </DealFactRow>
                <DealFactRow label={t('dealDetail.expectedReturn')}>
                  <span className="text-success tabular-nums">{apr.toFixed(1)}% APR</span>
                </DealFactRow>
                <DealFactRow label={t('common.term')}>
                  <span className="tabular-nums">
                    {deal.term} {t('common.days')}
                  </span>
                </DealFactRow>
                <DealFactRow label={t('dealDetail.fundWizardEstimatedProfit')}>
                  <span className="text-success tabular-nums">
                    {formatCurrency(Math.round(profit))}
                  </span>
                </DealFactRow>
                <DealFactRow label={t('dealDetail.fundWizardTotalReturn')}>
                  <span className="tabular-nums">{formatCurrency(Math.round(total))}</span>
                </DealFactRow>
                <DealFactRow label={t('common.quantity')}>
                  <span className="tabular-nums">
                    {deal.quantity.toLocaleString()} {t('dealDetail.units')}
                  </span>
                </DealFactRow>
                {categoryLabel && (
                  <DealFactRow label={t('dealDetail.categoryLabel')}>{categoryLabel}</DealFactRow>
                )}
                <DealFactRow label={t('dealDetail.fundWizardPyme')}>{deal.pymeName}</DealFactRow>
                <DealFactRow label={t('dealDetail.fundWizardSupplier')}>{deal.supplier}</DealFactRow>
                {deal.fundingExpiresAt && (
                  <DealFactRow label={t('dealDetail.fundingDeadlineLabel')}>
                    {formatDate(deal.fundingExpiresAt)}
                  </DealFactRow>
                )}
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              {!isConnected ? (
                <div className="rounded-lg border border-dashed border-border bg-muted/20 p-6 text-center">
                  <Wallet className="mx-auto mb-3 h-8 w-8 text-muted-foreground" aria-hidden />
                  <p className="text-sm font-medium">{t('dealDetail.fundWizardConnectFirst')}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {t('dealDetail.fundDialogDescription')}
                  </p>
                  <Button type="button" onClick={onConnect} className="mt-4 w-full gap-2">
                    <Wallet className="h-4 w-4" aria-hidden />
                    {t('dealDetail.connectStellarWallet')}
                  </Button>
                </div>
              ) : (
                <>
                  <div className="rounded-lg border border-border bg-muted/30 p-4">
                    <p className="text-sm font-medium">{t('dealDetail.fundWizardWalletBalance')}</p>
                    <p className="mt-1 text-2xl font-bold tabular-nums">
                      {formatCurrency(walletBalance)} USDC
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {t('dealDetail.fundWizardRequired', { amount: formatCurrency(deal.priceUSDC) })}
                    </p>
                  </div>

                  {hasEnoughFunds ? (
                    <div className="flex items-start gap-2 rounded-lg border border-success/40 bg-success/5 px-3 py-3 text-sm text-success">
                      <Wallet className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                      <p>{t('dealDetail.fundWizardWalletReady')}</p>
                    </div>
                  ) : (
                    <div className="flex items-start gap-2 rounded-lg border border-amber-200/80 bg-amber-50 px-3 py-3 text-sm text-amber-900 dark:border-amber-800/50 dark:bg-amber-950/20 dark:text-amber-200">
                      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                      <p>
                        {t('dealDetail.fundWizardInsufficientFunds', {
                          amount: formatCurrency(deal.priceUSDC),
                        })}
                      </p>
                    </div>
                  )}

                  <VaultToDealAllocator
                    dealAmount={deal.priceUSDC}
                    isFundingOpen
                    disabled={isFunding}
                    onWithdrawComplete={() => void refreshBalances()}
                    className="border-emerald-200/60 dark:border-emerald-800/40"
                  />
                </>
              )}
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <div className="rounded-lg border border-border p-1">
                <DealFactRow label={t('dealDetail.fundWizardProduct')}>{deal.productName}</DealFactRow>
                <DealFactRow label={t('dealDetail.dealAmount')}>
                  <span className="tabular-nums">{formatCurrency(deal.priceUSDC)} USDC</span>
                </DealFactRow>
                <DealFactRow label={t('dealDetail.expectedReturn')}>
                  <span className="text-success tabular-nums">{apr.toFixed(1)}% APR</span>
                </DealFactRow>
                <DealFactRow label={t('dealDetail.fundWizardEstimatedProfit')}>
                  <span className="text-success tabular-nums">
                    {formatCurrency(Math.round(profit))}
                  </span>
                </DealFactRow>
              </div>

              <div className="space-y-2">
                <Label>{t('dealDetail.fundingFrom')}</Label>
                <Input value={walletAddress ?? ''} disabled className="font-mono text-xs" />
              </div>

              <p className="text-xs leading-relaxed text-muted-foreground">
                {t('dealDetail.fundWizardConfirmNotice')}
              </p>
            </div>
          )}
        </div>

        <DialogFooter className="shrink-0 border-t px-6 py-4 sm:justify-between">
          {step > 1 ? (
            <Button type="button" variant="outline" onClick={handleBack} disabled={isFunding} className="gap-2">
              <ArrowLeft className="h-4 w-4" aria-hidden />
              {t('dealDetail.fundWizardBack')}
            </Button>
          ) : (
            <span />
          )}

          {step < TOTAL_STEPS ? (
            <Button
              type="button"
              onClick={handleNext}
              disabled={step === 2 && !canAdvanceFromMethod}
              className="gap-2"
            >
              {t('dealDetail.fundWizardNext')}
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Button>
          ) : (
            <Button type="button" onClick={onConfirmFund} disabled={isFunding || !isConnected} className="gap-2">
              {isFunding ? t('dealDetail.funding') : t('dealDetail.confirmFundDeal')}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
