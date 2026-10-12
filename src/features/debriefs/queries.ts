import "server-only"
import { createClient } from "@/lib/supabase/server"
import type { DebriefDetail } from "./types"

/**
 * Reads for debriefs. Server-only; each runs as the signed-in person (RLS
 * applies) and throws on a database error so the section shows its retry
 * screen. Call them inside <Suspense>, after requireTeamMember().
 */

const DEBRIEF_COLUMNS = `id, kind, status, due_date, completed_at, planned, actual, worked, change,
  org_meeting_id,
  facilitator:people!debriefs_facilitator_id_fkey ( id, name, avatar_url )`

type DebriefRow = {
  id: string
  kind: DebriefDetail["kind"]
  status: DebriefDetail["status"]
  due_date: string
  completed_at: string | null
  planned: string | null
  actual: string | null
  worked: string | null
  change: string | null
  org_meeting_id: string | null
  facilitator: { id: string; name: string; avatar_url: string | null } | null
}

function toDetail(row: DebriefRow): DebriefDetail {
  return {
    id: row.id,
    kind: row.kind,
    status: row.status,
    dueDate: row.due_date,
    completedAt: row.completed_at,
    planned: row.planned,
    actual: row.actual,
    worked: row.worked,
    change: row.change,
    facilitator: row.facilitator
      ? {
          id: row.facilitator.id,
          name: row.facilitator.name,
          avatarUrl: row.facilitator.avatar_url,
        }
      : null,
    orgMeetingId: row.org_meeting_id,
  }
}

/** One debrief by id, or null. */
export async function getDebrief(id: string): Promise<DebriefDetail | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("debriefs")
    .select(DEBRIEF_COLUMNS)
    .eq("id", id)
    .maybeSingle()
  if (error) throw new Error(`Couldn't load the debrief: ${error.message}`)
  return data ? toDetail(data) : null
}

/**
 * The debrief of an investor or customer meeting, or null while there is
 * none (the database opens it once the meeting has happened).
 */
export async function getOrgMeetingDebrief(meetingId: string): Promise<DebriefDetail | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("debriefs")
    .select(DEBRIEF_COLUMNS)
    .eq("org_meeting_id", meetingId)
    .maybeSingle()
  if (error) throw new Error(`Couldn't load the debrief: ${error.message}`)
  return data ? toDetail(data) : null
}
