'use client'

import { useState } from 'react'
import { Navigation } from '@/components/navigation'
import { DealCard } from '@/components/deal-card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { mockDeals } from '@/lib/mock-data'
import { DealStatus } from '@/lib/types'
import { Search, Filter } from 'lucide-react'

export default function MarketplacePage() {
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<DealStatus | 'all'>('all')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')

  // Get unique categories
  const categories = Array.from(new Set(mockDeals.map(d => d.category).filter(Boolean)))

  // Filter deals
  const filteredDeals = mockDeals.filter(deal => {
    const matchesSearch = 
      deal.productName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      deal.pymeName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      deal.supplier.toLowerCase().includes(searchQuery.toLowerCase())
    
    const matchesStatus = statusFilter === 'all' || deal.status === statusFilter
    const matchesCategory = categoryFilter === 'all' || deal.category === categoryFilter

    return matchesSearch && matchesStatus && matchesCategory
  })

  // Count deals by status
  const statusCounts = {
    all: mockDeals.length,
    awaiting_funding: mockDeals.filter(d => d.status === 'awaiting_funding').length,
    funded: mockDeals.filter(d => d.status === 'funded').length,
    in_progress: mockDeals.filter(d => d.status === 'in_progress').length,
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Navigation />
      
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="mb-2 text-4xl font-bold tracking-tight">Deal Marketplace</h1>
          <p className="text-lg text-muted-foreground">
            Browse and fund supply chain deals with transparent, on-chain escrow
          </p>
        </div>

        {/* Stats Bar */}
        <div className="mb-8 grid gap-4 md:grid-cols-4">
          <div className="rounded-lg border border-border bg-card p-4">
            <p className="text-sm text-muted-foreground">Total Deals</p>
            <p className="text-3xl font-bold">{statusCounts.all}</p>
          </div>
          <div className="rounded-lg border border-accent bg-accent/5 p-4">
            <p className="text-sm text-muted-foreground">Open for Funding</p>
            <p className="text-3xl font-bold text-accent">{statusCounts.awaiting_funding}</p>
          </div>
          <div className="rounded-lg border border-success bg-success/5 p-4">
            <p className="text-sm text-muted-foreground">Active Deals</p>
            <p className="text-3xl font-bold text-success">
              {statusCounts.funded + statusCounts.in_progress}
            </p>
          </div>
          <div className="rounded-lg border border-border bg-card p-4">
            <p className="text-sm text-muted-foreground">Total Value</p>
            <p className="text-3xl font-bold">
              ${(mockDeals.reduce((sum, d) => sum + d.priceUSDC, 0) / 1000).toFixed(0)}K
            </p>
          </div>
        </div>

        {/* Filters */}
        <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-1 items-center gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search deals, PyMEs, or suppliers..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as DealStatus | 'all')}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="awaiting_funding">Open for Funding</SelectItem>
                <SelectItem value="funded">Funded</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
              </SelectContent>
            </Select>

            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories.map(cat => (
                  <SelectItem key={cat} value={cat as string}>{cat}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Active Filters */}
        {(statusFilter !== 'all' || categoryFilter !== 'all' || searchQuery) && (
          <div className="mb-6 flex flex-wrap items-center gap-2">
            <span className="text-sm text-muted-foreground">Active filters:</span>
            {statusFilter !== 'all' && (
              <Badge variant="secondary" className="gap-1">
                Status: {statusFilter}
                <button
                  onClick={() => setStatusFilter('all')}
                  className="ml-1 hover:text-destructive"
                >
                  ×
                </button>
              </Badge>
            )}
            {categoryFilter !== 'all' && (
              <Badge variant="secondary" className="gap-1">
                Category: {categoryFilter}
                <button
                  onClick={() => setCategoryFilter('all')}
                  className="ml-1 hover:text-destructive"
                >
                  ×
                </button>
              </Badge>
            )}
            {searchQuery && (
              <Badge variant="secondary" className="gap-1">
                Search: {searchQuery}
                <button
                  onClick={() => setSearchQuery('')}
                  className="ml-1 hover:text-destructive"
                >
                  ×
                </button>
              </Badge>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setStatusFilter('all')
                setCategoryFilter('all')
                setSearchQuery('')
              }}
            >
              Clear all
            </Button>
          </div>
        )}

        {/* Results Count */}
        <div className="mb-4">
          <p className="text-sm text-muted-foreground">
            Showing {filteredDeals.length} {filteredDeals.length === 1 ? 'deal' : 'deals'}
          </p>
        </div>

        {/* Deals Grid */}
        {filteredDeals.length > 0 ? (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {filteredDeals.map(deal => (
              <DealCard key={deal.id} deal={deal} />
            ))}
          </div>
        ) : (
          <div className="flex min-h-[400px] flex-col items-center justify-center rounded-lg border-2 border-dashed border-border p-8 text-center">
            <p className="mb-2 text-lg font-medium">No deals found</p>
            <p className="mb-4 text-sm text-muted-foreground">
              Try adjusting your filters or search query
            </p>
            <Button
              variant="outline"
              onClick={() => {
                setStatusFilter('all')
                setCategoryFilter('all')
                setSearchQuery('')
              }}
            >
              Clear filters
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
