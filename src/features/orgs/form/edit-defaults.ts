import type { OrgDetail, OrgFormOptions } from "../queries/detail"
import type { OrgFormDefaults } from "./org-form"

/** The edit form's starting values: what the org has now, as the strings the inputs hold. */
export function editDefaults(org: OrgDetail): OrgFormDefaults {
  return {
    name: org.name,
    subtype: org.subtype ?? "",
    stage: org.stage,
    owner_id: org.owner.id,
    next_step: org.nextStep,
    next_step_date: org.nextStepDate,
    contact_name: org.contactName ?? "",
    contact_title: org.contactTitle ?? "",
    contact_email: org.contactEmail ?? "",
    contact_phone: org.contactPhone ?? "",
    link: org.link ?? "",
    city: org.city ?? "",
    state_or_country: org.stateOrCountry ?? "",
    region: org.region ?? "",
    first_contact_date: org.firstContactDate ?? "",
    first_contact_method: org.firstContactMethod ?? "",
    introduced_by: org.introducedBy ?? "",
    check_size_or_focus: org.checkSizeOrFocus ?? "",
    last_contact_date: org.manualLastContactDate ?? "",
    notes: org.notes ?? "",
    key_result_id: org.keyResult?.id ?? "",
    related_organization_id: org.related?.id ?? "",
  }
}

/**
 * The form's choices, plus whatever the org already points at but the lists
 * leave out (a former teammate, an archived key result or related org), so
 * saving never drops them silently.
 */
export function editOptions(options: OrgFormOptions, org: OrgDetail): OrgFormOptions {
  const people = options.people.some((p) => p.id === org.owner.id)
    ? options.people
    : [...options.people, { id: org.owner.id, name: `${org.owner.name} (no longer on the team)` }]

  const kr = org.keyResult
  const hasKr = kr && options.keyResults.some((g) => g.options.some((o) => o.value === kr.id))
  const keyResults =
    kr && !hasKr
      ? [
          ...options.keyResults,
          {
            label: "Linked now",
            options: [
              {
                value: kr.id,
                label: `${[kr.quarterLabel, kr.title].filter(Boolean).join(" · ")}${kr.archived ? " (archived)" : ""}`,
              },
            ],
          },
        ]
      : options.keyResults

  const related = org.related
  const relatedOrgs =
    related && !options.relatedOrgs.some((o) => o.value === related.id)
      ? [
          ...options.relatedOrgs,
          { value: related.id, label: `${related.name}${related.archived ? " (archived)" : ""}` },
        ]
      : options.relatedOrgs

  return { people, keyResults, relatedOrgs }
}
