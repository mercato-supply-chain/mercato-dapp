process.env.NEXT_PUBLIC_SUPABASE_URL ??= 'https://ci-placeholder.supabase.co'
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= 'ci-placeholder-anon-key'

import { afterEach, describe, expect, test } from 'bun:test'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { useState, type ReactNode } from 'react'
import { AppRouterContext, type AppRouterInstance } from 'next/dist/shared/lib/app-router-context.shared-runtime'
import { STELLAR_ADDRESS_INPUT_PROPS } from '@/lib/stellar/address-input'
import { I18nProvider } from '@/lib/i18n/provider'
import { SettingsProfileForm, type ProfileFormState } from '@/components/settings/settings-profile-form'
import { SupplierCompanyDetails } from '@/components/supplier-profile/supplier-company-details'
import type { CompanyFormState, SupplierCompany } from '@/lib/supplier-profile/types'

const ROOT = join(import.meta.dir, '..')

const TEST_ROUTER: AppRouterInstance = {
  push: () => {},
  replace: () => {},
  refresh: () => {},
  prefetch: () => {},
  back: () => {},
  forward: () => {},
}

function Providers({ children }: { children: ReactNode }) {
  return (
    <AppRouterContext.Provider value={TEST_ROUTER}>
      <I18nProvider locale="en">{children}</I18nProvider>
    </AppRouterContext.Provider>
  )
}

function assertStellarAddressSafety(el: HTMLElement) {
  expect(el.getAttribute('spellcheck')).toBe('false')
  expect(el.getAttribute('translate')).toBe('no')
  expect(el.getAttribute('autocomplete')).toBe('off')
  expect(el.getAttribute('autocapitalize')).toBe('off')
  expect(el.getAttribute('autocorrect')).toBe('off')
}

afterEach(() => {
  cleanup()
})

describe('Stellar address input hardening (#295)', () => {
  test('exports expected non-auth identifier safety attributes', () => {
    expect(STELLAR_ADDRESS_INPUT_PROPS).toEqual({
      spellCheck: false,
      translate: 'no',
      autoComplete: 'off',
      autoCapitalize: 'off',
      autoCorrect: 'off',
    })
  })

  test('SettingsProfileForm renders labeled Stellar wallet input and preserves pasted G... and C... addresses unaltered', async () => {
    const user = userEvent.setup()

    function ControlledProfileForm() {
      const [formData, setFormData] = useState<ProfileFormState>({
        full_name: 'Bishal',
        company_name: 'Mercato Test',
        phone: '',
        address: '',
        bio: '',
        country: 'Mexico',
        sector: 'Logistics',
        avatar_url: '',
      })

      return (
        <Providers>
          <SettingsProfileForm
            userId="user-1"
            displayName="Bishal"
            userType="pyme"
            formData={formData}
            onChange={(patch) => setFormData((prev) => ({ ...prev, ...patch }))}
            isSaving={false}
            onSubmit={(e) => e.preventDefault()}
            onCancel={() => {}}
          />
        </Providers>
      )
    }

    render(<ControlledProfileForm />)

    const addressInput = document.getElementById('address') as HTMLInputElement | null
    expect(addressInput).not.toBeNull()
    const label = document.querySelector('label[for="address"]')
    expect(label?.textContent?.trim().length).toBeGreaterThan(0)
    expect(screen.getByLabelText(label!.textContent!.trim())).toBe(addressInput!)
    assertStellarAddressSafety(addressInput!)

    const sampleG = 'GCFXHS4GXL6BVUCXBWXGTITROWLVYXQKQLF4YH5O5JT3YZXCYPAFBJZB'
    await user.click(addressInput!)
    await user.paste(sampleG)
    expect(addressInput!.value).toBe(sampleG)

    const sampleC = 'CAQCFVLOBK5GIULPNZRGATJJMIZL5BSP7X5YJVMGCPTUEPFM4AVSRCJU'
    await user.clear(addressInput!)
    await user.paste(sampleC)
    expect(addressInput!.value).toBe(sampleC)
  })

  test('SupplierCompanyDetails renders labeled Stellar Payment Address input with safety attributes', async () => {
    const user = userEvent.setup()
    const company: SupplierCompany = {
      id: 'sup-1',
      company_name: 'Andes Supply',
      bio: '',
      country: 'Peru',
      sector: 'Manufacturing',
      phone: '',
      logo_url: null,
      website: '',
      address: '',
      categories: [],
    }

    function ControlledSupplierForm() {
      const [form, setForm] = useState<CompanyFormState>({
        bio: '',
        country: 'Peru',
        sector: 'Manufacturing',
        phone: '',
        website: '',
        address: '',
        logo_url: '',
        categories: [],
      })

      return (
        <Providers>
          <SupplierCompanyDetails
            company={company}
            form={form}
            onChange={(patch) => setForm((prev) => ({ ...prev, ...patch }))}
            isSaving={false}
            onSubmit={(e) => e.preventDefault()}
          />
        </Providers>
      )
    }

    render(<ControlledSupplierForm />)

    const companyAddress = document.getElementById('company-address') as HTMLInputElement | null
    expect(companyAddress).not.toBeNull()
    const label = document.querySelector('label[for="company-address"]')
    expect(label?.textContent?.trim().length).toBeGreaterThan(0)
    assertStellarAddressSafety(companyAddress!)

    const sampleG = 'GBZXN7PIRZGNMHGA7MUUUF4GWPY5AYPV6LY4UV2GL6VJGIQRXFDNMADI'
    await user.click(companyAddress!)
    await user.paste(sampleG)
    expect(companyAddress!.value).toBe(sampleG)
  })

  test('all Stellar address and contract ID inputs across settings, vault, deal, and escrow forms spread STELLAR_ADDRESS_INPUT_PROPS', () => {
    const expectedFiles = [
      'components/settings/settings-profile-form.tsx',
      'components/supplier-profile/supplier-company-details.tsx',
      'components/admin/admin-vault-monitor.tsx',
      'components/admin/vault-create-panel.tsx',
      'components/deals/deal-fund-dialog.tsx',
      'components/admin/repayment-escrow/add-milestone-review-dialog.tsx',
      'components/admin/repayment-escrow/escrow-milestone-editor.tsx',
      'components/admin/repayment-escrow/escrow-role-fields.tsx',
    ]

    for (const rel of expectedFiles) {
      const src = readFileSync(join(ROOT, rel), 'utf8')
      expect(src).toContain('{...STELLAR_ADDRESS_INPUT_PROPS}')
    }
  })
})
