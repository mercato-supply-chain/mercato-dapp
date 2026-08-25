import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, BadgeCheck, Building2, History, UserRound, Wallet } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { AdminEditProfileDialog } from '@/components/dashboard/admin/admin-edit-profile-dialog'
import { AdminVerifyDialog } from '@/components/dashboard/admin/admin-verify-dialog'
import { getAdminUserDetail } from '@/lib/admin/get-admin-users'
import { requireAdminProfile } from '@/lib/admin/require-admin'
import { getServerDictionary, getServerLocale, tr } from '@/lib/i18n/server'

export default async function AdminUserDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { supabase } = await requireAdminProfile()
  const { id } = await params
  const [detail, m, locale] = await Promise.all([
    getAdminUserDetail(supabase, id),
    getServerDictionary(),
    getServerLocale(),
  ])

  if (!detail) notFound()

  const { profile, companies, recentAuditEvents, dealCounts } = detail
  const name =
    profile.companyName || profile.fullName || profile.contactName || profile.email
  const dateFormat = new Intl.DateTimeFormat(locale === 'es' ? 'es-MX' : 'en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })

  const identityRows: [string, string | null][] = [
    [tr(m, 'adminUsers.fields.fullName'), profile.fullName],
    [tr(m, 'adminUsers.fields.contactName'), profile.contactName],
    [tr(m, 'adminUsers.fields.companyName'), profile.companyName],
    [tr(m, 'adminUsers.columns.email'), profile.email],
    [tr(m, 'adminUsers.fields.phone'), profile.phone],
    [tr(m, 'adminUsers.fields.country'), profile.country],
    [tr(m, 'adminUsers.fields.sector'), profile.sector],
    [tr(m, 'adminUsers.fields.website'), profile.website],
  ]

  return (
    <div className="space-y-6">
      <Link
        href="/dashboard/admin/users"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        {tr(m, 'adminUsers.backToUsers')}
      </Link>

      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <UserRound className="h-5 w-5 text-primary" aria-hidden />
            <h1 className="text-2xl font-bold tracking-tight">{name}</h1>
            {profile.userType && (
              <Badge variant="secondary">
                {tr(m, `adminUsers.roles.${profile.userType}`)}
              </Badge>
            )}
            {profile.verified && (
              <Badge
                variant="outline"
                className="gap-1 border-emerald-300/60 bg-emerald-500/10 text-emerald-800 dark:border-emerald-800/50 dark:text-emerald-300"
              >
                <BadgeCheck className="h-3 w-3" aria-hidden />
                {tr(m, 'adminUsers.verification.verified')}
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            {tr(m, 'adminUsers.detailSubtitle', {
              signup: dateFormat.format(new Date(profile.createdAt)),
            })}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <AdminEditProfileDialog
            profileId={profile.id}
            profileName={name}
            initialValues={{
              full_name: profile.fullName,
              contact_name: profile.contactName,
              company_name: profile.companyName,
              phone: profile.phone,
              country: profile.country,
              sector: profile.sector,
              website: profile.website,
              bio: profile.bio,
            }}
          />
          <AdminVerifyDialog
            entityType="profile"
            entityId={profile.id}
            entityName={name}
            verified={profile.verified}
          />
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{tr(m, 'adminUsers.identityTitle')}</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
              {identityRows.map(([label, value]) => (
                <div key={label}>
                  <dt className="text-xs text-muted-foreground">{label}</dt>
                  <dd className="truncate text-sm">{value || '—'}</dd>
                </div>
              ))}
              <div>
                <dt className="text-xs text-muted-foreground">
                  {tr(m, 'adminUsers.columns.onboarding')}
                </dt>
                <dd className="text-sm">
                  {!profile.userType
                    ? tr(m, 'adminUsers.onboarding.incomplete')
                    : profile.onboardingCompletedAt
                      ? `${tr(m, 'adminUsers.onboarding.completed')} · ${dateFormat.format(new Date(profile.onboardingCompletedAt))}`
                      : tr(m, 'adminUsers.onboarding.legacy')}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">
                  {tr(m, 'adminUsers.dealsTitle')}
                </dt>
                <dd className="text-sm tabular-nums">
                  {tr(m, 'adminUsers.dealCounts', {
                    pyme: dealCounts.asPyme,
                    investor: dealCounts.asInvestor,
                  })}
                </dd>
              </div>
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Wallet className="h-4 w-4" aria-hidden />
              {tr(m, 'adminUsers.walletTitle')}
            </CardTitle>
            <CardDescription>{tr(m, 'adminUsers.walletReadOnly')}</CardDescription>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
              <div>
                <dt className="text-xs text-muted-foreground">
                  {tr(m, 'adminUsers.columns.wallet')}
                </dt>
                <dd className="text-sm">
                  {profile.walletProvider
                    ? tr(
                        m,
                        profile.walletProvider === 'pollar'
                          ? 'adminUsers.wallet.pollar'
                          : 'adminUsers.wallet.swk',
                      )
                    : tr(m, 'adminUsers.wallet.none')}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">
                  {tr(m, 'adminUsers.walletStatus')}
                </dt>
                <dd className="text-sm">{profile.walletStatus || '—'}</dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-xs text-muted-foreground">
                  {tr(m, 'adminUsers.walletAddress')}
                </dt>
                <dd className="break-all font-mono text-xs">
                  {profile.stellarPublicKey || '—'}
                </dd>
              </div>
            </dl>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Building2 className="h-4 w-4" aria-hidden />
            {tr(m, 'adminUsers.companiesTitle')}
            <Badge variant="secondary" className="tabular-nums">
              {companies.length}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {companies.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {tr(m, 'adminUsers.noCompanies')}
            </p>
          ) : (
            <ul className="divide-y divide-border/70">
              {companies.map((company) => (
                <li
                  key={company.id}
                  className="flex flex-wrap items-center justify-between gap-2 py-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {company.companyName || '—'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {company.country || '—'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {company.verified && (
                      <Badge
                        variant="outline"
                        className="gap-1 border-emerald-300/60 bg-emerald-500/10 text-emerald-800 dark:border-emerald-800/50 dark:text-emerald-300"
                      >
                        <BadgeCheck className="h-3 w-3" aria-hidden />
                        {tr(m, 'adminUsers.verification.verified')}
                      </Badge>
                    )}
                    <AdminVerifyDialog
                      entityType="supplier_company"
                      entityId={company.id}
                      entityName={company.companyName || '—'}
                      verified={company.verified}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <History className="h-4 w-4" aria-hidden />
            {tr(m, 'adminUsers.auditTitle')}
          </CardTitle>
          <CardDescription>{tr(m, 'adminUsers.auditDescription')}</CardDescription>
        </CardHeader>
        <CardContent>
          {recentAuditEvents.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {tr(m, 'adminUsers.noAuditEvents')}
            </p>
          ) : (
            <ul className="divide-y divide-border/70">
              {recentAuditEvents.map((event) => (
                <li key={event.id} className="py-2.5">
                  <p className="text-sm">
                    <span className="font-medium">{event.adminName || event.adminUserId}</span>{' '}
                    · {tr(m, `adminActivity.actionLabels.${event.action}`)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {dateFormat.format(new Date(event.createdAt))}
                    {event.reason ? ` · ${event.reason}` : ''}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
