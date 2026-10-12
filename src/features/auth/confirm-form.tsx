"use client"

import { useActionState } from "react"
import Link from "next/link"
import { LoaderCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { confirmSignIn } from "@/features/auth/actions"
import { initialVerifyState } from "@/features/auth/form-state"
import { signInHref } from "@/features/auth/links"

/**
 * The button on /auth/confirm. Signing in happens only when it's pressed, so
 * an email scanner that opens the link can't use it up.
 */
export function ConfirmForm({
  tokenHash,
  type,
  next,
}: {
  tokenHash: string
  type: string
  next: string
}) {
  const [state, action, pending] = useActionState(confirmSignIn, initialVerifyState)

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="token_hash" value={tokenHash} />
      <input type="hidden" name="type" value={type} />
      <input type="hidden" name="next" value={next} />
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? (
          <>
            <LoaderCircle aria-hidden className="animate-spin" />
            Signing in…
          </>
        ) : (
          "Sign in to StratoCrest Ops"
        )}
      </Button>
      <div aria-live="polite" className="space-y-3">
        {state.error ? (
          <>
            <p className="text-sm text-destructive">{state.error}</p>
            <Button asChild variant="outline" className="w-full">
              <Link href={signInHref(next)}>Get a new code</Link>
            </Button>
          </>
        ) : null}
      </div>
    </form>
  )
}
