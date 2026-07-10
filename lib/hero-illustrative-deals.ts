export type HeroSampleMilestone = 'open_split' | 'funded_progress' | 'repaid'

export type HeroIllustrativeDeal = {
  key: string
  flowStep: string
  badgeLabel: string
  badgeClassName: string
  category: string
  product: string
  company: string
  amount: string
  apr: string
  termDays: string
  escrowHint: string
  milestone: HeroSampleMilestone
  cta: { label: string; href: string }
  borderHover: string
}

export const heroIllustrativeDeals: HeroIllustrativeDeal[] = [
  {
    key: 'open',
    flowStep: 'Deal live · seeking capital',
    badgeLabel: 'Open',
    badgeClassName: 'bg-accent/10 text-accent ring-1 ring-accent/20',
    category: 'Textiles · Mexico',
    product: 'Cotton yarn — 1,000 units',
    company: 'Manufacturas del Norte',
    amount: '$12,500',
    apr: '12.0%',
    termDays: '60',
    escrowHint: 'Open for funding · investor pays supplier + 1% fee',
    milestone: 'open_split',
    cta: { label: 'Fund this deal', href: '/deals' },
    borderHover: 'hover:border-accent/35',
  },
  {
    key: 'funded',
    flowStep: 'Supplier paid · goods shipping',
    badgeLabel: 'In progress',
    badgeClassName: 'bg-success/10 text-success ring-1 ring-success/20',
    category: 'Electronics · Colombia',
    product: 'LED panels — 400 units',
    company: 'Andes Components SAS',
    amount: '$38,200',
    apr: '10.5%',
    termDays: '45',
    escrowHint: 'Repayment escrow ready · SMB pays at term end',
    milestone: 'funded_progress',
    cta: { label: 'View active deals', href: '/deals' },
    borderHover: 'hover:border-success/40',
  },
  {
    key: 'complete',
    flowStep: 'Repaid · investor + platform paid',
    badgeLabel: 'Completed',
    badgeClassName: 'bg-muted text-muted-foreground',
    category: 'Coffee · Peru',
    product: 'Specialty beans — 20 pallets',
    company: 'Sierra Verde Co-op',
    amount: '$8,400',
    apr: '11.2%',
    termDays: '75',
    escrowHint: 'Principal + yield settled on-chain for investors',
    milestone: 'repaid',
    cta: { label: 'Browse deals', href: '/deals' },
    borderHover: 'hover:border-primary/35',
  },
]
