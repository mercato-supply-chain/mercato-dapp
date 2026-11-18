import { redirect } from 'next/navigation'

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}

export default async function SignUpAliasPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = await searchParams
  const next = new URLSearchParams()
  const ref = firstParam(params.ref)
  const invite = firstParam(params.invite)
  const lang = firstParam(params.lang)
  if (ref) next.set('ref', ref)
  if (invite) next.set('invite', invite)
  if (lang) next.set('lang', lang)
  const query = next.toString()
  redirect(query ? `/auth/sign-up?${query}` : '/auth/sign-up')
}
