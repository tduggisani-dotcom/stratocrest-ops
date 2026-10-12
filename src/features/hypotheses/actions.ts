"use server"

import { refresh } from "next/cache"
import { requireTeamMember } from "@/lib/auth"
import { friendlyDbError } from "@/lib/db-errors"
import { fieldErrorsFrom, formValues, type FormState } from "@/lib/forms"
import { orgKindLabels } from "@/lib/labels"
import {
  HYPOTHESIS_MESSAGES,
  hypothesisIdSchema,
  hypothesisInputSchema,
  hypothesisStatusUpdateSchema,
  hypothesisTestInputSchema,
  hypothesisTestUpdateSchema,
  hypothesisUpdateSchema,
  type HypothesisStatus,
} from "@/lib/schemas/hypotheses"
import { createClient } from "@/lib/supabase/server"
import { readHypothesisForm, readHypothesisTestForm } from "./form-data"
import type { HypothesisActionResult } from "./types"

/**
 * Hypothesis Server Actions. Each one is a public endpoint: it checks the
 * session, validates with the shared Zod schema, and writes as the signed-in
 * person (RLS applies; triggers fill created_by, updated_by, the audit log,
 * and a linked hypothesis's audience). Hypotheses and their evidence are
 * never deleted: hypotheses are archived, evidence is corrected.
 */

const CHECK_FIELDS = "Check the highlighted fields."
const ARCHIVED = "This hypothesis is archived. Restore it to change it."
const GONE_OR_ARCHIVED =
  "This hypothesis was archived or no longer exists. Refresh to see the latest."

type ServerClient = Awaited<ReturnType<typeof createClient>>
type DbFailure = { code?: string; message: string }

function logFailure(what: string, error: DbFailure) {
  console.error(what, { code: error.code })
}

/**
 * Checks that an org a hypothesis is being linked to exists and is active.
 * `keep` is the org it is linked to already (allowed even if archived since).
 * Returns a message for the organization_id field, or null when it's fine.
 */
async function orgProblem(
  supabase: ServerClient,
  orgId: string,
  keep: string | null = null,
): Promise<string | null> {
  if (orgId === keep) return null
  const { data, error } = await supabase
    .from("organizations")
    .select("kind, archived_at")
    .eq("id", orgId)
    .maybeSingle()
  if (error) {
    logFailure("Reading an org for a hypothesis failed", error)
    return friendlyDbError(error)
  }
  if (!data) return HYPOTHESIS_MESSAGES.organization
  if (data.archived_at) {
    const noun = orgKindLabels[data.kind].singular.toLowerCase()
    return `That ${noun} is archived. Restore it first, or choose another.`
  }
  return null
}

/** New hypothesis: from an org's page (organization_id set) or the roll-up. */
export async function createHypothesis(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireTeamMember()
  const values = formValues(formData)
  const parsed = hypothesisInputSchema.safeParse(readHypothesisForm(formData))
  if (!parsed.success) {
    return {
      status: "error",
      message: CHECK_FIELDS,
      fieldErrors: fieldErrorsFrom(parsed.error),
      values,
    }
  }

  const { organization_id, audience, ...fields } = parsed.data
  const supabase = await createClient()
  if (organization_id) {
    const problem = await orgProblem(supabase, organization_id)
    if (problem) {
      return {
        status: "error",
        message: problem,
        fieldErrors: { organization_id: problem },
        values,
      }
    }
  }

  // With an org, the database copies its kind into audience.
  const { data, error } = await supabase
    .from("hypotheses")
    .insert({
      ...fields,
      organization_id: organization_id ?? null,
      ...(organization_id ? {} : { audience }),
    })
    .select("id")
    .single()
  if (error) {
    logFailure("Adding a hypothesis failed", error)
    return {
      status: "error",
      message: friendlyDbError(error, "Couldn't add the hypothesis."),
      values,
    }
  }

  refresh()
  return { status: "success", id: data.id, message: "Hypothesis added" }
}

/**
 * The hypothesis page's edit form: every field but the status (which has its
 * own control). Archived hypotheses can't be edited.
 */
export async function updateHypothesis(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireTeamMember()
  const values = formValues(formData)
  const parsed = hypothesisUpdateSchema.safeParse(readHypothesisForm(formData))
  if (!parsed.success) {
    const fieldErrors = fieldErrorsFrom(parsed.error)
    return {
      status: "error",
      message: fieldErrors.id ? HYPOTHESIS_MESSAGES.hypothesis : CHECK_FIELDS,
      fieldErrors,
      values,
    }
  }

  const { id, organization_id, audience, ...fields } = parsed.data
  const supabase = await createClient()
  const current = await readHypothesis(supabase, id)
  if ("message" in current) return { status: "error", message: current.message, values }
  if (current.archived_at) return { status: "error", message: ARCHIVED, values }

  if (organization_id) {
    const problem = await orgProblem(supabase, organization_id, current.organization_id)
    if (problem) {
      return {
        status: "error",
        message: problem,
        fieldErrors: { organization_id: problem },
        values,
      }
    }
  }

  // Linked to an org: the database sets audience from it, so don't send ours.
  const { data, error } = await supabase
    .from("hypotheses")
    .update({
      ...fields,
      ...(organization_id === undefined ? {} : { organization_id }),
      ...(organization_id ? {} : audience === undefined ? {} : { audience }),
    })
    .eq("id", id)
    .is("archived_at", null)
    .select("id")
    .maybeSingle()
  if (error) {
    logFailure("Saving a hypothesis failed", error)
    return { status: "error", message: friendlyDbError(error), values }
  }
  if (!data) return { status: "error", message: GONE_OR_ARCHIVED, values }

  refresh()
  return { status: "success", id, message: "Changes saved" }
}

/** The status menu on the hypothesis page (its Undo calls this with the old status). */
export async function setHypothesisStatus(
  id: string,
  status: HypothesisStatus,
): Promise<HypothesisActionResult> {
  await requireTeamMember()
  const parsed = hypothesisStatusUpdateSchema.safeParse({ id, status })
  if (!parsed.success) {
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? HYPOTHESIS_MESSAGES.status,
    }
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("hypotheses")
    .update({ status: parsed.data.status })
    .eq("id", parsed.data.id)
    .is("archived_at", null)
    .select("id")
    .maybeSingle()
  if (error) {
    logFailure("Changing a hypothesis's status failed", error)
    return { status: "error", message: friendlyDbError(error, "Couldn't change the status.") }
  }
  if (!data) return { status: "error", message: GONE_OR_ARCHIVED }

  refresh()
  return { status: "success" }
}

/** Archive (hypotheses are never deleted). Restore with restoreHypothesis. */
export async function archiveHypothesis(id: string): Promise<HypothesisActionResult> {
  return setArchived(id, true)
}

/** Brings an archived hypothesis back (the archive toast's Undo, and the page's Restore). */
export async function restoreHypothesis(id: string): Promise<HypothesisActionResult> {
  return setArchived(id, false)
}

async function setArchived(id: string, archive: boolean): Promise<HypothesisActionResult> {
  await requireTeamMember()
  const parsed = hypothesisIdSchema.safeParse(id)
  if (!parsed.success) return { status: "error", message: HYPOTHESIS_MESSAGES.hypothesis }

  const supabase = await createClient()
  const update = supabase
    .from("hypotheses")
    .update({ archived_at: archive ? new Date().toISOString() : null })
    .eq("id", parsed.data)
  const { data, error } = await (
    archive ? update.is("archived_at", null) : update.not("archived_at", "is", null)
  )
    .select("id")
    .maybeSingle()
  if (error) {
    logFailure(archive ? "Archiving a hypothesis failed" : "Restoring a hypothesis failed", error)
    return { status: "error", message: friendlyDbError(error) }
  }
  if (!data) {
    return {
      status: "error",
      message: archive
        ? "This hypothesis is already archived. Refresh to see the latest."
        : "This hypothesis isn't archived any more. Refresh to see the latest.",
    }
  }

  refresh()
  return { status: "success" }
}

/** "Add evidence" on the hypothesis page: one conversation's test result. */
export async function addHypothesisTest(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireTeamMember()
  const values = formValues(formData)
  const parsed = hypothesisTestInputSchema.safeParse(readHypothesisTestForm(formData))
  if (!parsed.success) {
    const fieldErrors = fieldErrorsFrom(parsed.error)
    return {
      status: "error",
      message: fieldErrors.hypothesis_id ? HYPOTHESIS_MESSAGES.hypothesis : CHECK_FIELDS,
      fieldErrors,
      values,
    }
  }

  const supabase = await createClient()
  const hypothesis = await readHypothesis(supabase, parsed.data.hypothesis_id)
  if ("message" in hypothesis) return { status: "error", message: hypothesis.message, values }
  if (hypothesis.archived_at) return { status: "error", message: ARCHIVED, values }

  const problem = await meetingProblem(supabase, parsed.data.org_meeting_id, hypothesis)
  if (problem) {
    return { status: "error", message: problem, fieldErrors: { org_meeting_id: problem }, values }
  }

  const { data, error } = await supabase
    .from("hypothesis_tests")
    .insert({ ...parsed.data, org_meeting_id: parsed.data.org_meeting_id ?? null })
    .select("id")
    .single()
  if (error) {
    logFailure("Adding evidence failed", error)
    return {
      status: "error",
      message: friendlyDbError(error, "Couldn't add the evidence."),
      values,
    }
  }

  refresh()
  return { status: "success", id: data.id, message: "Evidence added" }
}

/** Correct a piece of evidence (tests are never deleted). */
export async function updateHypothesisTest(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireTeamMember()
  const values = formValues(formData)
  const parsed = hypothesisTestUpdateSchema.safeParse(readHypothesisTestForm(formData))
  if (!parsed.success) {
    const fieldErrors = fieldErrorsFrom(parsed.error)
    return {
      status: "error",
      message: fieldErrors.id ? HYPOTHESIS_MESSAGES.test : CHECK_FIELDS,
      fieldErrors,
      values,
    }
  }

  const { id, ...changes } = parsed.data
  const supabase = await createClient()
  const { data: test, error: readError } = await supabase
    .from("hypothesis_tests")
    .select("hypothesis_id")
    .eq("id", id)
    .maybeSingle()
  if (readError) {
    logFailure("Reading evidence failed", readError)
    return { status: "error", message: friendlyDbError(readError), values }
  }
  if (!test) return { status: "error", message: HYPOTHESIS_MESSAGES.test, values }

  const hypothesis = await readHypothesis(supabase, test.hypothesis_id)
  if ("message" in hypothesis) return { status: "error", message: hypothesis.message, values }
  if (hypothesis.archived_at) return { status: "error", message: ARCHIVED, values }

  const problem = await meetingProblem(supabase, changes.org_meeting_id, hypothesis)
  if (problem) {
    return { status: "error", message: problem, fieldErrors: { org_meeting_id: problem }, values }
  }

  const { data, error } = await supabase
    .from("hypothesis_tests")
    .update(changes)
    .eq("id", id)
    .select("id")
    .maybeSingle()
  if (error) {
    logFailure("Saving evidence failed", error)
    return { status: "error", message: friendlyDbError(error), values }
  }
  if (!data) return { status: "error", message: HYPOTHESIS_MESSAGES.test, values }

  refresh()
  return { status: "success", id, message: "Evidence updated" }
}

type HypothesisRow = {
  organization_id: string | null
  audience: "investor" | "customer" | null
  archived_at: string | null
}

/** The hypothesis a write is about, or a message when it's gone or can't be read. */
async function readHypothesis(
  supabase: ServerClient,
  id: string,
): Promise<HypothesisRow | { message: string }> {
  const { data, error } = await supabase
    .from("hypotheses")
    .select("organization_id, audience, archived_at")
    .eq("id", id)
    .maybeSingle()
  if (error) {
    logFailure("Reading a hypothesis failed", error)
    return { message: friendlyDbError(error) }
  }
  return data ?? { message: HYPOTHESIS_MESSAGES.hypothesis }
}

/**
 * Evidence can link only to a meeting with the hypothesis's org (or, for a
 * hypothesis across many, with an org of its audience). Returns a message for
 * the meeting field, or null when it's fine (or no meeting was chosen).
 */
async function meetingProblem(
  supabase: ServerClient,
  meetingId: string | null | undefined,
  hypothesis: HypothesisRow,
): Promise<string | null> {
  if (!meetingId) return null
  const { data, error } = await supabase
    .from("org_meetings")
    .select("organization_id, organization:organizations!inner ( kind )")
    .eq("id", meetingId)
    .maybeSingle()
  if (error) {
    logFailure("Reading a meeting for evidence failed", error)
    return friendlyDbError(error)
  }
  if (!data) return HYPOTHESIS_MESSAGES.meeting
  const matches = hypothesis.organization_id
    ? data.organization_id === hypothesis.organization_id
    : data.organization.kind === hypothesis.audience
  return matches ? null : HYPOTHESIS_MESSAGES.meeting
}
