'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  type CompanyFormState,
  type SupplierCompany,
} from '@/lib/supplier-profile/types'
import { useI18n } from '@/lib/i18n/provider'
import { toast } from 'sonner'

const SUPPLIER_COMPANY_SELECT =
  'id, company_name, bio, country, sector, phone, logo_url' as const

function logSupabaseError(label: string, err: unknown) {
  const e = err as { message?: string; details?: string; hint?: string; code?: string }
  console.error(label, e?.message ?? err, {
    code: e?.code,
    details: e?.details,
    hint: e?.hint,
  })
}

export function useSupplierCompanies() {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const { t } = useI18n()

  const [isLoading, setIsLoading] = useState(true)
  const [isSavingBio, setIsSavingBio] = useState(false)
  const [user, setUser] = useState<{ id: string } | null>(null)
  const [companies, setCompanies] = useState<SupplierCompany[]>([])
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null)
  const [companyForm, setCompanyForm] = useState<CompanyFormState>({
    bio: '',
    country: '',
    sector: '',
    phone: '',
    logo_url: '',
  })

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

      const { data: profileData } = await supabase.from('profiles').select('user_type').eq('id', u.id).single()
      if (profileData?.user_type !== 'supplier') {
        router.push('/dashboard')
        return
      }

      const { data: companiesData, error: companiesError } = await supabase
        .from('supplier_companies')
        .select(SUPPLIER_COMPANY_SELECT)
        .eq('owner_id', u.id)
        .order('company_name')

      if (companiesError) {
        logSupabaseError('Error loading supplier companies:', companiesError)
        toast.error(t('supplierProfile.toastLoadCompaniesFail'))
      }

      const companiesList = (companiesData ?? []) as SupplierCompany[]
      setCompanies(companiesList)
      if (companiesList.length > 0) {
        setSelectedCompanyId((prev) => prev || companiesList[0].id)
      }
      setIsLoading(false)
    }
    void load()
  }, [router, supabase, t])

  useEffect(() => {
    if (!selectedCompanyId) return
    const company = companies.find((c) => c.id === selectedCompanyId)
    setCompanyForm({
      bio: company?.bio ?? '',
      country: company?.country ?? '',
      sector: company?.sector ?? '',
      phone: company?.phone ?? '',
      logo_url: company?.logo_url ?? '',
    })
  }, [selectedCompanyId, companies])

  const selectedCompany = useMemo(
    () => companies.find((c) => c.id === selectedCompanyId) ?? null,
    [companies, selectedCompanyId],
  )

  const handleSaveCompany = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user || !selectedCompanyId) return
    setIsSavingBio(true)
    try {
      const { error } = await supabase
        .from('supplier_companies')
        .update({
          bio: companyForm.bio,
          country: companyForm.country || null,
          sector: companyForm.sector || null,
          phone: companyForm.phone.trim() || null,
          logo_url: companyForm.logo_url || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', selectedCompanyId)
        .eq('owner_id', user.id)
      if (error) throw error
      setCompanies((prev) =>
        prev.map((c) =>
          c.id === selectedCompanyId
            ? {
                ...c,
                bio: companyForm.bio,
                country: companyForm.country || null,
                sector: companyForm.sector || null,
                phone: companyForm.phone.trim() || null,
                logo_url: companyForm.logo_url || null,
              }
            : c,
        ),
      )
      toast.success(t('supplierProfile.toastDetailsSaved'))
    } catch (err) {
      logSupabaseError('Error saving supplier company:', err)
      toast.error(t('supplierProfile.toastSaveBioFail'))
    } finally {
      setIsSavingBio(false)
    }
  }

  const createCompany = async (payload: {
    company_name: string
    country: string
    sector: string
    phone: string
  }) => {
    if (!user || !payload.company_name.trim()) return false
    const { data, error } = await supabase
      .from('supplier_companies')
      .insert({
        owner_id: user.id,
        company_name: payload.company_name.trim(),
        country: payload.country || null,
        sector: payload.sector || null,
        phone: payload.phone.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .select(SUPPLIER_COMPANY_SELECT)
      .single()
    if (error) {
      logSupabaseError('Error creating supplier company:', error)
      throw error
    }
    const company = data as SupplierCompany
    setCompanies((prev) => [...prev, company])
    setSelectedCompanyId(company.id)
    return true
  }

  return {
    isLoading,
    isSavingBio,
    user,
    companies,
    selectedCompanyId,
    setSelectedCompanyId,
    selectedCompany,
    companyForm,
    setCompanyForm,
    handleSaveCompany,
    createCompany,
  }
}
