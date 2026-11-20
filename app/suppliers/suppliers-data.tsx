import { fetchPublicSuppliers } from '@/lib/suppliers/directory'
import SuppliersDirectory from './suppliers-directory'

/** Awaited supplier directory assembly.
 *  Rendered inside a Suspense boundary so the surrounding shell streams first. */
export async function SuppliersData() {
  const suppliers = await fetchPublicSuppliers()
  return <SuppliersDirectory initialSuppliers={suppliers} />
}
