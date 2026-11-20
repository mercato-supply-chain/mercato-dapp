'use client'

import * as React from 'react'
import { AlertCircle, ArrowLeft, ArrowRight, CheckCircle2, Info, Wallet } from 'lucide-react'
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
import { StepIndicator } from '@/components/ui/step-indicator'
import { VaultToDealAllocator } from '@/components/vault-to-deal-allocator'
import { useDefindex } from '@/hooks/useDefindex'
import { useWallet } from '@/hooks/use-wallet'
import { parseWalletUsdcBalance, canWalletSignClassicTx } from '@/lib/mercato-wallet'
import { getLocalizedCategoryLabel } from '@/lib/categories'
import { computeInvestorReturns } from '@/lib/deals/investor-metrics'
import {
  investorFundingTotal,
  platformFeeAmount,
  PLATFORM_FEE_PERCENT,
} from '@/lib/deals/fees'
import { formatDate } from '@/lib/date-utils'
import { formatPercent, formatUSDC } from '@/lib/format'
import {
  buildCapacityState,
  buildContributionPreview,
  parseContributionInput,
  validateContributionRules,
} from '@/lib/rwa'
import type { RwaContributionPreview } from '@/lib/rwa'
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
  /** Called with the validated principal amount the investor chose to contribute. */
  onConfirmFund: (contributionPrincipal: number) => void
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
  const { balances, refreshBalance, provider } = useWallet()
  const { refreshBalances } = useDefindex()
  const refreshBalanceRef = React.useRef(refreshBalance)
  const refreshBalancesRef = React.useRef(refreshBalances)
  refreshBalanceRef.current = refreshBalance
  refreshBalancesRef.current = refreshBalances
  const [step, setStep] = React.useState(1)

  // Partial contribution amount state
  const [amountInput, setAmountInput] = React.useState('')
  const [amountTouched, setAmountTouched] = React.useState(false)

  const rate = deal.yieldAPR ?? 0
  const fullPrincipal = deal.priceUSDC
  const defaultFundingTotal =
    deal.investorFundingTotal || investorFundingTotal(fullPrincipal)
  const categoryLabel = deal.category
    ? getLocalizedCategoryLabel(deal.category, messages)
    : null

  const walletUsdcBalance = parseWalletUsdcBalance(balances)
  const progress = (step / TOTAL_STEPS) * 100

  // Build capacity state from deal data (confirmedPrincipal comes from deal or defaults to 0)
  const confirmedPrincipal = (deal as Deal & { confirmedPrincipal?: number }).confirmedPrincipal ?? 0
  const capacity = buildCapacityState(fullPrincipal, confirmedPrincipal)

  const terms = {
    targetPrincipal: fullPrincipal,
    financingTarget: fullPrincipal,
    yieldApr: rate,
    termDays: deal.term,
    platformFeePercent: deal.platformFeePercent ?? PLATFORM_FEE_PERCENT,
    fundingExpiresAt: deal.fundingExpiresAt ?? null,
  }

  // Parse and validate the current input
  const inputValidation = parseContributionInput(amountInput)
  const businessError =
    inputValidation.valid && inputValidation.principalRaw !== null
      ? validateContributionRules(inputValidation.principalRaw, capacity, walletUsdcBalance)
      : null

  const hasInputError =
    amountTouched &&
    (inputValidation.error !== null ||
      (businessError !== null && businessError !== 'capacity_stale'))

  const effectivePrincipal =
    inputValidation.valid && inputValidation.principalRaw !== null && !businessError
      ? inputValidation.principalRaw
      : null

  const effectiveFundingTotal = effectivePrincipal
    ? investorFundingTotal(effectivePrincipal)
    : defaultFundingTotal

  // Derive preview directly — no effect needed
  const preview: RwaContributionPreview | null = React.useMemo(() => {
    if (effectivePrincipal === null) return null
    return buildContributionPreview(effectivePrincipal, terms, capacity)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectivePrincipal, confirmedPrincipal])

  const hasEnoughFunds = walletUsdcBalance >= effectiveFundingTotal

  React.useEffect(() => {
    if (!open) {
      setStep(1)
      setAmountInput('')
      setAmountTouched(false)
    }
  }, [open])

  React.useEffect(() => {
    if (!open || !isConnected) return
    void refreshBalanceRef.current()
    void refreshBalancesRef.current()
  }, [open, isConnected])

  const handleNext = () => {
    if (step < TOTAL_STEPS) setStep((current) => current + 1)
  }

  const handleBack = () => {
    if (step > 1) setStep((current) => current - 1)
  }

  const canAdvanceFromReview = effectivePrincipal !== null && !hasInputError
  const canAdvanceFromMethod = isConnected && hasEnoughFunds

  const handleConfirm = () => {
    const principal = effectivePrincipal ?? fullPrincipal
    onConfirmFund(principal)
  }

  // Wallet capability check: only SWK-connected wallets can sign classic USDC tx
  const walletCanFund = canWalletSignClassicTx(provider ?? null)
  const showWalletCapabilityWarning = isConnected && !walletCanFund

  const defaultTrigger = (
    <Button size={triggerSize} className="gap-2 shadow-sm">
      <Wallet className="h-5 w-5" aria-hidden />
      {t('deals.fundThisDeal')} · {formatUSDC(defaultFundingTotal)}
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

  // Compute display values for the current effective contribution
  const displayPrincipal = effectivePrincipal ?? fullPrincipal
  const displayFeeAmount = platformFeeAmount(displayPrincipal)
  const displayFundingTotal = investorFundingTotal(displayPrincipal)
  const { profit, total } = computeInvestorReturns(displayPrincipal, rate, deal.term)

  const moneyBreakdown = (
    <>
      <DealFactRow label={t('dealDetail.contributionPrincipal')}>
        <span className="tabular-nums">{formatUSDC(displayPrincipal)}</span>
      </DealFactRow>
      <DealFactRow label={t('dealDetail.supplierReceives')}>
        <span className="tabular-nums text-muted-foreground text-xs">
          {t('dealDetail.supplierReceivesNote', { amount: formatUSDC(fullPrincipal) })}
        </span>
      </DealFactRow>
      <DealFactRow
        label={t('dealDetail.platformFeeLine', {
          percent: PLATFORM_FEE_PERCENT,
        })}
      >
        <span className="tabular-nums">{formatUSDC(displayFeeAmount)}</span>
      </DealFactRow>
      <DealFactRow label={t('dealDetail.youPayTotal')}>
        <span className="font-semibold tabular-nums">{formatUSDC(displayFundingTotal)}</span>
      </DealFactRow>
      <DealFactRow label={t('dealDetail.investorRate')}>
        <span className="text-success tabular-nums">
          {formatPercent(rate, { minFractionDigits: 2, maxFractionDigits: 2 })}
        </span>
      </DealFactRow>
      <DealFactRow label={t('common.term')}>
        <span className="tabular-nums">
          {deal.term} {t('common.days')}
        </span>
      </DealFactRow>
      <DealFactRow label={t('dealDetail.fundWizardEstimatedProfit')}>
        <span className="text-success tabular-nums">
          {formatUSDC(profit)} (
          {formatPercent(rate, { minFractionDigits: 2, maxFractionDigits: 2 })})
        </span>
      </DealFactRow>
      <DealFactRow label={t('dealDetail.fundWizardTotalReturn')}>
        <span className="tabular-nums">{formatUSDC(total)}</span>
      </DealFactRow>
      {preview && (
        <DealFactRow label={t('dealDetail.yourShareOfDeal')}>
          <span className="tabular-nums">
            {(preview.shareOfTarget * 100).toFixed(2)}%
          </span>
        </DealFactRow>
      )}
    </>
  )

  // Error message for amount input
  const amountErrorMessage = (() => {
    if (!amountTouched) return null
    if (inputValidation.error === 'empty') return null
    if (inputValidation.error === 'invalid_format') return t('dealDetail.contributionAmountInvalidFormat')
    if (inputValidation.error === 'too_many_decimals') return t('dealDetail.contributionAmountTooManyDecimals')
    if (businessError === 'below_minimum') return t('dealDetail.contributionAmountBelowMinimum')
    if (businessError === 'exceeds_capacity') return t('dealDetail.contributionAmountExceedsCapacity', { remaining: formatUSDC(capacity.remainingCapacity) })
    if (businessError === 'exceeds_balance') return t('dealDetail.contributionAmountExceedsBalance')
    return null
  })()

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

              {/* Capacity bar */}
              {!capacity.targetReached && confirmedPrincipal > 0 && (
                <div className="space-y-1.5 rounded-lg border border-border p-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">{t('dealDetail.fundingProgress')}</span>
                    <span className="font-medium tabular-nums">
                      {formatUSDC(confirmedPrincipal)} / {formatUSDC(fullPrincipal)}
                    </span>
                  </div>
                  <Progress
                    value={(confirmedPrincipal / fullPrincipal) * 100}
                    className="h-2"
                    aria-label={t('dealDetail.fundingProgressAriaLabel')}
                  />
                  <p className="text-xs text-muted-foreground">
                    {t('dealDetail.remainingCapacity', { amount: formatUSDC(capacity.remainingCapacity) })}
                  </p>
                </div>
              )}

              {/* Contribution amount input */}
              <div className="space-y-2">
                <Label htmlFor="contribution-amount">
                  {t('dealDetail.contributionAmountLabel')}
                </Label>
                <div className="relative">
                  <Input
                    id="contribution-amount"
                    type="text"
                    inputMode="decimal"
                    placeholder={formatUSDC(capacity.remainingCapacity)}
                    value={amountInput}
                    onChange={(e) => {
                      setAmountInput(e.target.value)
                      setAmountTouched(true)
                    }}
                    onBlur={() => setAmountTouched(true)}
                    aria-describedby={hasInputError ? 'contribution-amount-error' : 'contribution-amount-hint'}
                    aria-invalid={hasInputError}
                    className={hasInputError ? 'border-destructive' : ''}
                  />
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                    USDC
                  </span>
                </div>

                {hasInputError && amountErrorMessage ? (
                  <p id="contribution-amount-error" role="alert" className="text-xs text-destructive flex items-center gap-1">
                    <AlertCircle className="h-3 w-3 shrink-0" aria-hidden />
                    {amountErrorMessage}
                  </p>
                ) : (
                  <p id="contribution-amount-hint" className="text-xs text-muted-foreground">
                    {t('dealDetail.contributionAmountHint', {
                      max: formatUSDC(capacity.remainingCapacity),
                    })}
                  </p>
                )}
              </div>

              <div className="rounded-lg border border-border p-1">
                {moneyBreakdown}
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

              {/* Partial funding notice: supplier is paid only when target is reached */}
              {preview && !preview.fillsTarget && (
                <div className="flex items-start gap-2 rounded-lg border border-blue-200/80 bg-blue-50 px-3 py-3 text-sm text-blue-900 dark:border-blue-800/50 dark:bg-blue-950/20 dark:text-blue-200">
                  <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                  <p>{t('dealDetail.partialFundingNotice')}</p>
                </div>
              )}

              {/* Full-target confirmation */}
              {preview?.fillsTarget && (
                <div className="flex items-start gap-2 rounded-lg border border-success/40 bg-success/5 px-3 py-3 text-sm text-success">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                  <p>{t('dealDetail.fullTargetNotice')}</p>
                </div>
              )}
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              {showWalletCapabilityWarning && (
                <div
                  role="alert"
                  className="flex items-start gap-2 rounded-lg border border-amber-200/80 bg-amber-50 px-3 py-3 text-sm text-amber-900 dark:border-amber-800/50 dark:bg-amber-950/20 dark:text-amber-200"
                >
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                  <p>{t('dealDetail.walletCapabilityUnsupported')}</p>
                </div>
              )}

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
                      {formatUSDC(walletUsdcBalance)}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {t('dealDetail.fundWizardRequired', {
                        amount: formatUSDC(effectiveFundingTotal),
                      })}
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
                          amount: formatUSDC(effectiveFundingTotal),
                        })}
                      </p>
                    </div>
                  )}

                  <VaultToDealAllocator
                    dealAmount={effectiveFundingTotal}
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
                {moneyBreakdown}
              </div>

              {/* Estimates disclaimer */}
              {preview && (
                <p className="text-xs text-muted-foreground leading-relaxed flex items-start gap-1.5">
                  <Info className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
                  {t('dealDetail.estimatesDisclaimer')}
                </p>
              )}

              <div className="space-y-2">
                <Label>{t('dealDetail.fundingFrom')}</Label>
                <Input value={walletAddress ?? ''} disabled className="font-mono text-xs" />
              </div>

              <p className="text-xs leading-relaxed text-muted-foreground">
                {t('dealDetail.fundWizardConfirmNoticeDirect')}
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
              disabled={
                (step === 1 && !canAdvanceFromReview) ||
                (step === 2 && !canAdvanceFromMethod)
              }
              className="gap-2"
            >
              {t('dealDetail.fundWizardNext')}
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Button>
          ) : (
            <Button
              type="button"
              onClick={handleConfirm}
              disabled={isFunding || !isConnected || showWalletCapabilityWarning}
              className="gap-2"
            >
              {isFunding ? t('dealDetail.funding') : t('dealDetail.confirmFundDeal')}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
