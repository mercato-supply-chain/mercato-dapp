'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { DealDetailsPanel } from '@/components/deals/deal-details-panel'
import { DealOnChainPanel } from '@/components/deals/deal-on-chain-panel'
import { FileText } from 'lucide-react'
import type { Deal } from '@/lib/types'
import type { GetEscrowsFromIndexerResponse } from '@trustless-work/escrow'
import { useI18n } from '@/lib/i18n/provider'

interface DealDetailTabsProps {
  deal: Deal
  indexerEscrow: GetEscrowsFromIndexerResponse | null
}

export function DealDetailTabs({ deal, indexerEscrow }: DealDetailTabsProps) {
  const { t } = useI18n()
  return (
    <Tabs defaultValue="details" className="w-full">
      <TabsList className="grid w-full grid-cols-3">
        <TabsTrigger value="details">{t('dealDetail.tabDetails')}</TabsTrigger>
        <TabsTrigger value="onchain">{t('dealDetail.tabOnchain')}</TabsTrigger>
        <TabsTrigger value="documents">{t('dealDetail.tabDocuments')}</TabsTrigger>
      </TabsList>
      <TabsContent value="details" className="space-y-4">
        <DealDetailsPanel deal={deal} />
      </TabsContent>
      <TabsContent value="onchain" className="space-y-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{t('dealDetail.blockchainInfo')}</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <DealOnChainPanel
              escrowAddress={deal.escrowAddress}
              investorAddress={deal.investorAddress}
              supplierAddress={deal.supplierAddress}
              indexerEscrow={indexerEscrow}
            />
          </CardContent>
        </Card>
      </TabsContent>
      <TabsContent value="documents" className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('dealDetail.dealDocuments')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <FileText className="mb-3 h-12 w-12 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">{t('dealDetail.documentsEmpty')}</p>
            </div>
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  )
}
