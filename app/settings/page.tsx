'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Navigation } from '@/components/navigation'
import { SettingsOnboarding } from '@/components/settings/settings-onboarding'
import { SettingsPageContent } from '@/components/settings/settings-page-content'
import type { ProfileFormState } from '@/components/settings/settings-profile-form'
import { needsOnboarding } from '@/lib/profile/onboarding'

const EMPTY_FORM: ProfileFormState = {
  full_name: '',
  company_name: '',
  phone: '',
  address: '',
  bio: '',
  country: '',
  sector: '',
}

function SettingsPageInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()
  const [isLoading, setIsLoading] = useState(true)
  const [user, setUser] = useState<{ id: string; email?: string } | null>(null)
  const [profile, setProfile] = useState<Record<string, unknown> | null>(null)
  const [formData, setFormData] = useState<ProfileFormState>(EMPTY_FORM)
  const [stakeAmount, setStakeAmount] = useState('0')

  const forceOnboarding = searchParams.get('onboarding') === '1'
  const showOnboarding =
    forceOnboarding || needsOnboarding(profile?.user_type as string | null | undefined)

  useEffect(() => {
    const load = async () => {
      const {
        data: { user: u },
      } = await supabase.auth.getUser()
      if (!u) {
        router.push('/auth/login')
        return
      }
      setUser(u)
      const { data: row } = await supabase.from('profiles').select('*').eq('id', u.id).single()
      if (row) {
        setProfile(row)
        setStakeAmount(String(Number(row.stake_amount ?? 0)))
        setFormData({
          full_name: (row.full_name as string) || (row.contact_name as string) || '',
          company_name: (row.company_name as string) || '',
          phone: (row.phone as string) || '',
          address: (row.address as string) || '',
          bio: (row.bio as string) || '',
          country: (row.country as string) || '',
          sector: (row.sector as string) || '',
        })
      }
      setIsLoading(false)
    }
    void load()
  }, [router, supabase])

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" aria-hidden />
      </div>
    )
  }

  if (!user) return null

  return (
    <div className="container mx-auto min-w-0 px-4 py-8">
      {showOnboarding ? (
        <SettingsOnboarding
          userId={user.id}
          email={user.email ?? ''}
          initialFullName={formData.full_name}
        />
      ) : (
        <SettingsPageContent
          userId={user.id}
          email={user.email ?? ''}
          userType={String(profile?.user_type ?? 'pyme')}
          initialForm={formData}
          initialStake={stakeAmount}
        />
      )}
    </div>
  )
}

export default function SettingsPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <Navigation />
      <Suspense
        fallback={
          <div className="flex flex-1 items-center justify-center py-24">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" aria-hidden />
          </div>
        }
      >
        <SettingsPageInner />
      </Suspense>
    </div>
  )
}
