import { z } from 'zod'

export const leadRoleValues = ['pyme', 'investor', 'supplier', 'other'] as const

export type LeadRole = (typeof leadRoleValues)[number]

export const leadSubmissionSchema = z.object({
  event_slug: z.string().min(1).max(100),
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(254),
  company: z.string().trim().min(1).max(200),
  role: z.enum(leadRoleValues),
  country: z.string().trim().min(1).max(100),
  phone: z.string().trim().max(40).optional().or(z.literal('')),
  current_financing: z.string().trim().min(1).max(500),
  funding_timeline: z.string().trim().min(1).max(200),
  supplier_payment_process: z.string().trim().min(1).max(1000),
  biggest_challenge: z.string().trim().min(1).max(2000),
  last_financing_experience: z.string().trim().max(2000).optional().or(z.literal('')),
  consent: z.literal(true, {
    errorMap: () => ({ message: 'Consent is required' }),
  }),
  locale: z.string().max(10).optional(),
  utm_source: z.string().max(200).optional(),
  utm_medium: z.string().max(200).optional(),
  utm_campaign: z.string().max(200).optional(),
  referrer: z.string().max(2000).optional(),
})

export type LeadSubmission = z.infer<typeof leadSubmissionSchema>

export type LeadRecord = LeadSubmission & {
  id: string
  created_at: string
}
