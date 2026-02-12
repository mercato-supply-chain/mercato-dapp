'use client'

import { Progress } from '@/components/ui/progress'
import type { FormStep } from '../types'

interface StepProgressProps {
  currentStep: FormStep
  totalSteps?: number
}

export function StepProgress({
  currentStep,
  totalSteps = 3,
}: StepProgressProps) {
  const progress = (currentStep / totalSteps) * 100

  return (
    <div className="mb-8">
      <div className="mb-3 flex items-center justify-between text-sm">
        <span className="font-medium">
          Step {currentStep} of {totalSteps}
        </span>
        <span className="text-muted-foreground">
          {Math.round(progress)}% Complete
        </span>
      </div>
      <Progress value={progress} className="h-2" />
    </div>
  )
}
