'use client'

import { useMemo, useState } from 'react'
import { Search, TrendingUp, UserPlus, Users } from 'lucide-react'
import { Navigation } from '@/components/navigation'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useI18n } from '@/lib/i18n/provider'
import type { TractionLead, TractionSummary, TractionUser } from '@/lib/traction/get-traction-data'
import { getCountryLabel } from '@/lib/constants'

type TractionViewProps = {
  users: TractionUser[]
  leads: TractionLead[]
  eventSlugs: string[]
  summary: TractionSummary
}

function formatLocation(country: string | null | undefined) {
  if (!country) return '—'
  return getCountryLabel(country) || country
}

function roleLabel(role: string | null, t: (key: string) => string) {
  if (!role) return '—'
  if (role === 'other') return t('tractionPage.leadsRoleOther')
  if (role === 'pyme' || role === 'investor' || role === 'supplier') {
    return t(`dashboard.roles.${role}`)
  }
  return role
}

export function TractionView({ users, leads, eventSlugs, summary }: TractionViewProps) {
  const { t } = useI18n()
  const [userSearch, setUserSearch] = useState('')
  const [leadSearch, setLeadSearch] = useState('')
  const [leadEventFilter, setLeadEventFilter] = useState('all')

  const filteredUsers = useMemo(() => {
    const query = userSearch.trim().toLowerCase()
    return users.filter((user) => {
      if (!query) return true
      const location = formatLocation(user.country).toLowerCase()
      return (
        user.email.toLowerCase().includes(query) ||
        user.display_name.toLowerCase().includes(query) ||
        (user.company_name?.toLowerCase().includes(query) ?? false) ||
        location.includes(query)
      )
    })
  }, [users, userSearch])

  const filteredLeads = useMemo(() => {
    const query = leadSearch.trim().toLowerCase()
    return leads.filter((lead) => {
      if (leadEventFilter !== 'all' && lead.event_slug !== leadEventFilter) return false
      if (!query) return true
      const location = formatLocation(lead.address).toLowerCase()
      return (
        lead.name.toLowerCase().includes(query) ||
        (lead.company?.toLowerCase().includes(query) ?? false) ||
        lead.event_slug.toLowerCase().includes(query) ||
        location.includes(query) ||
        (lead.address?.toLowerCase().includes(query) ?? false)
      )
    })
  }, [leads, leadSearch, leadEventFilter])

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <main className="container mx-auto max-w-6xl space-y-8 px-4 py-10">
        <header>
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <TrendingUp className="h-6 w-6 text-primary" aria-hidden />
            <h1 className="font-display text-3xl font-normal tracking-tight">
              {t('tractionPage.title')}
            </h1>
            <Badge variant="secondary" className="gap-1">
              <Users className="h-3 w-3" aria-hidden />
              {summary.totalUsers}
            </Badge>
            <Badge variant="outline" className="gap-1">
              <UserPlus className="h-3 w-3" aria-hidden />
              {summary.totalLeads}
            </Badge>
          </div>
          <p className="max-w-2xl text-muted-foreground">{t('tractionPage.subtitle')}</p>
        </header>

        <Card>
          <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>{t('tractionPage.usersTitle')}</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">{t('tractionPage.usersSubtitle')}</p>
            </div>
            <div className="relative">
                <Search
                  className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground"
                  aria-hidden
                />
                <Input
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  placeholder={t('tractionPage.searchPlaceholder')}
                  className="w-full pl-9 sm:w-56"
                />
              </div>
          </CardHeader>
          <CardContent>
            {filteredUsers.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">{t('tractionPage.empty')}</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('tractionPage.columns.email')}</TableHead>
                      <TableHead>{t('tractionPage.columns.name')}</TableHead>
                      <TableHead>{t('tractionPage.columns.location')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredUsers.map((user) => (
                      <TableRow key={user.id}>
                        <TableCell className="font-mono text-sm">{user.email}</TableCell>
                        <TableCell>{user.display_name || '—'}</TableCell>
                        <TableCell>{formatLocation(user.country)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
            <p className="mt-4 text-xs text-muted-foreground">
              {t('tractionPage.showing', { shown: filteredUsers.length, total: users.length })}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>{t('tractionPage.leadsTitle')}</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">{t('tractionPage.leadsSubtitle')}</p>
              <p className="mt-2 text-sm">
                <a
                  href="https://drive.google.com/drive/folders/1omPjpRVGFazpQzKgSIe0smAOeV8MW3rg?usp=sharing"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-primary underline-offset-4 hover:underline"
                >
                  {t('tractionPage.leadsLoiLink')}
                </a>
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <div className="relative">
                <Search
                  className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground"
                  aria-hidden
                />
                <Input
                  value={leadSearch}
                  onChange={(e) => setLeadSearch(e.target.value)}
                  placeholder={t('tractionPage.leadsSearchPlaceholder')}
                  className="w-full pl-9 sm:w-56"
                />
              </div>
              <Select value={leadEventFilter} onValueChange={setLeadEventFilter}>
                <SelectTrigger className="w-full sm:w-44">
                  <SelectValue placeholder={t('tractionPage.leadsFilterEvent')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('tractionPage.leadsFilterAll')}</SelectItem>
                  {eventSlugs.map((slug) => (
                    <SelectItem key={slug} value={slug}>
                      {slug}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            {filteredLeads.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                {t('tractionPage.leadsEmpty')}
              </p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('tractionPage.leadsColumns.company')}</TableHead>
                      <TableHead>{t('tractionPage.leadsColumns.role')}</TableHead>
                      <TableHead>{t('tractionPage.leadsColumns.event')}</TableHead>
                      <TableHead>{t('tractionPage.leadsColumns.address')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredLeads.map((lead) => (
                      <TableRow key={lead.id}>
                        <TableCell>{lead.company ?? '—'}</TableCell>
                        <TableCell>{roleLabel(lead.role, t)}</TableCell>
                        <TableCell className="text-sm">{lead.event_slug}</TableCell>
                        <TableCell>{lead.address?.trim() || '—'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
            <p className="mt-4 text-xs text-muted-foreground">
              {t('tractionPage.leadsShowing', { shown: filteredLeads.length, total: leads.length })}
            </p>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
