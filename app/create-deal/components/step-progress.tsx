'use client'

import { Progress } from '@/components/ui/progress'
import type { FormStep } from '../types'
import { useI18n } from '@/lib/i18n/provider'

interface StepProgressProps {
  currentStep: FormStep
  totalSteps?: number
}

export function StepProgress({
  currentStep,
  totalSteps = 3,
}: StepProgressProps) {
  const { t } = useI18n()
  const progress = (currentStep / totalSteps) * 100

  return (
    <div className="mb-8">
      <div className="mb-3 flex items-center justify-between text-sm">
        <span className="font-medium">
          {t('createDeal.stepProgress', { current: currentStep, total: totalSteps })}
        </span>
        <span className="text-muted-foreground">
          {t('createDeal.progressComplete', { percent: Math.round(progress) })}
        </span>
      </div>
      <Progress value={progress} className="h-2" />
    </div>
  )
}
