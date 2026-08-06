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
import { leadRoleValues } from '@/lib/events/lead-schema'
import type { EventConfig } from '@/lib/events/config'
import { EventThankYou } from '@/components/events/event-thank-you'

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

export function EventDiscoveryForm({ event }: EventDiscoveryFormProps) {
  const { t, locale } = useI18n()
  const searchParams = useSearchParams()
  const { ref, visible } = useReveal(0.1)
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
  })

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

  return (
    <section id="event-discovery-form" className="scroll-mt-20 py-16 md:py-24">
      <div
        ref={ref}
        className={cn(
          'container mx-auto max-w-2xl px-4 transition-all duration-700',
          visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6',
        )}
      >
        {submitted ? (
          <EventThankYou />
        ) : (
          <>
            <div className="mb-8 text-center">
              <h2 className="font-display mb-3 text-3xl font-normal tracking-tight md:text-4xl">
                {t('events.common.formTitle')}
              </h2>
              <p className="text-muted-foreground">{t('events.common.formSubtitle')}</p>
            </div>

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 rounded-2xl border border-border/70 bg-card p-6 md:p-8">
                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('events.common.name')}</FormLabel>
                        <FormControl>
                          <Input placeholder={t('events.common.namePlaceholder')} {...field} />
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
                          <Input type="email" placeholder={t('events.common.emailPlaceholder')} {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="company"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('events.common.company')}</FormLabel>
                        <FormControl>
                          <Input placeholder={t('events.common.companyPlaceholder')} {...field} />
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
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
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

                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="country"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('events.common.country')}</FormLabel>
                        <FormControl>
                          <Input placeholder={t('events.common.countryPlaceholder')} {...field} />
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
                          <Input placeholder={t('events.common.phonePlaceholder')} {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="current_financing"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('events.common.currentFinancing')}</FormLabel>
                      <FormControl>
                        <Textarea
                          rows={3}
                          placeholder={t('events.common.currentFinancingPlaceholder')}
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
                      <FormLabel>{t('events.common.fundingTimeline')}</FormLabel>
                      <FormControl>
                        <Input placeholder={t('events.common.fundingTimelinePlaceholder')} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="supplier_payment_process"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('events.common.supplierPaymentProcess')}</FormLabel>
                      <FormControl>
                        <Textarea
                          rows={3}
                          placeholder={t('events.common.supplierPaymentProcessPlaceholder')}
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
                      <FormLabel>{t('events.common.biggestChallenge')}</FormLabel>
                      <FormControl>
                        <Textarea
                          rows={4}
                          placeholder={t('events.common.biggestChallengePlaceholder')}
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
                      <FormLabel>{t('events.common.lastFinancingExperience')}</FormLabel>
                      <FormControl>
                        <Textarea
                          rows={4}
                          placeholder={t('events.common.lastFinancingExperiencePlaceholder')}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

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

                {submitError ? (
                  <p className="text-sm text-destructive" role="alert">
                    {submitError}
                  </p>
                ) : null}

                <Button
                  type="submit"
                  size="lg"
                  className="h-12 w-full rounded-full"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? t('events.common.submitting') : t('events.common.submit')}
                </Button>
              </form>
            </Form>
          </>
        )}
      </div>
    </section>
  )
}
