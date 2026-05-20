'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Building2, Check, Loader2, Package, TrendingUp, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { WalletStatusCard } from '@/components/wallet/wallet-status-card'
import { LATAM_COUNTRIES, SECTORS } from '@/lib/constants'
import type { OnboardingUserType } from '@/lib/profile/onboarding'
import { createClient } from '@/lib/supabase/client'
import { useI18n } from '@/lib/i18n/provider'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

const STEPS = ['role', 'profile', 'done'] as const
type Step = (typeof STEPS)[number]

type SettingsOnboardingProps = {
  userId: string
  email: string
  initialFullName?: string
}

export function SettingsOnboarding({ userId, email, initialFullName = '' }: SettingsOnboardingProps) {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const { t, messages } = useI18n()

  const [step, setStep] = useState<Step>('role')
  const [userType, setUserType] = useState<OnboardingUserType | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [form, setForm] = useState({
    full_name: initialFullName,
    company_name: '',
    phone: '',
    country: '',
    sector: '',
    bio: '',
  })

  const stepIndex = STEPS.indexOf(step)
  const roles: {
    value: OnboardingUserType
    label: string
    hint: string
    Icon: typeof Package
  }[] = [
    { value: 'pyme', label: t('auth.rolePyme'), hint: t('auth.rolePymeHint'), Icon: Package },
    { value: 'investor', label: t('auth.roleInvestor'), hint: t('auth.roleInvestorHint'), Icon: TrendingUp },
    { value: 'supplier', label: t('auth.roleSupplier'), hint: t('auth.roleSupplierHint'), Icon: Users },
  ]

  const requiresCompany = userType === 'pyme' || userType === 'supplier'
  const requiresGeo = userType === 'pyme' || userType === 'supplier'

  const validateProfile = () => {
    if (!form.full_name.trim()) {
      toast.error(t('settings.onboarding.fullNameRequired'))
      return false
    }
    if (requiresCompany && !form.company_name.trim()) {
      toast.error(t('settings.onboarding.companyRequired'))
      return false
    }
    if (requiresGeo && !form.country) {
      toast.error(t('settings.onboarding.countryRequired'))
      return false
    }
    if (requiresGeo && !form.sector) {
      toast.error(t('settings.onboarding.sectorRequired'))
      return false
    }
    return true
  }

  const saveProfile = async () => {
    if (!userType) return false
    setIsSaving(true)
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          user_type: userType,
          full_name: form.full_name.trim(),
          contact_name: form.full_name.trim(),
          company_name: form.company_name.trim() || null,
          phone: form.phone.trim() || null,
          country: form.country || null,
          sector: form.sector || null,
          bio: form.bio.trim() || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', userId)

      if (error) throw error
      return true
    } catch (err) {
      console.error(err)
      toast.error(t('settings.profileError'))
      return false
    } finally {
      setIsSaving(false)
    }
  }

  const handleContinueFromRole = () => {
    if (!userType) {
      toast.error(t('settings.onboarding.roleRequired'))
      return
    }
    setStep('profile')
  }

  const handleFinish = async () => {
    if (!validateProfile()) return
    const ok = await saveProfile()
    if (!ok) return
    setStep('done')
  }

  const handleGoToDashboard = () => {
    router.push(userType === 'supplier' ? '/dashboard/supplier-profile' : '/dashboard')
    router.refresh()
  }

  return (
    <div className="mx-auto w-full min-w-0 max-w-3xl space-y-8">
      <div className="relative overflow-hidden rounded-2xl border border-brand-light/30 bg-gradient-to-br from-brand-ultra via-background to-brand-pale/40 px-6 py-8 text-center shadow-sm dark:from-brand-dark/25 dark:via-background dark:to-transparent">
        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
          {t('settings.onboarding.eyebrow')}
        </p>
        <h1 className="mt-2 font-display text-3xl font-normal tracking-tight md:text-4xl">
          {t('settings.onboarding.title')}
        </h1>
        <p className="mx-auto mt-2 max-w-lg text-muted-foreground">{t('settings.onboarding.subtitle')}</p>
        <p className="mt-3 inline-flex rounded-full border border-border/70 bg-card/80 px-3 py-1 text-sm text-muted-foreground">
          {email}
        </p>
      </div>

      <ol className="flex items-center justify-center gap-2 sm:gap-4" aria-label={t('settings.onboarding.progressLabel')}>
        {[
          t('settings.onboarding.stepRole'),
          t('settings.onboarding.stepProfile'),
          t('settings.onboarding.stepDone'),
        ].map((label, i) => {
          const active = i === stepIndex
          const done = i < stepIndex
          return (
            <li key={label} className="flex items-center gap-2">
              <span
                className={cn(
                  'flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold',
                  done && 'bg-primary text-primary-foreground',
                  active && !done && 'bg-primary/15 text-primary ring-2 ring-primary/30',
                  !active && !done && 'bg-muted text-muted-foreground',
                )}
              >
                {done ? <Check className="h-4 w-4" aria-hidden /> : i + 1}
              </span>
              <span className={cn('hidden text-sm sm:inline', active ? 'font-medium' : 'text-muted-foreground')}>
                {label}
              </span>
              {i < 2 && <span className="hidden h-px w-6 bg-border sm:block" aria-hidden />}
            </li>
          )
        })}
      </ol>

      {step === 'role' && (
        <section className="rounded-2xl border border-border/70 bg-card p-6 shadow-sm">
          <h2 className="text-lg font-semibold">{t('settings.onboarding.roleHeading')}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{t('settings.onboarding.roleDescription')}</p>
          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            {roles.map(({ value, label, hint, Icon }) => {
              const selected = userType === value
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => setUserType(value)}
                  className={cn(
                    'flex flex-col items-center gap-2 rounded-2xl border-2 px-3 py-5 text-center transition-colors',
                    selected
                      ? 'border-primary bg-primary/10'
                      : 'border-border bg-muted/20 hover:border-primary/40 hover:bg-muted/40',
                  )}
                >
                  <Icon className="h-7 w-7 shrink-0" aria-hidden />
                  <span className="text-sm font-semibold">{label}</span>
                  <span className="text-xs text-muted-foreground">{hint}</span>
                </button>
              )
            })}
          </div>
          <Button className="mt-6 w-full rounded-full" size="lg" onClick={handleContinueFromRole}>
            {t('settings.onboarding.continue')}
          </Button>
        </section>
      )}

      {step === 'profile' && userType && (
        <section className="space-y-6">
          <div className="rounded-2xl border border-border/70 bg-card p-6 shadow-sm">
            <div className="mb-4 flex items-center gap-2">
              <Building2 className="h-5 w-5 text-muted-foreground" aria-hidden />
              <div>
                <h2 className="text-lg font-semibold">{t('settings.onboarding.profileHeading')}</h2>
                <p className="text-sm text-muted-foreground">
                  {t(`settings.onboarding.profileHint.${userType}` as 'settings.onboarding.profileHint.pyme')}
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="onb-full-name">{t('settings.fullNameLabel')}</Label>
                <Input
                  id="onb-full-name"
                  value={form.full_name}
                  onChange={(e) => setForm((p) => ({ ...p, full_name: e.target.value }))}
                  placeholder={t('settings.fullNamePlaceholder')}
                  autoComplete="name"
                />
              </div>

              {(userType === 'pyme' || userType === 'supplier' || userType === 'investor') && (
                <div className="space-y-2">
                  <Label htmlFor="onb-company">
                    {t('settings.companyNameLabel')}
                    {userType === 'investor' && (
                      <span className="ml-1 font-normal text-muted-foreground">
                        ({t('settings.onboarding.optional')})
                      </span>
                    )}
                  </Label>
                  <Input
                    id="onb-company"
                    value={form.company_name}
                    onChange={(e) => setForm((p) => ({ ...p, company_name: e.target.value }))}
                    placeholder={t('settings.companyNamePlaceholder')}
                    autoComplete="organization"
                  />
                </div>
              )}

              {requiresGeo && (
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="onb-country">{t('settings.countryLabel')}</Label>
                    <Select value={form.country || undefined} onValueChange={(v) => setForm((p) => ({ ...p, country: v }))}>
                      <SelectTrigger id="onb-country">
                        <SelectValue placeholder={t('settings.countryPlaceholder')} />
                      </SelectTrigger>
                      <SelectContent>
                        {LATAM_COUNTRIES.map((c) => {
                          const label =
                            messages.geo.countries[c.value as keyof typeof messages.geo.countries] ?? c.label
                          return (
                            <SelectItem key={c.value} value={c.value}>
                              {label}
                            </SelectItem>
                          )
                        })}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="onb-sector">{t('settings.sectorLabel')}</Label>
                    <Select value={form.sector || undefined} onValueChange={(v) => setForm((p) => ({ ...p, sector: v }))}>
                      <SelectTrigger id="onb-sector">
                        <SelectValue placeholder={t('settings.sectorPlaceholder')} />
                      </SelectTrigger>
                      <SelectContent>
                        {SECTORS.map((s) => {
                          const label =
                            messages.geo.sectors[s.value as keyof typeof messages.geo.sectors] ?? s.label
                          return (
                            <SelectItem key={s.value} value={s.value}>
                              {label}
                            </SelectItem>
                          )
                        })}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="onb-phone">
                  {t('settings.phoneLabel')}
                  <span className="ml-1 font-normal text-muted-foreground">({t('settings.onboarding.optional')})</span>
                </Label>
                <Input
                  id="onb-phone"
                  type="tel"
                  value={form.phone}
                  onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
                  placeholder={t('settings.phonePlaceholder')}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="onb-bio">
                  {t('settings.bioLabel')}
                  <span className="ml-1 font-normal text-muted-foreground">({t('settings.onboarding.optional')})</span>
                </Label>
                <Textarea
                  id="onb-bio"
                  value={form.bio}
                  onChange={(e) => setForm((p) => ({ ...p, bio: e.target.value }))}
                  placeholder={t('settings.bioPlaceholder')}
                  rows={3}
                  className="resize-none"
                />
              </div>

              {userType === 'supplier' && (
                <p className="rounded-xl border border-amber-500/25 bg-amber-50/50 p-3 text-sm text-muted-foreground dark:bg-amber-950/20">
                  {t('settings.onboarding.supplierCatalogHint')}
                </p>
              )}
            </div>

            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
              <Button type="button" variant="ghost" className="rounded-full" onClick={() => setStep('role')}>
                {t('settings.onboarding.back')}
              </Button>
              <Button className="rounded-full" size="lg" onClick={handleFinish} disabled={isSaving}>
                {isSaving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                    {t('common.saving')}
                  </>
                ) : (
                  t('settings.onboarding.finish')
                )}
              </Button>
            </div>
          </div>

          <WalletStatusCard />
        </section>
      )}

      {step === 'done' && userType && (
        <section className="rounded-2xl border border-emerald-500/25 bg-emerald-50/40 p-8 text-center shadow-sm dark:bg-emerald-950/20">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/15">
            <Check className="h-7 w-7 text-emerald-700 dark:text-emerald-400" aria-hidden />
          </div>
          <h2 className="text-xl font-semibold">{t('settings.onboarding.doneTitle')}</h2>
          <p className="mt-2 text-sm text-muted-foreground">{t('settings.onboarding.doneDescription')}</p>
          <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
            <Button className="rounded-full" size="lg" onClick={handleGoToDashboard}>
              {userType === 'supplier'
                ? t('settings.onboarding.goSupplierSetup')
                : t('settings.onboarding.goDashboard')}
            </Button>
            {userType === 'supplier' && (
              <Button variant="outline" className="rounded-full" asChild>
                <Link href="/dashboard">{t('settings.onboarding.skipToDashboard')}</Link>
              </Button>
            )}
          </div>
        </section>
      )}
    </div>
  )
}
