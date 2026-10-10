import { Suspense } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { getCurrentPerson } from "@/lib/auth"
import { cn } from "@/lib/utils"
import { UserMenu } from "./user-menu"

type Variant = "sidebar" | "compact"

/**
 * The user menu for the static shell. Reading the person reads cookies, so it
 * streams in behind its own Suspense boundary and the rest of the layout stays
 * prerendered.
 */
export function CurrentUserMenu({ variant }: { variant: Variant }) {
  return (
    <Suspense fallback={<UserMenuSkeleton variant={variant} />}>
      <CurrentUserMenuContent variant={variant} />
    </Suspense>
  )
}

async function CurrentUserMenuContent({ variant }: { variant: Variant }) {
  const person = await getCurrentPerson()
  // Pages redirect signed-out visitors themselves; this is only a safe fallback.
  if (!person) {
    return (
      <Button asChild variant="outline" size="sm" className={cn(variant === "sidebar" && "w-full")}>
        <Link href="/sign-in">Sign in</Link>
      </Button>
    )
  }
  return (
    <UserMenu
      variant={variant}
      person={{
        name: person.name,
        role: person.role,
        email: person.email,
        avatarUrl: person.avatarUrl,
      }}
    />
  )
}

function UserMenuSkeleton({ variant }: { variant: Variant }) {
  if (variant === "compact") {
    return (
      <div className="flex size-11 items-center justify-center" aria-hidden>
        <Skeleton className="size-8 rounded-full" />
      </div>
    )
  }
  return (
    <div className="flex items-center gap-2 p-2" aria-hidden>
      <Skeleton className="size-8 shrink-0 rounded-full" />
      <div className="flex flex-1 flex-col gap-1.5">
        <Skeleton className="h-3.5 w-24" />
        <Skeleton className="h-3 w-12" />
      </div>
    </div>
  )
}
