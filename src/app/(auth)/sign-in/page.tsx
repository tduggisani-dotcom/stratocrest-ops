import type { Metadata } from "next"
import { Suspense } from "react"
import { redirect } from "next/navigation"
import { AuthCardSkeleton, AuthFrame } from "@/features/auth/auth-frame"
import { SignInForm } from "@/features/auth/sign-in-form"
import { getCurrentPerson } from "@/lib/auth"
import { parseSignInReason, safeNextPath } from "@/lib/schemas/auth"

export const metadata: Metadata = { title: "Sign in" }

export default function SignInPage({ searchParams }: PageProps<"/sign-in">) {
  return (
    <AuthFrame>
      <Suspense fallback={<AuthCardSkeleton />}>
        <SignIn searchParams={searchParams} />
      </Suspense>
    </AuthFrame>
  )
}

/** Reads the URL and the session, so it streams in behind the Suspense boundary. */
async function SignIn({ searchParams }: Pick<PageProps<"/sign-in">, "searchParams">) {
  const params = await searchParams
  const next = safeNextPath(params.next)

  // Already signed in (an old bookmark, a second tab): skip the form.
  if (await getCurrentPerson()) redirect(next)

  return <SignInForm next={next} reason={parseSignInReason(params.reason)} />
}
