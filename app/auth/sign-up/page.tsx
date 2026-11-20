import { SignUpForm } from './sign-up-form'

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}

export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = await searchParams
  return (
    <SignUpForm
      refCode={firstParam(params.ref) ?? null}
      inviteToken={firstParam(params.invite) ?? null}
    />
  )
}
