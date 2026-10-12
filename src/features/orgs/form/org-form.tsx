"use client"

import { useActionState, useEffect, useId, useRef, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowRight } from "lucide-react"
import { toast } from "sonner"
import { FormMessage } from "@/components/forms/form-message"
import { PersonSelect } from "@/components/forms/person-select"
import { SubmitButton } from "@/components/forms/submit-button"
import { Button } from "@/components/ui/button"
import { Field, FieldError, FieldLabel } from "@/components/ui/field"
import { withConnectionErrors } from "@/lib/action-calls"
import {
  CONTACT_METHODS,
  ORG_REGIONS,
  contactMethodLabels,
  orgKindLabels,
  orgRegionLabels,
  orgSubtypeLabels,
} from "@/lib/labels"
import {
  ORG_LIMITS,
  otherOrgKind,
  withArticle,
  type OrgFormField,
} from "@/lib/schemas/organizations"
import { createOrg, updateOrg } from "../actions"
import { kindConfig, OWNER_LABEL, type OrgKind } from "../kind-config"
import { orgHref, orgListHref } from "../links"
import type { OrgFormOptions } from "../queries/detail"
import { OptionalGroup, RequiredMark, SelectField, TextField, invalidProps } from "./fields"
import { initialOrgFormState, type OrgFormState } from "./types"

/** The form's starting values, as the strings the inputs hold. */
export type OrgFormDefaults = Partial<Record<OrgFormField, string>>

type OrgFormProps = {
  kind: OrgKind
  options: OrgFormOptions
  defaults: OrgFormDefaults
} & ({ mode: "create"; orgId?: never } | { mode: "edit"; orgId: string })

/**
 * The form's Server Actions. A failed request (lost signal, server error) comes
 * back as an error state with what was typed, so the form refills and says so
 * instead of the error screen replacing it.
 */
const orgFormActions = {
  create: withConnectionErrors(createOrg),
  edit: withConnectionErrors(updateOrg),
} satisfies Record<OrgFormProps["mode"], unknown>

/** Optional groups, in form order: their fields decide whether a group starts open. */
const GROUPS = {
  contact: ["contact_name", "contact_title", "contact_email", "contact_phone", "link"],
  where: ["city", "state_or_country", "region"],
  howWeMet: ["first_contact_date", "first_contact_method", "introduced_by"],
  focus: ["check_size_or_focus"],
  more: ["last_contact_date", "notes", "key_result_id", "related_organization_id"],
} as const satisfies Record<string, readonly OrgFormField[]>

/**
 * Add or edit an investor or customer (one form for both kinds, configured by
 * `kind`). Owner, next step and its date are required (principle 5); the rest
 * is optional and, when adding, tucked into groups that open on a tap.
 *
 * A plain <form> with a Server Action: inputs are uncontrolled and refilled
 * from what was submitted after an error, and focus moves to the first field
 * with a problem (opening its group). After saving, the page moves on to the
 * org's page with a toast.
 */
export function OrgForm(props: OrgFormProps) {
  // Next keeps visited pages alive (React <Activity>), so the add form would
  // otherwise come back showing the last save. Start it fresh after each one.
  const [generation, setGeneration] = useState(0)
  return <OrgFormBody key={generation} {...props} onCreated={() => setGeneration((n) => n + 1)} />
}

function OrgFormBody(props: OrgFormProps & { onCreated: () => void }) {
  const { kind, mode, options, defaults, onCreated } = props
  const config = kindConfig(kind)
  const noun = config.singular.toLowerCase()
  const otherNoun = orgKindLabels[otherOrgKind(kind)].singular.toLowerCase()
  const [state, formAction] = useActionState<OrgFormState, FormData>(
    orgFormActions[mode],
    initialOrgFormState,
  )
  const router = useRouter()
  const formRef = useRef<HTMLFormElement>(null)
  const uid = useId()
  const ids = (name: string) => ({
    input: `${uid}-${name}`,
    description: `${uid}-${name}-description`,
    error: `${uid}-${name}-error`,
  })

  /** What the field shows: what was just submitted (after an error), else the default. */
  const value = (name: OrgFormField) => state.values?.[name] ?? defaults[name] ?? ""
  const error = (name: OrgFormField) => state.fieldErrors?.[name]
  const groupOpen = (fields: readonly OrgFormField[]) =>
    mode === "edit" || fields.some((f) => value(f) !== "" || error(f) !== undefined)

  // React to each action result once, even if Activity hides and shows the page again.
  const handled = useRef<OrgFormState>(state)
  const orgId = props.orgId
  useEffect(() => {
    if (handled.current === state) return
    handled.current = state

    if (state.status === "error") {
      // Open the group holding the first field with a problem and focus it.
      const invalid = formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')
      const details = invalid?.closest("details")
      if (details) details.open = true
      ;(invalid ?? formRef.current?.querySelector<HTMLElement>('[type="submit"]'))?.focus()
      return
    }
    if (state.status !== "success") return

    const id = mode === "create" ? state.id : orgId
    if (mode === "create") {
      toast.success(`${config.singular} added`)
      onCreated()
    } else {
      toast.success("Changes saved")
    }
    router.push(id ? orgHref(kind, id) : orgListHref(kind))
  }, [state, mode, orgId, kind, config.singular, router, onCreated])

  const subtypeGroups = [
    { options: config.subtypes.map((s) => ({ value: s, label: orgSubtypeLabels[s] })) },
  ]
  const duplicate = state.duplicate

  return (
    <form ref={formRef} action={formAction} noValidate className="space-y-6">
      {mode === "edit" ? (
        <input type="hidden" name="id" value={props.orgId} />
      ) : (
        <input type="hidden" name="kind" value={kind} />
      )}

      <TextField
        name="name"
        label="Name"
        required
        ids={ids("name")}
        error={error("name")}
        maxLength={ORG_LIMITS.name}
        defaultValue={value("name")}
        autoComplete="organization"
        after={
          duplicate && duplicate.id !== orgId ? (
            <Link
              href={orgHref(kind, duplicate.id)}
              className="inline-flex min-h-11 items-center gap-1 text-sm font-medium text-primary underline-offset-4 hover:underline md:min-h-0"
            >
              Open {duplicate.name}
              <ArrowRight aria-hidden className="size-4" />
            </Link>
          ) : null
        }
      />

      <div className="grid gap-6 md:grid-cols-2">
        <SelectField
          key={`subtype:${value("subtype")}`}
          name="subtype"
          label="Type"
          ids={ids("subtype")}
          error={error("subtype")}
          defaultValue={value("subtype")}
          emptyLabel="Not set"
          groups={subtypeGroups}
        />
        {mode === "edit" ? (
          <SelectField
            key={`stage:${value("stage")}`}
            name="stage"
            label="Stage"
            required
            ids={ids("stage")}
            error={error("stage")}
            defaultValue={value("stage")}
            groups={[{ options: config.stages.map((s) => ({ value: s.value, label: s.label })) }]}
          />
        ) : null}
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Field data-invalid={error("owner_id") ? true : undefined}>
          <FieldLabel htmlFor={ids("owner_id").input}>
            {OWNER_LABEL} <RequiredMark />
          </FieldLabel>
          <PersonSelect
            // A select only picks up a new default when it remounts.
            key={`owner:${value("owner_id")}`}
            id={ids("owner_id").input}
            name="owner_id"
            people={options.people}
            defaultValue={value("owner_id")}
            aria-required="true"
            {...invalidProps(ids("owner_id"), error("owner_id"), false)}
          />
          <FieldError id={ids("owner_id").error}>{error("owner_id")}</FieldError>
        </Field>
        <TextField
          name="next_step_date"
          label="Next step date"
          type="date"
          required
          ids={ids("next_step_date")}
          error={error("next_step_date")}
          defaultValue={value("next_step_date")}
        />
      </div>

      <TextField
        name="next_step"
        label="Next step"
        description={`The very next thing to do with this ${noun}, e.g. "Send the deck to Jane".`}
        required
        multiline
        rows={2}
        ids={ids("next_step")}
        error={error("next_step")}
        maxLength={ORG_LIMITS.next_step}
        defaultValue={value("next_step")}
      />

      <div className="space-y-3">
        <OptionalGroup
          title="Contact"
          hint="who we talk to and how to reach them"
          open={groupOpen(GROUPS.contact)}
        >
          <TextField
            name="contact_name"
            label="Contact name"
            ids={ids("contact_name")}
            error={error("contact_name")}
            maxLength={ORG_LIMITS.contact_name}
            defaultValue={value("contact_name")}
          />
          <TextField
            name="contact_title"
            label="Their title"
            ids={ids("contact_title")}
            error={error("contact_title")}
            maxLength={ORG_LIMITS.contact_title}
            defaultValue={value("contact_title")}
          />
          <TextField
            name="contact_email"
            label="Email"
            type="email"
            inputMode="email"
            ids={ids("contact_email")}
            error={error("contact_email")}
            maxLength={ORG_LIMITS.contact_email}
            defaultValue={value("contact_email")}
          />
          <TextField
            name="contact_phone"
            label="Phone"
            type="tel"
            inputMode="tel"
            ids={ids("contact_phone")}
            error={error("contact_phone")}
            maxLength={ORG_LIMITS.contact_phone}
            defaultValue={value("contact_phone")}
          />
          <div className="md:col-span-2">
            <TextField
              name="link"
              label="Website or LinkedIn"
              type="url"
              inputMode="url"
              description="A link that starts with https:// (we add it if you leave it off)."
              ids={ids("link")}
              error={error("link")}
              maxLength={ORG_LIMITS.link}
              defaultValue={value("link")}
            />
          </div>
        </OptionalGroup>

        <OptionalGroup title="Where" hint="city and region" open={groupOpen(GROUPS.where)}>
          <TextField
            name="city"
            label="City"
            ids={ids("city")}
            error={error("city")}
            maxLength={ORG_LIMITS.city}
            defaultValue={value("city")}
          />
          <TextField
            name="state_or_country"
            label="State or country"
            ids={ids("state_or_country")}
            error={error("state_or_country")}
            maxLength={ORG_LIMITS.state_or_country}
            defaultValue={value("state_or_country")}
          />
          <SelectField
            key={`region:${value("region")}`}
            name="region"
            label="Region"
            ids={ids("region")}
            error={error("region")}
            defaultValue={value("region")}
            emptyLabel="Not set"
            groups={[
              { options: ORG_REGIONS.map((r) => ({ value: r, label: orgRegionLabels[r] })) },
            ]}
          />
        </OptionalGroup>

        <OptionalGroup
          title="How we met"
          hint="first contact and who introduced us"
          open={groupOpen(GROUPS.howWeMet)}
        >
          <TextField
            name="first_contact_date"
            label="First contact"
            type="date"
            ids={ids("first_contact_date")}
            error={error("first_contact_date")}
            defaultValue={value("first_contact_date")}
          />
          <SelectField
            key={`method:${value("first_contact_method")}`}
            name="first_contact_method"
            label="How we got in touch"
            ids={ids("first_contact_method")}
            error={error("first_contact_method")}
            defaultValue={value("first_contact_method")}
            emptyLabel="Not set"
            groups={[
              {
                options: CONTACT_METHODS.map((m) => ({ value: m, label: contactMethodLabels[m] })),
              },
            ]}
          />
          <div className="md:col-span-2">
            <TextField
              name="introduced_by"
              label="Introduced by"
              ids={ids("introduced_by")}
              error={error("introduced_by")}
              maxLength={ORG_LIMITS.introduced_by}
              defaultValue={value("introduced_by")}
            />
          </div>
        </OptionalGroup>

        <OptionalGroup
          title={config.focusLabel}
          hint={`what this ${noun} is looking for`}
          open={groupOpen(GROUPS.focus)}
        >
          <div className="md:col-span-2">
            <TextField
              name="check_size_or_focus"
              label={config.focusLabel}
              description={config.focusHint}
              multiline
              rows={2}
              ids={ids("check_size_or_focus")}
              error={error("check_size_or_focus")}
              maxLength={ORG_LIMITS.check_size_or_focus}
              defaultValue={value("check_size_or_focus")}
            />
          </div>
        </OptionalGroup>

        <OptionalGroup
          title="More"
          hint="last contact, notes and links"
          open={groupOpen(GROUPS.more)}
        >
          <TextField
            name="last_contact_date"
            label="Last contact outside meetings"
            type="date"
            description="An email or call that wasn't a logged meeting. Logged meetings count on their own."
            ids={ids("last_contact_date")}
            error={error("last_contact_date")}
            defaultValue={value("last_contact_date")}
          />
          <SelectField
            key={`kr:${value("key_result_id")}`}
            name="key_result_id"
            label="Key result it moves forward"
            description={options.keyResults.length === 0 ? "No key results yet." : undefined}
            ids={ids("key_result_id")}
            error={error("key_result_id")}
            defaultValue={value("key_result_id")}
            emptyLabel="None"
            groups={options.keyResults}
          />
          <div className="md:col-span-2">
            <SelectField
              key={`related:${value("related_organization_id")}`}
              name="related_organization_id"
              label={`Same company on the ${otherNoun} list`}
              description={
                options.relatedOrgs.length === 0
                  ? `No ${otherNoun}s yet.`
                  : `When this company is also tracked as ${withArticle(otherNoun)}.`
              }
              ids={ids("related_organization_id")}
              error={error("related_organization_id")}
              defaultValue={value("related_organization_id")}
              emptyLabel="None"
              groups={[{ options: options.relatedOrgs }]}
            />
          </div>
          <div className="md:col-span-2">
            <TextField
              name="notes"
              label="Notes"
              description="Anything the team should know that doesn't fit above."
              multiline
              rows={4}
              ids={ids("notes")}
              error={error("notes")}
              maxLength={ORG_LIMITS.notes}
              defaultValue={value("notes")}
            />
          </div>
        </OptionalGroup>
      </div>

      <FormMessage state={state} />

      <div className="flex flex-col-reverse gap-2 md:flex-row md:items-center">
        <SubmitButton
          pendingLabel={mode === "create" ? "Adding…" : "Saving…"}
          className="max-md:w-full"
        >
          {mode === "create" ? config.addLabel : "Save changes"}
        </SubmitButton>
        <Button asChild variant="ghost" className="max-md:w-full">
          <Link href={props.orgId ? orgHref(kind, props.orgId) : orgListHref(kind)}>Cancel</Link>
        </Button>
      </div>
    </form>
  )
}
