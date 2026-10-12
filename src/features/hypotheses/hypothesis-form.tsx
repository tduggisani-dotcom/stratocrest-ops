"use client"

import { useActionState, useEffect, useId, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { FormMessage } from "@/components/forms/form-message"
import { PersonSelect } from "@/components/forms/person-select"
import { SubmitButton } from "@/components/forms/submit-button"
import { Button } from "@/components/ui/button"
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field"
import { SelectField, TextField, invalidProps, type SelectGroup } from "@/features/orgs/form/fields"
import { hypothesisHref } from "@/features/orgs/links"
import { withConnectionErrors } from "@/lib/action-calls"
import type { FormState } from "@/lib/forms"
import {
  HYPOTHESIS_DECISIONS,
  ORG_KINDS,
  hypothesisDecisionLabels,
  orgKindLabels,
} from "@/lib/labels"
import { HYPOTHESIS_LIMITS, type HypothesisFormField } from "@/lib/schemas/hypotheses"
import { createHypothesis, updateHypothesis } from "./actions"
import { useDisclosure } from "./disclosure"
import { ABOUT_FIELD } from "./form-data"
import { initialHypothesisFormState, type OrgOption } from "./types"

/** The form's starting values, as the strings the inputs hold. */
export type HypothesisFormDefaults = Partial<
  Record<HypothesisFormField | typeof ABOUT_FIELD, string>
>

type Person = { id: string; name: string }

type HypothesisFormProps = {
  people: readonly Person[]
  defaults: HypothesisFormDefaults
} & (
  | {
      /** Add, from an org's page: the hypothesis is about that org. */
      mode: "create"
      orgId: string
      orgs?: never
      hypothesisId?: never
    }
  | {
      /** Add, from the roll-up: "Who is it about?" is asked. */
      mode: "create"
      orgId?: never
      orgs: readonly OrgOption[]
      hypothesisId?: never
    }
  | {
      /** Edit every field but the status (it has its own menu). */
      mode: "edit"
      hypothesisId: string
      orgs: readonly OrgOption[]
      orgId?: never
    }
)

/**
 * A failed request (lost signal, server error) comes back as an error state
 * with what was typed, so the form refills instead of the error screen.
 */
export const hypothesisFormActions = {
  create: withConnectionErrors(createHypothesis),
  edit: withConnectionErrors(updateHypothesis),
}

/** Errors for the org or the audience belong to the one "Who is it about?" select. */
const ABOUT_ERRORS = ["organization_id", "audience"] as const

/**
 * Add or edit a hypothesis (spec §3 principle 2): what we believe, how we'll
 * test it and what would prove it; later, what happened, what we learned and
 * the decision. Only the statement is required (plus who it's about, when
 * it's not added from an org's page).
 *
 * A plain <form> with a Server Action: inputs are uncontrolled and refilled
 * from what was submitted after an error; focus moves to the first field
 * with a problem. Inside a DisclosurePanel, a save closes the panel and
 * focuses the new hypothesis in the list.
 */
export function HypothesisForm(props: HypothesisFormProps) {
  // Start a new-hypothesis form fresh after each save (Next keeps the page alive).
  const [generation, setGeneration] = useState(0)
  return (
    <HypothesisFormBody key={generation} {...props} onCreated={() => setGeneration((n) => n + 1)} />
  )
}

function HypothesisFormBody(props: HypothesisFormProps & { onCreated: () => void }) {
  const { mode, people, defaults, onCreated } = props
  const [state, formAction] = useActionState<FormState, FormData>(
    hypothesisFormActions[mode],
    initialHypothesisFormState,
  )
  const router = useRouter()
  const disclosure = useDisclosure()
  const formRef = useRef<HTMLFormElement>(null)
  const uid = useId()
  const ids = (name: string) => ({
    input: `${uid}-${name}`,
    description: `${uid}-${name}-description`,
    error: `${uid}-${name}-error`,
  })

  /** What a field shows: what was just submitted (after an error), else the default. */
  const value = (name: keyof HypothesisFormDefaults) =>
    state.status === "error" ? (state.values?.[name] ?? "") : (defaults[name] ?? "")
  const error = (name: string) => state.fieldErrors?.[name]
  const aboutError = ABOUT_ERRORS.map(error).find(Boolean)

  // React to each result once, even when Activity hides and shows the page again.
  const handled = useRef<FormState>(state)
  useEffect(() => {
    if (handled.current === state) return
    handled.current = state
    const form = formRef.current

    if (state.status === "error") {
      const invalid = form?.querySelector<HTMLElement>('[aria-invalid="true"]')
      ;(invalid ?? form?.querySelector<HTMLElement>('[type="submit"]'))?.focus()
      return
    }
    if (state.status !== "success") return

    if (mode === "edit") {
      toast.success(state.message ?? "Changes saved")
      form?.querySelector<HTMLElement>('[type="submit"]')?.focus()
      return
    }
    const id = state.id
    toast.success(state.message ?? "Hypothesis added", {
      action: id ? { label: "Open", onClick: () => router.push(hypothesisHref(id)) } : undefined,
    })
    disclosure?.close({
      focus: id ? `[data-hypothesis-id="${CSS.escape(id)}"] [data-hypothesis-link]` : undefined,
    })
    onCreated()
  }, [state, mode, router, disclosure, onCreated])

  const asksAbout = props.orgId === undefined

  return (
    <form ref={formRef} action={formAction} noValidate className="space-y-6">
      {props.mode === "edit" ? <input type="hidden" name="id" value={props.hypothesisId} /> : null}
      {props.orgId !== undefined ? (
        <input type="hidden" name="organization_id" value={props.orgId} />
      ) : null}

      <TextField
        name="statement"
        label="What do we believe?"
        description='One sentence a conversation could prove wrong, e.g. "Site managers will pay for impact alerts".'
        required
        multiline
        rows={2}
        ids={ids("statement")}
        error={error("statement")}
        maxLength={HYPOTHESIS_LIMITS.statement}
        defaultValue={value("statement")}
      />

      <div className="grid gap-6 md:grid-cols-2">
        {asksAbout ? (
          <div key={`about:${value(ABOUT_FIELD)}`} className="contents">
            <SelectField
              name={ABOUT_FIELD}
              label="Who is it about?"
              description="Many investors or customers, or just one."
              required
              ids={ids(ABOUT_FIELD)}
              error={aboutError}
              defaultValue={value(ABOUT_FIELD)}
              emptyLabel={value(ABOUT_FIELD) ? undefined : "Choose…"}
              groups={aboutGroups(props.orgs ?? [])}
            />
          </div>
        ) : null}

        <Field data-invalid={error("owner_id") ? true : undefined}>
          <FieldLabel htmlFor={ids("owner_id").input}>Owner</FieldLabel>
          <PersonSelect
            // A select only picks up a new default when it remounts.
            key={`owner:${value("owner_id")}`}
            id={ids("owner_id").input}
            name="owner_id"
            people={people}
            emptyLabel="Nobody yet"
            defaultValue={value("owner_id")}
            {...invalidProps(ids("owner_id"), error("owner_id"), true)}
          />
          <FieldDescription id={ids("owner_id").description}>
            Who makes sure it gets tested.
          </FieldDescription>
          <FieldError id={ids("owner_id").error}>{error("owner_id")}</FieldError>
        </Field>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <TextField
          name="test_plan"
          label="How we'll test it"
          description="Who we'll ask, and what we'll show or measure."
          multiline
          rows={3}
          ids={ids("test_plan")}
          error={error("test_plan")}
          maxLength={HYPOTHESIS_LIMITS.test_plan}
          defaultValue={value("test_plan")}
        />
        <TextField
          name="success_criterion"
          label="What would validate it"
          description='For example: "3 of 5 site managers ask for a price".'
          multiline
          rows={3}
          ids={ids("success_criterion")}
          error={error("success_criterion")}
          maxLength={HYPOTHESIS_LIMITS.success_criterion}
          defaultValue={value("success_criterion")}
        />
      </div>

      {mode === "edit" ? (
        <>
          <div className="grid gap-6 md:grid-cols-2">
            <TextField
              name="result"
              label="What happened"
              multiline
              rows={3}
              ids={ids("result")}
              error={error("result")}
              maxLength={HYPOTHESIS_LIMITS.result}
              defaultValue={value("result")}
            />
            <TextField
              name="learning"
              label="What we learned"
              multiline
              rows={3}
              ids={ids("learning")}
              error={error("learning")}
              maxLength={HYPOTHESIS_LIMITS.learning}
              defaultValue={value("learning")}
            />
          </div>
          <div key={`decision:${value("decision")}`} className="md:max-w-sm">
            <SelectField
              name="decision"
              label="Decision"
              description="Persevere: keep going. Pivot: change the approach. Drop: stop."
              ids={ids("decision")}
              error={error("decision")}
              defaultValue={value("decision")}
              emptyLabel="Not decided yet"
              groups={[
                {
                  options: HYPOTHESIS_DECISIONS.map((d) => ({
                    value: d,
                    label: hypothesisDecisionLabels[d],
                  })),
                },
              ]}
            />
          </div>
        </>
      ) : null}

      <FormMessage state={state} />

      <div className="flex flex-col-reverse gap-2 md:flex-row md:items-center">
        <SubmitButton
          pendingLabel={mode === "create" ? "Adding…" : "Saving…"}
          className="max-md:w-full"
        >
          {mode === "create" ? "Add hypothesis" : "Save changes"}
        </SubmitButton>
        {mode === "create" && disclosure ? (
          <Button
            type="button"
            variant="ghost"
            className="max-md:w-full"
            onClick={() => disclosure.close()}
          >
            Cancel
          </Button>
        ) : null}
      </div>
      {mode === "create" ? (
        <p className="text-xs text-pretty text-muted-foreground">
          What happened, what we learned and the decision are added later, on its page.
        </p>
      ) : null}
    </form>
  )
}

/**
 * "Who is it about?": many investors or many customers, or one of them (by
 * kind, then name).
 */
export function aboutGroups(orgs: readonly OrgOption[]): SelectGroup[] {
  return [
    {
      label: "Many",
      options: ORG_KINDS.map((kind) => ({
        value: kind,
        label: `${orgKindLabels[kind].plural} in general`,
      })),
    },
    ...ORG_KINDS.map((kind) => ({
      label: `One of our ${orgKindLabels[kind].plural.toLowerCase()}`,
      options: orgs
        .filter((org) => org.kind === kind)
        .map((org) => ({ value: org.id, label: org.name })),
    })).filter((group) => group.options.length > 0),
  ]
}
