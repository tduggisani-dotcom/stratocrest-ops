import Link from "next/link"
import { ChevronLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { kindConfig, type OrgKind } from "../kind-config"
import { orgListHref } from "../links"

/** "‹ Investors" above an org page or form. Static, so it's part of the instant shell. */
export function BackToOrgs({ kind }: { kind: OrgKind }) {
  return (
    <Button asChild variant="ghost" className="mb-2 -ml-3 text-muted-foreground">
      <Link href={orgListHref(kind)}>
        <ChevronLeft aria-hidden />
        {kindConfig(kind).plural}
      </Link>
    </Button>
  )
}
