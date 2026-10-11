import type { OrgKind } from "../kind-config"

/**
 * CONTRACT (Stage 3 build; the meetings agent implements it, the org page
 * renders it). The org's meetings, newest first: when, who went, rating and
 * one-line summary, follow-up, debrief status; each links to its meeting page.
 * An async server component, rendered inside the org page's Suspense.
 */
export async function MeetingLog(_props: { kind: OrgKind; orgId: string; orgName: string }) {
  return null
}
