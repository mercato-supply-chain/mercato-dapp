import { NextResponse } from 'next/server'

/**
 * Returns BlindPay configuration for the ramp setup flow.
 * Currently this endpoint returns static configuration.
 * In production, this could include dynamic values like:
 * - Merchant ID
 * - Environment settings
 * - Feature flags
 */
export async function GET() {
  return NextResponse.json({
    enabled: true,
    merchantId: 'placeholder_merchant_id',
    environment: process.env.BLINDPAY_ENVIRONMENT || 'sandbox',
    endpoints: {
      customer: '/api/ramp/customer',
    },
  })
}
