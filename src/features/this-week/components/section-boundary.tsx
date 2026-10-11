"use client"

import { catchError, type ErrorInfo } from "next/error"
import { RotateCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { SectionCard } from "./section-card"
import { SECTIONS, type SectionKey } from "./sections"

/**
 * If one section's data fails to load, only that card shows a calm retry
 * message; the rest of the page keeps working. Sign-in redirects pass through
 * (catchError lets Next's redirect() and notFound() through).
 */
function SectionError({ section }: { section: SectionKey }, { retry }: ErrorInfo) {
  const { id, title, icon } = SECTIONS[section]
  return (
    <SectionCard id={id} title={title} icon={icon}>
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

export const SectionBoundary = catchError(SectionError)
