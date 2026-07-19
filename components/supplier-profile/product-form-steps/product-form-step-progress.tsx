'use client'

import { Progress } from '@/components/ui/progress'
import { useI18n } from '@/lib/i18n/provider'
import { TOTAL_STEPS, type ProductFormStep } from './types'

export function ProductFormStepProgress({ currentStep }: { currentStep: ProductFormStep }) {
  const { t } = useI18n()
  const progress = (currentStep / TOTAL_STEPS) * 100

  return (
    <div className="mb-5">
      <div className="mb-2 flex items-center justify-between text-sm">
        <span className="font-medium">
          {t('supplierProfile.wizardStepProgress', {
            current: currentStep,
            total: TOTAL_STEPS,
          })}
        </span>
        <span className="text-muted-foreground">
          {t('supplierProfile.wizardProgressComplete', {
            percent: Math.round(progress),
          })}
        </span>
      </div>
      <Progress value={progress} className="h-2" />
    </div>
  )
}
