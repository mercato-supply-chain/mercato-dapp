'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'

interface CustomerResponse {
  ok: boolean
  customer: {
    id: string
    email: string
    name?: string | null
    company?: string | null
    status: string
  }
  existing: boolean
}

interface ConfigResponse {
  enabled: boolean
  merchantId: string
  environment: string
  endpoints: {
    customer: string
  }
}

export default function BlindPaySetupPage() {
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [company, setCompany] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      // Start both requests concurrently
      // This avoids the sequential round-trip problem where config was fetched first
      // and its payload was discarded before starting the customer request
      const [configResponse, customerResponse] = await Promise.all([
        fetch('/api/ramp/config'),
        fetch('/api/ramp/customer', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ email, name, company }),
        }),
      ])

      // Validate config response (though we don't use it)
      if (!configResponse.ok) {
        throw new Error('Failed to fetch ramp configuration')
      }

      const customerData = await customerResponse.json()

      if (!customerData.ok) {
        throw new Error(customerData.error || 'Failed to create customer')
      }

      // Redirect to next step with customer info
      router.push(`/dashboard/ramp/blindpay-setup/verify?email=${encodeURIComponent(email)}&customer_id=${customerData.customer.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container mx-auto max-w-md py-8">
      <Card>
        <CardHeader>
          <CardTitle>Set up BlindPay</CardTitle>
          <CardDescription>Enter your details to get started with the ramp service</CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-600">
              {error}
            </div>
          )}
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium mb-1">
                Email address
              </label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                disabled={loading}
              />
            </div>
            
            <div>
              <label htmlFor="name" className="block text-sm font-medium mb-1">
                Full name
              </label>
              <Input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="John Doe"
                disabled={loading}
              />
            </div>
            
            <div>
              <label htmlFor="company" className="block text-sm font-medium mb-1">
                Company name (optional)
              </label>
              <Input
                id="company"
                type="text"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                placeholder="Acme Corp"
                disabled={loading}
              />
            </div>
            
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Setting up...' : 'Continue'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
