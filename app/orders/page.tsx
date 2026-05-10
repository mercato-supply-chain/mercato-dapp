import { permanentRedirect } from 'next/navigation'

/** Public alias for the main marketplace listing (/deals). */
export default function OrdersRedirectPage() {
  permanentRedirect('/deals')
}
