"use server"

import { refresh } from "next/cache"
import { requireTeamMember } from "@/lib/auth"
import { friendlyDbError } from "@/lib/db-errors"
import { fieldErrorsFrom, formValues, type FormState } from "@/lib/forms"
import {
  availabilityBlockSchema,
  crunchPeriodSchema,
  personIdSchema,
  profileFormInput,
  profileSchema,
  removeAvailabilityBlockSchema,
  removeCrunchPeriodSchema,
} from "@/lib/schemas/people"
import { createClient } from "@/lib/supabase/server"
import { availabilityBlockName, formatDateRange, formatTimeRange, weekdayName } from "./format"

/**
 * Profile, availability and crunch-period Server Actions. Every teammate can
 * edit every profile (spec §2); RLS and column grants enforce what can change
 * (name, role, avatar, contact preference, strengths, skills).
 * Each is a public endpoint: check the session, validate, write, refresh().
 */

const CHECK_FIELDS = "Check the highlighted fields."
const PERSON_GONE = "This teammate's profile no longer exists. Refresh the page."

export async function updateProfile(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireTeamMember()
  const values = formValues(formData)

  const id = personIdSchema.safeParse(formData.get("id"))
  if (!id.success) return { status: "error", message: PERSON_GONE, values }

  const parsed = profileSchema.safeParse(profileFormInput(formData))
  if (!parsed.success) {
    return {
      status: "error",
      message: CHECK_FIELDS,
      fieldErrors: fieldErrorsFrom(parsed.error),
      values,
    }
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("people")
    .update(parsed.data)
    .eq("id", id.data)
    .select("id")
    .maybeSingle()
  if (error) return { status: "error", message: friendlyDbError(error), values }
  if (!data) return { status: "error", message: PERSON_GONE, values }

  refresh()
  return { status: "success", message: "Profile saved.", id: data.id }
}

export async function addAvailabilityBlock(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireTeamMember()
  const values = formValues(formData)

  const parsed = availabilityBlockSchema.safeParse({
    person_id: formData.get("person_id"),
    weekday: formData.get("weekday"),
    start_time: formData.get("start_time"),
    end_time: formData.get("end_time"),
    label: formData.get("label"),
    note: formData.get("note"),
  })
  if (!parsed.success) {
    return {
      status: "error",
      message: CHECK_FIELDS,
      fieldErrors: fieldErrorsFrom(parsed.error),
      values,
    }
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("availability_blocks")
    .insert(parsed.data)
    .select("id")
    .single()
  if (error) return { status: "error", message: friendlyDbError(error), values }

  refresh()
  const block = parsed.data
  return {
    status: "success",
    message: `Added ${weekdayName(block.weekday)} ${formatTimeRange(block.start_time, block.end_time)}.`,
    id: data.id,
  }
}

export async function removeAvailabilityBlock(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireTeamMember()
  const parsed = removeAvailabilityBlockSchema.safeParse({ id: formData.get("id") })
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? CHECK_FIELDS }
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("availability_blocks")
    .delete()
    .eq("id", parsed.data.id)
    .select("weekday, start_time, label")
  if (error) return { status: "error", message: friendlyDbError(error, "Couldn't remove it.") }

  refresh()
  const removed = data[0]
  return {
    status: "success",
    message: removed
      ? `Removed the ${availabilityBlockName({ weekday: removed.weekday, startTime: removed.start_time, label: removed.label })}.`
      : "That busy time was already removed.",
  }
}

export async function addCrunchPeriod(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireTeamMember()
  const values = formValues(formData)

  const parsed = crunchPeriodSchema.safeParse({
    person_id: formData.get("person_id"),
    label: formData.get("label"),
    start_date: formData.get("start_date"),
    end_date: formData.get("end_date"),
  })
  if (!parsed.success) {
    return {
      status: "error",
      message: CHECK_FIELDS,
      fieldErrors: fieldErrorsFrom(parsed.error),
      values,
    }
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("crunch_periods")
    .insert(parsed.data)
    .select("id")
    .single()
  if (error) return { status: "error", message: friendlyDbError(error), values }

  refresh()
  const period = parsed.data
  return {
    status: "success",
    message: `Added ${period.label} (${formatDateRange(period.start_date, period.end_date)}).`,
    id: data.id,
  }
}

export async function removeCrunchPeriod(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireTeamMember()
  const parsed = removeCrunchPeriodSchema.safeParse({ id: formData.get("id") })
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? CHECK_FIELDS }
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("crunch_periods")
    .delete()
    .eq("id", parsed.data.id)
    .select("label")
  if (error) return { status: "error", message: friendlyDbError(error, "Couldn't remove it.") }

  refresh()
  const removed = data[0]
  return {
    status: "success",
    message: removed
      ? `Removed the ${removed.label} crunch period.`
      : "That crunch period was already removed.",
  }
}
