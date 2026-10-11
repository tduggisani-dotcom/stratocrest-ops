import type { Database } from "@/types/database"

/** One row of the org_overview view: an org plus derived meeting, contact and status fields. */
export type OrgOverviewRow = Database["public"]["Views"]["org_overview"]["Row"]

/** What org Server Actions called from buttons return (forms use FormState from src/lib/forms.ts). */
export type OrgActionResult = { status: "success" } | { status: "error"; message: string }

/** Tables the org pages show; their LiveRefresh watches these. */
export const ORG_LIVE_TABLES = [
  "organizations",
  "org_meetings",
  "org_meeting_attendees",
  "hypotheses",
  "hypothesis_tests",
  "debriefs",
  "tasks",
  "people",
] as const
