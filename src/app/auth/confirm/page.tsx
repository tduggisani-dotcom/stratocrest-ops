import type { Metadata } from "next"
import { Suspense } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { AuthCardSkeleton, AuthFrame } from "@/features/auth/auth-frame"
import { ConfirmForm } from "@/features/auth/confirm-form"
import { signInHref } from "@/features/auth/links"
import { confirmLinkSchema, safeNextPath } from "@/lib/schemas/auth"

export const metadata: Metadata = { title: "Finish signing in" }

/**
 * Where the link in the sign-in email lands:
 * /auth/confirm?next=…&token_hash=…&type=email (see supabase/templates/magic_link.html).
 * Nothing happens until the person presses the button.
 */
export default function ConfirmPage({ searchParams }: PageProps<"/auth/confirm">) {
  return (
    <AuthFrame>
      <Suspense fallback={<AuthCardSkeleton />}>
        <Confirm searchParams={searchParams} />
      </Suspense>
    </AuthFrame>
  )
}

async function Confirm({ searchParams }: Pick<PageProps<"/auth/confirm">, "searchParams">) {
  const params = await searchParams
  const link = confirmLinkSchema.safeParse({
    token_hash: params.token_hash,
    type: params.type,
    next: params.next,
  })

  if (!link.success) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>
            <h2 className="text-lg">This sign-in link doesn&apos;t work</h2>
          </CardTitle>
          <CardDescription>
            Part of the link is missing. Some email apps cut long links short. Sign in with a new
            code instead.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild className="w-full">
            <Link href={signInHref(safeNextPath(params.next))}>Go to sign in</Link>
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2 className="text-lg">Finish signing in</h2>
        </CardTitle>
        <CardDescription>
          Press the button to sign in on this device. The link works once and expires 1 hour after
          it was sent.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ConfirmForm tokenHash={link.data.token_hash} type={link.data.type} next={link.data.next} />
      </CardContent>
    </Card>
  )
}
