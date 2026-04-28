'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { CheckCircle2, Info, Plus, Trash2 } from 'lucide-react'
import { formatCurrency } from '@/lib/format'
import {
  equalMilestonePercentages,
  sumMilestonePercentages,
  type MilestoneDraft,
  MAX_MILESTONES,
  MIN_MILESTONES,
} from '../types'
import { useI18n } from '@/lib/i18n/provider'

interface MilestonesStepProps {
  milestones: MilestoneDraft[]
  totalAmount: number
  onMilestonesChange: (milestones: MilestoneDraft[]) => void
}

const PERCENT_OPTIONS = ['30', '40', '50', '60', '70'] as const

function complementPercent(p: string): string {
  return String(100 - Number(p))
}

export function MilestonesStep({
  milestones,
  totalAmount,
  onMilestonesChange,
}: MilestonesStepProps) {
  const { t } = useI18n()
  const totalPct = sumMilestonePercentages(milestones)
  const pctBalanced = Math.abs(totalPct - 100) < 0.0001

  const updateAt = (index: number, patch: Partial<MilestoneDraft>) => {
    const next = milestones.map((m, i) =>
      i === index ? { ...m, ...patch } : m,
    )
    onMilestonesChange(next)
  }

  const handleTwoMilestonePercentChange = (index: number, v: string) => {
    const other = index === 0 ? 1 : 0
    const next = [...milestones]
    next[index] = { ...next[index], percentage: v }
    next[other] = { ...next[other], percentage: complementPercent(v) }
    onMilestonesChange(next)
  }

  const handleMultiPercentChange = (index: number, raw: string) => {
    if (raw === '') {
      updateAt(index, { percentage: '' })
      return
    }
    const n = Number(raw)
    if (!Number.isFinite(n)) return
    const clamped = Math.min(99, Math.max(0, Math.round(n)))
    updateAt(index, { percentage: String(clamped) })
  }

  const addMilestone = () => {
    if (milestones.length >= MAX_MILESTONES) return
    const n = milestones.length + 1
    const pcts = equalMilestonePercentages(n)
    const next = milestones.map((m, i) => ({
      ...m,
      percentage: pcts[i],
    }))
    next.push({
      name: t('createDeal.milestone', { number: n }),
      percentage: pcts[n - 1],
    })
    onMilestonesChange(next)
  }

  const removeMilestone = (index: number) => {
    if (milestones.length <= MIN_MILESTONES) return
    const filtered = milestones.filter((_, i) => i !== index)
    const pcts = equalMilestonePercentages(filtered.length)
    onMilestonesChange(
      filtered.map((m, i) => ({ ...m, percentage: pcts[i] })),
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CheckCircle2 className="h-5 w-5" aria-hidden />
          {t('createDeal.milestonesTitle')}
        </CardTitle>
        <CardDescription>
          {t('createDeal.milestonesDescription')}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-950">
          <div className="flex gap-3">
            <Info
              className="h-5 w-5 shrink-0 text-blue-600 dark:text-blue-400"
              aria-hidden
            />
            <div className="space-y-1">
              <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                {t('createDeal.standardMilestones')}
              </p>
              <p className="text-sm text-blue-700 dark:text-blue-300">
                {t('createDeal.standardMilestonesBody')}
              </p>
            </div>
          </div>
        </div>

        {milestones.map((m, index) => {
          const pct = Number(m.percentage || 0)
          const amount = (totalAmount * pct) / 100
          const isTwo = milestones.length === 2

          return (
            <div
              key={`milestone-${index}`}
              className="space-y-4 rounded-lg border border-border p-4"
            >
              <div className="flex items-start justify-between gap-2">
                <h4 className="font-semibold">{t('createDeal.milestone', { number: index + 1 })}</h4>
                {milestones.length > MIN_MILESTONES && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="shrink-0 text-muted-foreground hover:text-destructive"
                    onClick={() => removeMilestone(index)}
                    aria-label={t('createDeal.removeMilestone', { number: index + 1 })}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor={`milestone-name-${index}`}>{t('createDeal.milestoneName')}</Label>
                <Input
                  id={`milestone-name-${index}`}
                  value={m.name}
                  onChange={(e) => updateAt(index, { name: e.target.value })}
                  placeholder={t('createDeal.milestonePlaceholder')}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor={`milestone-pct-${index}`}>
                  {t('createDeal.paymentPercentage')}
                </Label>
                {isTwo ? (
                  <Select
                    value={m.percentage}
                    onValueChange={(v) =>
                      handleTwoMilestonePercentChange(index, v)
                    }
                  >
                    <SelectTrigger id={`milestone-pct-${index}`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PERCENT_OPTIONS.map((p) => (
                        <SelectItem key={p} value={p}>
                          {p}%
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    id={`milestone-pct-${index}`}
                    type="number"
                    min={1}
                    max={99}
                    inputMode="numeric"
                    value={m.percentage}
                    onChange={(e) =>
                      handleMultiPercentChange(index, e.target.value)
                    }
                    className="tabular-nums"
                  />
                )}
                <p className="text-xs text-muted-foreground tabular-nums">
                  {formatCurrency(amount)} USDC
                </p>
              </div>
            </div>
          )
        })}

        {milestones.length < MAX_MILESTONES && (
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={addMilestone}
          >
            <Plus className="mr-2 h-4 w-4" aria-hidden />
            {t('createDeal.addMilestone')}
          </Button>
        )}

        <p
          className={`text-sm font-medium tabular-nums ${
            pctBalanced ? 'text-muted-foreground' : 'text-destructive'
          }`}
          role="status"
        >
          {t('createDeal.totalPercent', { percent: totalPct.toFixed(0) })}
          {!pctBalanced && t('createDeal.mustEqual100')}
        </p>
      </CardContent>
    </Card>
  )
}
