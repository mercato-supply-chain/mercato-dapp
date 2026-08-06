import type { LeadRole } from '@/lib/events/lead-schema'

export type RoleFormFieldKey =
  | 'formStep2Subtitle'
  | 'formStep3Title'
  | 'formStep3Subtitle'
  | 'formStep4Title'
  | 'formStep4Subtitle'
  | 'currentFinancing'
  | 'currentFinancingPlaceholder'
  | 'fundingTimeline'
  | 'fundingTimelinePlaceholder'
  | 'supplierPaymentProcess'
  | 'supplierPaymentProcessPlaceholder'
  | 'biggestChallenge'
  | 'biggestChallengePlaceholder'
  | 'lastFinancingExperience'
  | 'lastFinancingExperiencePlaceholder'

export function roleFormCopyKey(role: LeadRole, field: RoleFormFieldKey) {
  return `events.roleQuestions.${role}.${field}`
}
