import { Suspense } from "react"
import { LiveRefresh } from "@/components/common/live-refresh"
import type { OrgKind } from "../kind-config"
import { ORG_LIVE_TABLES } from "../types"
import { OrgActivitySection } from "./activity-section"
import { BackToOrgs } from "./back-link"
import { OrgDebriefsSection } from "./debriefs-section"
import { OrgDetailsSection } from "./details-section"
import { OrgHypothesesSection, OrgMeetingsSection } from "./linked-sections"
import { OrgHeader } from "./org-header"
import type { OrgParams } from "./resolve"
import { OrgHeaderSkeleton, OrgSectionSlot } from "./skeletons"
import { OrgTasksSection } from "./tasks-section"

/**
 * One investor or customer (spec §6.2 detail page): the header (stage, owner,
 * next step, last contact, actions), then contact and details, the meeting
 * log, the hypothesis log, linked tasks, debriefs and the activity history.
 * The frame is static (the instant shell); the header and each section stream
 * in on their own and refresh live. Unknown ids, and ids of the other kind,
 * are this route's 404.
 */
export function OrgPageView({ kind, params }: { kind: OrgKind; params: OrgParams }) {
  return (
    <div className="space-y-6 md:space-y-8">
      <LiveRefresh tables={ORG_LIVE_TABLES} />
      <div>
        <BackToOrgs kind={kind} />
        <Suspense fallback={<OrgHeaderSkeleton />}>
          <OrgHeader kind={kind} params={params} />
        </Suspense>
      </div>
      <OrgSectionSlot section="details">
        <OrgDetailsSection kind={kind} params={params} />
      </OrgSectionSlot>
      <OrgSectionSlot section="meetings">
        <OrgMeetingsSection kind={kind} params={params} />
      </OrgSectionSlot>
      <OrgSectionSlot section="hypotheses" rows={2}>
        <OrgHypothesesSection kind={kind} params={params} />
      </OrgSectionSlot>
      <OrgSectionSlot section="tasks">
        <OrgTasksSection kind={kind} params={params} />
      </OrgSectionSlot>
      <OrgSectionSlot section="debriefs" rows={2}>
        <OrgDebriefsSection kind={kind} params={params} />
      </OrgSectionSlot>
      <OrgSectionSlot section="history" rows={4}>
        <OrgActivitySection kind={kind} params={params} />
      </OrgSectionSlot>
    </div>
  )
}
