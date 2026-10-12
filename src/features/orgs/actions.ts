"use server"

import { refresh } from "next/cache"
import { requireTeamMember } from "@/lib/auth"
import { friendlyDbError } from "@/lib/db-errors"
import { fieldErrorsFrom, formValues } from "@/lib/forms"
import {
  orgIdSchema,
  orgInputSchemaFor,
  orgKindMessages,
  orgKindValueSchema,
  orgUpdateSchemaFor,
} from "@/lib/schemas/organizations"
import { createClient } from "@/lib/supabase/server"
import { readOrgForm } from "./form/form-data"
import type { OrgFormState } from "./form/types"
import type { OrgKind } from "./kind-config"
import type { OrgActionResult } from "./types"

/**
 * Investor and customer Server Actions (one set for both kinds). Each one is a
 * public endpoint: it checks the session, validates with the shared Zod schema
 * for the org's kind, and writes as the signed-in person (RLS applies; triggers
 * fill created_by and updated_by, write the audit log and queue org.created).
 * Stage changes are in stage-actions.ts.
 */

const CHECK_FIELDS = "Check the highlighted fields."
const STALE_FORM = "This form is out of date. Refresh the page and try again."
const GONE = "This record was removed or no longer exists. Refresh to see the latest."

type ServerClient = Awaited<ReturnType<typeof createClient>>

/** Add form. On success the client shows "Investor added" and opens the new org's page. */
export async function createOrg(_prev: OrgFormState, formData: FormData): Promise<OrgFormState> {
  await requireTeamMember()
  const values = formValues(formData)
  const kind = orgKindValueSchema.safeParse(formData.get("kind"))
  if (!kind.success) return { status: "error", message: STALE_FORM, values }

  const parsed = orgInputSchemaFor(kind.data).safeParse(readOrgForm(formData, "create"))
  if (!parsed.success) {
    return {
      status: "error",
      message: CHECK_FIELDS,
      fieldErrors: fieldErrorsFrom(parsed.error),
      values,
    }
  }

  const supabase = await createClient()
  const relatedError = await checkRelatedOrg(
    supabase,
    kind.data,
    parsed.data.related_organization_id,
  )
  if (relatedError) {
    return {
      status: "error",
      message: CHECK_FIELDS,
      fieldErrors: { related_organization_id: relatedError },
      values,
    }
  }

  const { data, error } = await supabase
    .from("organizations")
    .insert({ ...parsed.data, kind: kind.data })
    .select("id")
    .single()
  if (error) {
    if (error.code === "23505") {
      return duplicateName(supabase, kind.data, parsed.data.name, values)
    }
    console.error("Adding an org failed", { code: error.code })
    return { status: "error", message: friendlyDbError(error, "Couldn't add it."), values }
  }

  refresh()
  return { status: "success", id: data.id }
}

/** Edit form: replaces every field it sends. Archived orgs can't be edited (restore first). */
export async function updateOrg(_prev: OrgFormState, formData: FormData): Promise<OrgFormState> {
  await requireTeamMember()
  const values = formValues(formData)
  const id = orgIdSchema.safeParse(formData.get("id"))
  if (!id.success) return { status: "error", message: STALE_FORM, values }

  const supabase = await createClient()
  const { data: org, error: readError } = await supabase
    .from("organizations")
    .select("kind, archived_at")
    .eq("id", id.data)
    .maybeSingle()
  if (readError) {
    console.error("Reading an org failed", { code: readError.code })
    return { status: "error", message: friendlyDbError(readError), values }
  }
  if (!org) return { status: "error", message: GONE, values }
  const messages = orgKindMessages(org.kind)
  if (org.archived_at) {
    return { status: "error", message: messages.archived, values }
  }

  const parsed = orgUpdateSchemaFor(org.kind).safeParse(readOrgForm(formData, "update"))
  if (!parsed.success) {
    return {
      status: "error",
      message: CHECK_FIELDS,
      fieldErrors: fieldErrorsFrom(parsed.error),
      values,
    }
  }

  const relatedError = await checkRelatedOrg(
    supabase,
    org.kind,
    parsed.data.related_organization_id,
  )
  if (relatedError) {
    return {
      status: "error",
      message: CHECK_FIELDS,
      fieldErrors: { related_organization_id: relatedError },
      values,
    }
  }

  const { id: orgId, ...changes } = parsed.data
  const { data, error } = await supabase
    .from("organizations")
    .update(changes)
    .eq("id", orgId)
    .is("archived_at", null)
    .select("id")
    .maybeSingle()
  if (error) {
    if (error.code === "23505") return duplicateName(supabase, org.kind, parsed.data.name, values)
    console.error("Saving an org failed", { code: error.code })
    return { status: "error", message: friendlyDbError(error), values }
  }
  if (!data) return { status: "error", message: messages.org, values }

  refresh()
  return { status: "success", id: orgId }
}

/** Archive (orgs are never deleted). Restore with restoreOrg. */
export async function archiveOrg(id: string): Promise<OrgActionResult> {
  return setArchived(id, true)
}

/** Brings an archived org back (the archive toast's Undo, and the org page's Restore). */
export async function restoreOrg(id: string): Promise<OrgActionResult> {
  return setArchived(id, false)
}

async function setArchived(id: string, archive: boolean): Promise<OrgActionResult> {
  await requireTeamMember()
  const parsed = orgIdSchema.safeParse(id)
  if (!parsed.success) return { status: "error", message: GONE }

  const supabase = await createClient()
  const { data: org, error: readError } = await supabase
    .from("organizations")
    .select("kind, name")
    .eq("id", parsed.data)
    .maybeSingle()
  if (readError) {
    console.error("Reading an org failed", { code: readError.code })
    return { status: "error", message: friendlyDbError(readError) }
  }
  if (!org) return { status: "error", message: GONE }

  const update = supabase
    .from("organizations")
    .update({ archived_at: archive ? new Date().toISOString() : null })
    .eq("id", parsed.data)
  const { data, error } = await (
    archive ? update.is("archived_at", null) : update.not("archived_at", "is", null)
  )
    .select("id")
    .maybeSingle()
  if (error) {
    // Restoring next to an active namesake would break the one-name-per-kind rule.
    if (error.code === "23505") {
      return {
        status: "error",
        message: `${orgKindMessages(org.kind).duplicate(org.name)} Rename one of them, then restore this one.`,
      }
    }
    console.error(archive ? "Archiving an org failed" : "Restoring an org failed", {
      code: error.code,
    })
    return { status: "error", message: friendlyDbError(error) }
  }
  if (!data) {
    return {
      status: "error",
      message: archive
        ? "This is already archived. Refresh to see the latest."
        : "This isn't archived any more. Refresh to see the latest.",
    }
  }

  refresh()
  return { status: "success" }
}

/**
 * A related org must be one of the other kind (the same company tracked as an
 * investor and as a customer). Returns the field's error, or null when fine.
 */
async function checkRelatedOrg(
  supabase: ServerClient,
  kind: OrgKind,
  relatedId: string | null | undefined,
): Promise<string | null> {
  if (!relatedId) return null
  const { data, error } = await supabase
    .from("organizations")
    .select("kind")
    .eq("id", relatedId)
    .maybeSingle()
  if (error) {
    console.error("Checking a related org failed", { code: error.code })
    return friendlyDbError(error)
  }
  return data && data.kind !== kind ? null : orgKindMessages(kind).relatedOrg
}

/**
 * The name is taken by an active org of the same kind (the unique index is on
 * lower(name)). Points at that record so the form can link to it.
 */
async function duplicateName(
  supabase: ServerClient,
  kind: OrgKind,
  name: string,
  values: Record<string, string>,
): Promise<OrgFormState> {
  const { data } = await supabase
    .from("organizations")
    .select("id, name")
    .eq("kind", kind)
    .is("archived_at", null)
  const existing = data?.find((org) => org.name.toLowerCase() === name.toLowerCase())
  return {
    status: "error",
    message: CHECK_FIELDS,
    fieldErrors: { name: orgKindMessages(kind).duplicate(existing?.name ?? name) },
    values,
    duplicate: existing ? { id: existing.id, name: existing.name } : undefined,
  }
}
