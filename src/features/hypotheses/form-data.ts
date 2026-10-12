import { HYPOTHESIS_FORM_FIELDS, HYPOTHESIS_TEST_FORM_FIELDS } from "@/lib/schemas/hypotheses"
import { ORG_KINDS } from "@/lib/labels"

/**
 * FormData from the hypothesis and evidence forms, as the schema input. A
 * field the form didn't send is left out (the schema leaves it as it is); a
 * field sent blank is "" (the schema turns it into null). Files are ignored.
 */

/**
 * The hypothesis form asks "Who is it about?" with one select (`about`), so
 * the org and the audience can't contradict each other: "investor" or
 * "customer" (across many of them), or one org's id.
 */
export const ABOUT_FIELD = "about"

function pick(formData: FormData, names: readonly string[]): Record<string, string> {
  const values: Record<string, string> = {}
  for (const name of names) {
    const value = formData.get(name)
    if (typeof value === "string") values[name] = value
  }
  return values
}

/** `about` -> organization_id and audience (an org's audience is set by the database). */
function readAbout(about: string): Record<string, string> {
  const value = about.trim()
  if (value === "") return { organization_id: "", audience: "" }
  if ((ORG_KINDS as readonly string[]).includes(value)) {
    return { organization_id: "", audience: value }
  }
  return { organization_id: value }
}

/** The hypothesis form (create and edit; edit also sends `id`). */
export function readHypothesisForm(formData: FormData): Record<string, string> {
  const values = pick(formData, ["id", ...HYPOTHESIS_FORM_FIELDS])
  const about = formData.get(ABOUT_FIELD)
  if (typeof about !== "string") return values
  delete values.organization_id
  delete values.audience
  return { ...values, ...readAbout(about) }
}

/** The evidence form (add sends `hypothesis_id`, edit sends `id`). */
export function readHypothesisTestForm(formData: FormData): Record<string, string> {
  return pick(formData, ["id", "hypothesis_id", ...HYPOTHESIS_TEST_FORM_FIELDS])
}
