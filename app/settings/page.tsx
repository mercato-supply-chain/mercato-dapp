import { redirect } from 'next/navigation'

import { createClient } from '@/lib/supabase/server'
import { Navigation } from '@/components/navigation'
import { SettingsOnboarding } from '@/components/settings/settings-onboarding'
import { SettingsPageContent } from '@/components/settings/settings-page-content'
import type { ProfileFormState } from '@/components/settings/settings-profile-form'
import { needsOnboarding } from '@/lib/profile/onboarding'

// Only the columns the settings/onboarding forms consume.
const PROFILE_COLUMNS =
  'user_type, full_name, contact_name, company_name, phone, address, bio, country, sector, avatar_url, stake_amount'

const EMPTY_FORM: ProfileFormState = {
  full_name: '',
  company_name: '',
  phone: '',
  address: '',
  bio: '',
  country: '',
  sector: '',
  avatar_url: '',
}

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ onboarding?: string | string[] }>
}) {
  const [{ onboarding }, supabase] = await Promise.all([searchParams, createClient()])

  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Redirect before any client boundary renders.
  if (!user) redirect('/auth/login')

  // Sequential by necessity: the profile query depends on user.id.
  const { data: row, error: profileError } = await supabase
    .from('profiles')
    .select(PROFILE_COLUMNS)
    .eq('id', user.id)
    .single()

  // PGRST116 = no rows found, expected for a brand-new user pre-onboarding.
  // Anything else is a real failure and should not be swallowed silently.
  if (profileError && profileError.code !== 'PGRST116') {
    console.error('Failed to load profile for settings page', profileError)
  }

  const initialForm: ProfileFormState = row
    ? {
        full_name: (row.full_name as string) || (row.contact_name as string) || '',
        company_name: (row.company_name as string) || '',
        phone: (row.phone as string) || '',
        address: (row.address as string) || '',
        bio: (row.bio as string) || '',
        country: (row.country as string) || '',
        sector: (row.sector as string) || '',
        avatar_url: (row.avatar_url as string) || '',
      }
    : EMPTY_FORM

  const initialStake = String(Number(row?.stake_amount ?? 0))
  const userType = String(row?.user_type ?? 'pyme')

  const forceOnboarding = (Array.isArray(onboarding) ? onboarding[0] : onboarding) === '1'

  const showOnboarding =
    forceOnboarding || needsOnboarding(row?.user_type as string | null | undefined)

  return (
    <div className="flex min-h-screen flex-col">
      <Navigation />
      <div className="container mx-auto min-w-0 px-4 py-8">
        {showOnboarding ? (
          <SettingsOnboarding
            userId={user.id}
            email={user.email ?? ''}
            initialFullName={initialForm.full_name}
          />
        ) : (
          <SettingsPageContent
            userId={user.id}
            email={user.email ?? ''}
            userType={userType}
            initialForm={initialForm}
            initialStake={initialStake}
          />
        )}
      </div>
    </div>
  )
}
