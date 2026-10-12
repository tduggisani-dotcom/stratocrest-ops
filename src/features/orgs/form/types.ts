import type { FormState } from "@/lib/forms"
import type { OrgFormField } from "@/lib/schemas/organizations"

/**
 * The org form's state (kept out of actions.ts: a "use server" file may only
 * export async functions). `duplicate` is the record a clashing name belongs
 * to, so the form can link to it.
 */
export type OrgFormState = FormState<OrgFormField | "id" | "kind"> & {
  duplicate?: { id: string; name: string }
}

export const initialOrgFormState: OrgFormState = { status: "idle" }
