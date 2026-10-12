import { DEBRIEF_FORM_FIELDS } from "@/lib/schemas/debriefs"

/**
 * From the debrief form's FormData to what debriefUpdateSchema reads
 * (unit-tested in form-data.test.ts).
 */

/** The form's submit buttons: name="intent". */
export const DEBRIEF_INTENTS = ["save", "done", "reopen"] as const
export type DebriefIntent = (typeof DEBRIEF_INTENTS)[number]

/** Save keeps the status; "done" marks it done; "reopen" makes it due again. */
const STATUS_FOR: Record<DebriefIntent, "done" | "due" | undefined> = {
  save: undefined,
  done: "done",
  reopen: "due",
}

export function readDebriefForm(formData: FormData): Record<string, unknown> {
  const input: Record<string, unknown> = { id: formData.get("id") ?? undefined }
  for (const field of DEBRIEF_FORM_FIELDS) {
    const value = formData.get(field)
    if (typeof value === "string") input[field] = value
  }
  const intent = formData.get("intent")
  const known = DEBRIEF_INTENTS.find((i) => i === intent)
  // An unknown intent is passed on as a status, so the schema rejects it.
  const status = known ? STATUS_FOR[known] : typeof intent === "string" ? intent : undefined
  if (status !== undefined) input.status = status
  return input
}
