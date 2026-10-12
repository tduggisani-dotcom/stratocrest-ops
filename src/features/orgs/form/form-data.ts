import { emptyToUndefined } from "@/lib/forms"
import { ORG_FORM_FIELDS, type OrgFormField } from "@/lib/schemas/organizations"

/** The org form's fields, ready for orgInputSchemaFor / orgUpdateSchemaFor. */
export type OrgFormInput = Partial<Record<OrgFormField | "id", string | null>>

/** Required fields: left empty they stay undefined, so the schema says what's missing. */
const REQUIRED = new Set<string>(["name", "owner_id", "next_step", "next_step_date", "stage"])

/**
 * Reads the org form. A field the form didn't send is left out (unchanged). An
 * emptied optional field is undefined on create and null on edit, which clears
 * it; an emptied required one is undefined, so the schema's message shows.
 */
export function readOrgForm(formData: FormData, mode: "create" | "update"): OrgFormInput {
  const input: OrgFormInput = {}
  for (const field of ORG_FORM_FIELDS) {
    if (!formData.has(field)) continue
    const value = emptyToUndefined(formData.get(field))
    input[field] = value ?? (mode === "update" && !REQUIRED.has(field) ? null : undefined)
  }
  if (mode === "update") input.id = emptyToUndefined(formData.get("id"))
  return input
}
