'use client'

import { useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { useReveal } from '@/hooks/use-scroll-motion'
import { useI18n } from '@/lib/i18n/provider'
import { leadRoleValues, type LeadRole } from '@/lib/events/lead-schema'
import type { EventConfig } from '@/lib/events/config'
import { EventThankYou } from '@/components/events/event-thank-you'
import { roleFormCopyKey, type RoleFormFieldKey } from '@/lib/events/role-form-copy'
import { ArrowLeft, ArrowRight } from 'lucide-react'

const formSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(254),
  company: z.string().trim().min(1).max(200),
  role: z.enum(leadRoleValues),
  country: z.string().trim().min(1).max(100),
  phone: z.string().trim().max(40).optional(),
  current_financing: z.string().trim().min(1).max(500),
  funding_timeline: z.string().trim().min(1).max(200),
  supplier_payment_process: z.string().trim().min(1).max(1000),
  biggest_challenge: z.string().trim().min(1).max(2000),
  last_financing_experience: z.string().trim().max(2000).optional(),
  consent: z.boolean().refine((value) => value === true),
})

type FormValues = z.infer<typeof formSchema>

type EventDiscoveryFormProps = {
  event: EventConfig
}

const ROLE_LABEL_KEYS: Record<(typeof leadRoleValues)[number], string> = {
  pyme: 'events.common.rolePyme',
  investor: 'events.common.roleInvestor',
  supplier: 'events.common.roleSupplier',
  other: 'events.common.roleOther',
}

const STEP_FIELDS: (keyof FormValues)[][] = [
  ['name', 'email', 'role'],
  ['company', 'country', 'phone'],
  ['current_financing', 'funding_timeline'],
  ['supplier_payment_process', 'biggest_challenge', 'last_financing_experience'],
  ['consent'],
]

const TOTAL_STEPS = STEP_FIELDS.length

export function EventDiscoveryForm({ event }: EventDiscoveryFormProps) {
  const { t, locale } = useI18n()
  const searchParams = useSearchParams()
  const { ref, visible } = useReveal(0.1)
  const [step, setStep] = useState(0)
  const [submitted, setSubmitted] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const defaultValues = useMemo<FormValues>(
    () => ({
      name: '',
      email: '',
      company: '',
      role: 'pyme',
      country: event.defaultCountry ?? '',
      phone: '',
      current_financing: '',
      funding_timeline: '',
      supplier_payment_process: '',
      biggest_challenge: '',
      last_financing_experience: '',
      consent: false,
    }),
    [event.defaultCountry],
  )

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues,
    mode: 'onTouched',
  })

  const role = form.watch('role') as LeadRole

  const rq = (field: RoleFormFieldKey) => t(roleFormCopyKey(role, field))

  const stepTitle =
    step === 0
      ? t('events.common.formStep1Title')
      : step === 1
        ? t('events.common.formStep2Title')
        : step === 2
          ? rq('formStep3Title')
          : step === 3
            ? rq('formStep4Title')
            : t('events.common.formStep5Title')

  const stepSubtitle =
    step === 0
      ? t('events.common.formStep1Subtitle')
      : step === 1
        ? rq('formStep2Subtitle')
        : step === 2
          ? rq('formStep3Subtitle')
          : step === 3
            ? rq('formStep4Subtitle')
            : t('events.common.formStep5Subtitle')

  const goNext = async () => {
    const fields = STEP_FIELDS[step]
    const valid = await form.trigger(fields, { shouldFocus: true })
    if (!valid) return
    setStep((current) => Math.min(current + 1, TOTAL_STEPS - 1))
    setSubmitError(null)
  }

  const goBack = () => {
    setStep((current) => Math.max(current - 1, 0))
    setSubmitError(null)
  }

  const onSubmit = async (values: FormValues) => {
    setIsSubmitting(true)
    setSubmitError(null)

    try {
      const response = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event_slug: event.slug,
          ...values,
          consent: true,
          locale,
          utm_source: searchParams.get('utm_source') ?? undefined,
          utm_medium: searchParams.get('utm_medium') ?? undefined,
          utm_campaign: searchParams.get('utm_campaign') ?? undefined,
          referrer: typeof document !== 'undefined' ? document.referrer || undefined : undefined,
        }),
      })

      if (!response.ok) {
        throw new Error('submit_failed')
      }

      setSubmitted(true)
    } catch {
      setSubmitError(t('events.common.submitError'))
    } finally {
      setIsSubmitting(false)
    }
  }

  const isLastStep = step === TOTAL_STEPS - 1

  return (
    <section id="event-discovery-form" className="scroll-mt-16 py-12 md:py-20">
      <div
        ref={ref}
        className={cn(
          'container mx-auto max-w-lg px-4 transition-all duration-700 sm:max-w-xl',
          visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6',
        )}
      >
        {submitted ? (
          <EventThankYou />
        ) : (
          <>
            <div className="mb-6 text-center md:mb-8">
              <h2 className="font-display mb-2 text-2xl font-normal tracking-tight sm:text-3xl">
                {t('events.common.formTitle')}
              </h2>
              <p className="text-sm text-muted-foreground sm:text-base">
                {t('events.common.formSubtitle')}
              </p>
            </div>

            <div className="mb-6">
              <div className="mb-2 flex items-center justify-between text-xs font-medium text-muted-foreground">
                <span>{t('events.common.stepOf', { current: step + 1, total: TOTAL_STEPS })}</span>
                <span>{Math.round(((step + 1) / TOTAL_STEPS) * 100)}%</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-brand-mid transition-all duration-300"
                  style={{ width: `${((step + 1) / TOTAL_STEPS) * 100}%` }}
                />
              </div>
            </div>

            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(onSubmit)}
                className="rounded-2xl border border-border/70 bg-card p-4 shadow-sm sm:p-6"
              >
                <div className="mb-6 min-h-[12rem]">
                  <h3 className="mb-1 text-lg font-semibold">{stepTitle}</h3>
                  <p className="mb-5 text-sm text-muted-foreground">{stepSubtitle}</p>

                  {step === 0 ? (
                    <div className="space-y-4">
                      <FormField
                        control={form.control}
                        name="name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t('events.common.name')}</FormLabel>
                            <FormControl>
                              <Input
                                className="h-11"
                                autoComplete="name"
                                placeholder={t('events.common.namePlaceholder')}
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="email"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t('events.common.email')}</FormLabel>
                            <FormControl>
                              <Input
                                className="h-11"
                                type="email"
                                inputMode="email"
                                autoComplete="email"
                                placeholder={t('events.common.emailPlaceholder')}
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="role"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t('events.common.role')}</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger className="h-11">
                                  <SelectValue />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {leadRoleValues.map((role) => (
                                  <SelectItem key={role} value={role}>
                                    {t(ROLE_LABEL_KEYS[role])}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  ) : null}

                  {step === 1 ? (
                    <div className="space-y-4">
                      <FormField
                        control={form.control}
                        name="company"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t('events.common.company')}</FormLabel>
                            <FormControl>
                              <Input
                                className="h-11"
                                autoComplete="organization"
                                placeholder={t('events.common.companyPlaceholder')}
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="country"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t('events.common.country')}</FormLabel>
                            <FormControl>
                              <Input
                                className="h-11"
                                autoComplete="country-name"
                                placeholder={t('events.common.countryPlaceholder')}
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="phone"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t('events.common.phone')}</FormLabel>
                            <FormControl>
                              <Input
                                className="h-11"
                                type="tel"
                                inputMode="tel"
                                autoComplete="tel"
                                placeholder={t('events.common.phonePlaceholder')}
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  ) : null}

                  {step === 2 ? (
                    <div className="space-y-4">
                      <FormField
                        control={form.control}
                        name="current_financing"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{rq('currentFinancing')}</FormLabel>
                            <FormControl>
                              <Textarea
                                rows={4}
                                className="min-h-[6rem] resize-none"
                                placeholder={rq('currentFinancingPlaceholder')}
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="funding_timeline"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{rq('fundingTimeline')}</FormLabel>
                            <FormControl>
                              <Input
                                className="h-11"
                                placeholder={rq('fundingTimelinePlaceholder')}
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  ) : null}

                  {step === 3 ? (
                    <div className="space-y-4">
                      <FormField
                        control={form.control}
                        name="supplier_payment_process"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{rq('supplierPaymentProcess')}</FormLabel>
                            <FormControl>
                              <Textarea
                                rows={3}
                                className="min-h-[5rem] resize-none"
                                placeholder={rq('supplierPaymentProcessPlaceholder')}
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="biggest_challenge"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{rq('biggestChallenge')}</FormLabel>
                            <FormControl>
                              <Textarea
                                rows={3}
                                className="min-h-[5rem] resize-none"
                                placeholder={rq('biggestChallengePlaceholder')}
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="last_financing_experience"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{rq('lastFinancingExperience')}</FormLabel>
                            <FormControl>
                              <Textarea
                                rows={3}
                                className="min-h-[5rem] resize-none"
                                placeholder={rq('lastFinancingExperiencePlaceholder')}
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  ) : null}

                  {step === 4 ? (
                    <FormField
                      control={form.control}
                      name="consent"
                      render={({ field }) => (
                        <FormItem>
                          <div className="flex items-start gap-3 rounded-xl border border-border/60 bg-muted/30 p-4">
                            <FormControl>
                              <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                            </FormControl>
                            <div className="space-y-1 leading-none">
                              <Label className="text-sm font-normal leading-relaxed">
                                {t('events.common.consent')}
                              </Label>
                              <FormMessage />
                            </div>
                          </div>
                        </FormItem>
                      )}
                    />
                  ) : null}
                </div>

                {submitError ? (
                  <p className="mb-4 text-sm text-destructive" role="alert">
                    {submitError}
                  </p>
                ) : null}

                <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
                  <Button
                    type="button"
                    variant="ghost"
                    className="h-11 rounded-full"
                    onClick={goBack}
                    disabled={step === 0 || isSubmitting}
                  >
                    <ArrowLeft className="mr-2 h-4 w-4" aria-hidden />
                    {t('events.common.stepBack')}
                  </Button>

                  {isLastStep ? (
                    <Button
                      type="submit"
                      size="lg"
                      className="h-11 flex-1 rounded-full sm:flex-none sm:px-8"
                      disabled={isSubmitting}
                    >
                      {isSubmitting ? t('events.common.submitting') : t('events.common.submit')}
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      size="lg"
                      className="h-11 flex-1 rounded-full sm:flex-none sm:px-8"
                      onClick={goNext}
                    >
                      {t('events.common.stepNext')}
                      <ArrowRight className="ml-2 h-4 w-4" aria-hidden />
                    </Button>
                  )}
                </div>
              </form>
            </Form>
          </>
        )}
      </div>
    </section>
  )
}
