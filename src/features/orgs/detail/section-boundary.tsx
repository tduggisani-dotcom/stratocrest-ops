"use client"

import { catchError, type ErrorInfo } from "next/error"
import { RotateCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { SectionCard } from "@/features/this-week/components/section-card"
import { ORG_SECTIONS, type OrgSectionKey } from "./sections"

/**
 * If one section of the org page fails to load, only that card shows a calm
 * retry message; the header and the other sections keep working. notFound()
 * and sign-in redirects pass through (catchError lets them by).
 */
function OrgSectionError({ section }: { section: OrgSectionKey }, { retry }: ErrorInfo) {
  const { id, title } = ORG_SECTIONS[section]
  return (
    <SectionCard id={id} title={title}>
      <div role="alert" className="flex flex-col items-start gap-3">
        <p className="text-sm text-pretty text-muted-foreground">
          This part of the page didn&apos;t load. Nothing is lost; try again in a moment.
        </p>
        <Button variant="outline" onClick={() => retry()}>
          <RotateCw aria-hidden />
          Try again
        </Button>
      </div>
    </SectionCard>
  )
}

export const OrgSectionBoundary = catchError(OrgSectionError)
