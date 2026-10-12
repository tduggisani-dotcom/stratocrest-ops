import type { IsoDate } from "@/lib/dates"
import type { FormState } from "@/lib/forms"
import type { Database } from "@/types/database"

type Enums = Database["public"]["Enums"]

/** One debrief, as its form and summary show it. */
export type DebriefDetail = {
  id: string
  kind: Enums["debrief_kind"]
  status: Enums["debrief_status"]
  dueDate: IsoDate
  completedAt: string | null
  planned: string | null
  actual: string | null
  worked: string | null
  change: string | null
  facilitator: { id: string; name: string; avatarUrl: string | null } | null
  /** Set for investor and customer meeting debriefs. */
  orgMeetingId: string | null
}

/** The debrief form's state (Server Action result). */
export type DebriefFormState = FormState

export const initialDebriefFormState: DebriefFormState = { status: "idle" }
