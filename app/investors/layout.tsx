import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Investors | MERCATO',
  description:
    'Browse investors actively funding supply-chain deals on MERCATO.',
}

export default function InvestorsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
