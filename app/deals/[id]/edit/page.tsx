import EditDealContent from './edit-deal-content'

interface PageProps {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: PageProps) {
  const { id } = await params
  return {
    title: 'Edit Deal | Mercato',
    alternates: {
      canonical: `/deals/${id}/edit`,
    },
  }
}

export default function EditDealPage() {
  return <EditDealContent />
}
