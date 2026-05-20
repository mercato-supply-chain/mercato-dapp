'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Wallet } from 'lucide-react'
import { WalletStatusCard } from '@/components/wallet/wallet-status-card'
import { SettingsAccountCard } from './settings-account-card'
import { SettingsHero } from './settings-hero'
import { SettingsProfileForm, type ProfileFormState } from './settings-profile-form'
import { SettingsStakeCard } from './settings-stake-card'
import { createClient } from '@/lib/supabase/client'
import { useI18n } from '@/lib/i18n/provider'
import { toast } from 'sonner'

type SettingsPageContentProps = {
  userId: string
  email: string
  userType: string
  initialForm: ProfileFormState
  initialStake: string
}

export function SettingsPageContent({
  userId,
  email,
  userType,
  initialForm,
  initialStake,
}: SettingsPageContentProps) {
  const router = useRouter()
  const supabase = createClient()
  const { t } = useI18n()
  const [formData, setFormData] = useState(initialForm)
  const [stakeAmount, setStakeAmount] = useState(initialStake)
  const [isSaving, setIsSaving] = useState(false)
  const [isSavingStake, setIsSavingStake] = useState(false)

  const displayName = formData.full_name.trim() || email.split('@')[0] || 'Account'

  const handleSaveStake = async () => {
    const amount = Number(stakeAmount)
    if (!Number.isFinite(amount) || amount < 0) {
      toast.error(t('settings.stakeInvalid'))
      return
    }
    setIsSavingStake(true)
    try {
      const response = await fetch('/api/reputation/stake', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount }),
      })
      const result = (await response.json()) as { stakeAmount?: number; error?: string }
      if (!response.ok) throw new Error(result.error || t('settings.stakeUpdateFailed'))
      setStakeAmount(String(Number(result.stakeAmount ?? 0)))
      toast.success(t('settings.stakeSuccess'))
    } catch (error) {
      console.error(error)
      toast.error(t('settings.stakeError'))
    } finally {
      setIsSavingStake(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSaving(true)
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: formData.full_name,
          contact_name: formData.full_name,
          company_name: formData.company_name,
          phone: formData.phone,
          address: formData.address,
          bio: formData.bio,
          country: formData.country || null,
          sector: formData.sector || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', userId)
      if (error) throw error
      toast.success(t('settings.profileSuccess'))
    } catch (error) {
      console.error(error)
      toast.error(t('settings.profileError'))
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="mx-auto w-full min-w-0 max-w-6xl space-y-8">
      <SettingsHero
        displayName={displayName}
        email={email}
        userType={userType}
        companyName={formData.company_name || null}
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-6">
          <section className="rounded-2xl border border-border/70 bg-card shadow-sm">
            <div className="border-b border-border/60 px-5 py-4 sm:px-6">
              <h2 className="font-semibold">{t('settings.sectionProfile')}</h2>
              <p className="mt-0.5 text-sm text-muted-foreground">{t('settings.sectionProfileDesc')}</p>
            </div>
            <div className="px-5 py-5 sm:px-6">
              <SettingsProfileForm
                userType={userType}
                formData={formData}
                onChange={(patch) => setFormData((prev) => ({ ...prev, ...patch }))}
                isSaving={isSaving}
                onSubmit={handleSubmit}
                onCancel={() => router.push('/dashboard')}
              />
            </div>
          </section>
        </div>

        <aside className="min-w-0 space-y-4">
          <SettingsAccountCard email={email} userType={userType} />

          <section className="rounded-2xl border border-border/70 bg-card shadow-sm">
            <div className="flex items-start gap-3 border-b border-border/60 px-5 py-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-500/15 text-sky-700 dark:text-sky-300">
                <Wallet className="h-5 w-5" aria-hidden />
              </div>
              <div>
                <h2 className="font-semibold leading-snug">{t('settings.sectionWallet')}</h2>
                <p className="mt-0.5 text-sm text-muted-foreground">{t('settings.sectionWalletDesc')}</p>
              </div>
            </div>
            <div className="p-4">
              <WalletStatusCard />
            </div>
          </section>

          <SettingsStakeCard
            stakeAmount={stakeAmount}
            onStakeChange={setStakeAmount}
            isSaving={isSavingStake}
            onSave={handleSaveStake}
          />
        </aside>
      </div>
    </div>
  )
}
