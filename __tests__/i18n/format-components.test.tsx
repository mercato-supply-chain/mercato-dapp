import { afterEach, describe, expect, spyOn, test } from 'bun:test'
import React, { act, type ComponentProps } from 'react'
import { renderToString } from 'react-dom/server'
import { hydrateRoot } from 'react-dom/client'
import { cleanup, render } from '@testing-library/react'
import * as i18n from '@/lib/i18n/provider'
import type { Locale } from '@/lib/i18n/config'
import { enDict } from '@/lib/i18n/dictionaries'
import { DashboardDealsPanel } from '@/components/dashboard/dashboard-deals-panel'
import { ReferralActivityTimeline } from '@/components/referrals/activity-timeline'
import { CustomerActivityTable } from '@/components/supplier-activity/customer-activity-table'
import { EscrowDealSummary } from '@/components/admin/repayment-escrow/escrow-deal-summary'

afterEach(cleanup)

const timestamp = '2026-11-21T00:30:00Z'
const dashboardProps: ComponentProps<typeof DashboardDealsPanel> = {
  userType: 'investor', deals: [{ id: 'deal-1', status: 'funded', amount: 12345.67, created_at: timestamp }],
  totalCount: 1, viewAllHref: '/deals', statusLabels: {}, columns: { showCreated: true },
  labels: {
    title: 'Deals', viewAll: 'All', emptyTitle: 'Empty', emptyBody: '', showing: '1',
    viewAllFooter: 'All', dealUntitled: 'Deal', tableView: 'View', aprSummary: '',
  },
}

function selectLocale(locale: Locale) {
  return spyOn(i18n, 'useI18n').mockReturnValue({
    locale, messages: enDict, t: (key: string) => key, setLocale: () => {},
  })
}

describe('formatted component output', () => {
  for (const locale of ['en', 'es'] as const) {
    const money = locale === 'en' ? '$12,345.67' : '12.345,67\u00a0US$'
    const amount = locale === 'en' ? '12,345.67' : '12.345,67'
    const date = locale === 'en' ? '11/21/2026' : '21/11/2026'

    test(`${locale}: dashboard mobile and table amounts survive hydration unchanged`, async () => {
      const localeSpy = selectLocale(locale)
      const container = document.createElement('div')
      const errors: unknown[] = []
      const view = <DashboardDealsPanel {...dashboardProps} />
      const markup = renderToString(view)
      container.innerHTML = markup
      const initialMarkup = container.innerHTML
      document.body.append(container)
      let root: ReturnType<typeof hydrateRoot> | undefined
      try {
        await act(async () => { root = hydrateRoot(container, view, { onRecoverableError: (e) => errors.push(e) }) })
        expect(errors).toEqual([])
        expect(container.innerHTML).toBe(initialMarkup)
        expect(container.querySelector('p.tabular-nums')?.textContent).toBe(money)
        expect(container.querySelector('td.tabular-nums')?.textContent).toBe(money)
        expect(container.textContent).toContain(date)
      } finally {
        await act(async () => root?.unmount())
        container.remove()
        localeSpy.mockRestore()
      }
    })

    test(`${locale}: repayment summary uses the UI locale and tabular amount figures`, () => {
      const localeSpy = selectLocale(locale)
      // The presentational summary reads only these fields, with no signing or network work.
      const props = {
        item: { principal: 12345.67 },
        draft: { repayment: { investorProfit: 0, investorNetTarget: 12345.67, totalGrossed: 12345.67 } },
      } as ComponentProps<typeof EscrowDealSummary>
      try {
        const { container } = render(<EscrowDealSummary {...props} />)
        const amounts = [...container.querySelectorAll('.tabular-nums')]
        expect(amounts).toHaveLength(4)
        expect(amounts[0].textContent).toBe(`${amount} USDC`)
      } finally { localeSpy.mockRestore() }
    })

    test(`${locale}: server customer activity formats dates and money with the supplied cookie locale`, () => {
      const { container } = render(<CustomerActivityTable locale={locale} items={[{
        pymeId: 'p1', pymeName: 'Buyer', productsRequested: [], financingRequestCount: 1,
        financingRequestValue: 12345.67, fundedRequestCount: 1, awaitingFundingCount: 0,
        mostRecentActivityAt: timestamp,
      }]} labels={{ title: '', customer: '', products: '', requests: '', requestValue: '', funded: '', awaiting: '', lastActivity: '', empty: '' }} />)
      expect(container.textContent).toContain(money)
      expect(container.textContent).toContain(date)
    })

    test(`${locale}: referral timestamps use the supplied locale and UTC time`, () => {
      const { container } = render(<ReferralActivityTimeline locale={locale} items={[{
        id: 'event-1', eventType: 'deal_created', createdAt: timestamp, profileId: null,
        invitationId: null, metadata: {},
      }]} labels={{ title: '', empty: '', openedTimes: '', eventLabels: {} }} page={1} total={1} pageSize={10} baseQuery="" />)
      const expected = new Intl.DateTimeFormat(locale === 'en' ? 'en-US' : 'es-ES', {
        dateStyle: 'short', timeStyle: 'medium', timeZone: 'UTC',
      }).format(new Date(timestamp))
      expect(container.textContent).toContain(expected)
    })
  }
})
