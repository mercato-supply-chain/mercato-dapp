'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useI18n } from '@/lib/i18n/provider'

const ALL = 'all'

type FilterSelect = {
  param: string
  labelKey: string
  options: { value: string; labelKey: string }[]
}

const FILTER_SELECTS: FilterSelect[] = [
  {
    param: 'role',
    labelKey: 'adminUsers.filters.role',
    options: [
      { value: 'pyme', labelKey: 'adminUsers.roles.pyme' },
      { value: 'investor', labelKey: 'adminUsers.roles.investor' },
      { value: 'supplier', labelKey: 'adminUsers.roles.supplier' },
      { value: 'admin', labelKey: 'adminUsers.roles.admin' },
    ],
  },
  {
    param: 'verification',
    labelKey: 'adminUsers.filters.verification',
    options: [
      { value: 'verified', labelKey: 'adminUsers.verification.verified' },
      { value: 'unverified', labelKey: 'adminUsers.verification.unverified' },
    ],
  },
  {
    param: 'onboarding',
    labelKey: 'adminUsers.filters.onboarding',
    options: [
      { value: 'completed', labelKey: 'adminUsers.onboarding.completed' },
      { value: 'incomplete', labelKey: 'adminUsers.onboarding.incomplete' },
      { value: 'legacy', labelKey: 'adminUsers.onboarding.legacy' },
    ],
  },
  {
    param: 'wallet',
    labelKey: 'adminUsers.filters.wallet',
    options: [
      { value: 'connected', labelKey: 'adminUsers.wallet.connected' },
      { value: 'none', labelKey: 'adminUsers.wallet.none' },
      { value: 'pollar', labelKey: 'adminUsers.wallet.pollar' },
      { value: 'stellar-wallets-kit', labelKey: 'adminUsers.wallet.swk' },
    ],
  },
  {
    param: 'sort',
    labelKey: 'adminUsers.filters.sort',
    options: [
      { value: 'newest', labelKey: 'adminUsers.sort.newest' },
      { value: 'oldest', labelKey: 'adminUsers.sort.oldest' },
      { value: 'recently_updated', labelKey: 'adminUsers.sort.recentlyUpdated' },
    ],
  },
]

/** URL-backed search + filters for the admin user directory. */
export function AdminUsersFilters() {
  const { t } = useI18n()
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [search, setSearch] = useState(searchParams.get('q') ?? '')
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  function replaceParams(update: (params: URLSearchParams) => void) {
    const params = new URLSearchParams(searchParams.toString())
    update(params)
    params.delete('page')
    const qs = params.toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname)
  }

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [])

  function onSearchChange(value: string) {
    setSearch(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      replaceParams((params) => {
        if (value.trim()) params.set('q', value.trim())
        else params.delete('q')
      })
    }, 350)
  }

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="min-w-[220px] flex-1">
        <Label htmlFor="admin-users-search" className="mb-1.5 block text-xs">
          {t('adminUsers.filters.search')}
        </Label>
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            id="admin-users-search"
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder={t('adminUsers.filters.searchPlaceholder')}
            className="pl-8"
          />
        </div>
      </div>

      {FILTER_SELECTS.map((filter) => {
        const current = searchParams.get(filter.param) ?? ALL
        return (
          <div key={filter.param} className="w-40">
            <Label className="mb-1.5 block text-xs" htmlFor={`admin-users-${filter.param}`}>
              {t(filter.labelKey)}
            </Label>
            <Select
              value={current}
              onValueChange={(value) =>
                replaceParams((params) => {
                  if (value === ALL) params.delete(filter.param)
                  else params.set(filter.param, value)
                })
              }
            >
              <SelectTrigger id={`admin-users-${filter.param}`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>{t('adminUsers.filters.all')}</SelectItem>
                {filter.options.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {t(option.labelKey)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )
      })}

      <div className="w-40">
        <Label htmlFor="admin-users-from" className="mb-1.5 block text-xs">
          {t('adminUsers.filters.signupFrom')}
        </Label>
        <Input
          id="admin-users-from"
          type="date"
          defaultValue={searchParams.get('from') ?? ''}
          onChange={(event) =>
            replaceParams((params) => {
              if (event.target.value) params.set('from', event.target.value)
              else params.delete('from')
            })
          }
        />
      </div>
      <div className="w-40">
        <Label htmlFor="admin-users-to" className="mb-1.5 block text-xs">
          {t('adminUsers.filters.signupTo')}
        </Label>
        <Input
          id="admin-users-to"
          type="date"
          defaultValue={searchParams.get('to') ?? ''}
          onChange={(event) =>
            replaceParams((params) => {
              if (event.target.value) params.set('to', event.target.value)
              else params.delete('to')
            })
          }
        />
      </div>
    </div>
  )
}
