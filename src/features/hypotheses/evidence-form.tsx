"use client"

import { useActionState, useEffect, useId, useRef, useState } from "react"
import { toast } from "sonner"
import { FormMessage } from "@/components/forms/form-message"
import { SubmitButton } from "@/components/forms/submit-button"
import { Button } from "@/components/ui/button"
import { FieldError } from "@/components/ui/field"
import { RequiredMark, SelectField, TextField } from "@/features/orgs/form/fields"
import { withConnectionErrors } from "@/lib/action-calls"
import type { FormState } from "@/lib/forms"
import { TEST_OUTCOMES, testOutcomeLabels } from "@/lib/labels"
import { HYPOTHESIS_LIMITS, type HypothesisTestFormField } from "@/lib/schemas/hypotheses"
import { cn } from "@/lib/utils"
import { addHypothesisTest, updateHypothesisTest } from "./actions"
import { useDisclosure } from "./disclosure"
import { initialHypothesisFormState, type MeetingOption } from "./types"

export type EvidenceFormDefaults = Partial<Record<HypothesisTestFormField, string>>

type EvidenceFormProps = {
  defaults: EvidenceFormDefaults
  /** Meetings the evidence can come from (the hypothesis's org, or its audience's). */
  meetings: readonly MeetingOption[]
} & (
  | { mode: "create"; hypothesisId: string; testId?: never }
  | { mode: "edit"; testId: string; hypothesisId?: never }
)

export const evidenceFormActions = {
  create: withConnectionErrors(addHypothesisTest),
  edit: withConnectionErrors(updateHypothesisTest),
}

const OUTCOME_HINTS: Record<(typeof TEST_OUTCOMES)[number], string> = {
  supports: "We were right",
  contradicts: "We were wrong",
  inconclusive: "Can't tell yet",
}

/**
 * One piece of evidence: when, what it showed, what we heard, and (optional)
 * the investor or customer meeting it came from. Adding it doesn't change the
 * hypothesis's status; the team decides that on the hypothesis's page.
 *
 * Inside a DisclosurePanel, a save closes the panel and focuses the entry.
 */
export function EvidenceForm(props: EvidenceFormProps) {
  const [generation, setGeneration] = useState(0)
  return (
    <EvidenceFormBody key={generation} {...props} onCreated={() => setGeneration((n) => n + 1)} />
  )
}

function EvidenceFormBody(props: EvidenceFormProps & { onCreated: () => void }) {
  const { mode, defaults, meetings, onCreated } = props
  const [state, formAction] = useActionState<FormState, FormData>(
    evidenceFormActions[mode],
    initialHypothesisFormState,
  )
  const disclosure = useDisclosure()
  const formRef = useRef<HTMLFormElement>(null)
  const uid = useId()
  const ids = (name: string) => ({
    input: `${uid}-${name}`,
    description: `${uid}-${name}-description`,
    error: `${uid}-${name}-error`,
  })
  const value = (name: HypothesisTestFormField) =>
    state.status === "error" ? (state.values?.[name] ?? "") : (defaults[name] ?? "")
  const error = (name: string) => state.fieldErrors?.[name]

  const handled = useRef<FormState>(state)
  useEffect(() => {
    if (handled.current === state) return
    handled.current = state
    const form = formRef.current

    if (state.status === "error") {
      // The outcome's radio group is marked as a whole: focus its first option.
      const invalid = form?.querySelector<HTMLElement>('[aria-invalid="true"]')
      const target = invalid?.matches("fieldset") ? invalid.querySelector("input") : invalid
      ;(target ?? form?.querySelector<HTMLElement>('[type="submit"]'))?.focus()
      return
    }
    if (state.status !== "success") return
    toast.success(state.message ?? (mode === "create" ? "Evidence added" : "Evidence updated"))
    // A new entry takes focus; after an edit, focus goes back to its Edit button.
    const id = mode === "create" ? state.id : undefined
    disclosure?.close({ focus: id ? `[data-evidence-id="${CSS.escape(id)}"]` : undefined })
    if (mode === "create") onCreated()
  }, [state, mode, disclosure, onCreated])

  const outcomeError = error("outcome")
  const outcome = value("outcome")

  return (
    <form ref={formRef} action={formAction} noValidate className="space-y-6">
      {props.mode === "create" ? (
        <input type="hidden" name="hypothesis_id" value={props.hypothesisId} />
      ) : (
        <input type="hidden" name="id" value={props.testId} />
      )}

      <fieldset
        role="radiogroup"
        aria-required="true"
        aria-invalid={outcomeError ? true : undefined}
        aria-describedby={outcomeError ? ids("outcome").error : undefined}
        className="space-y-3"
      >
        <legend className="text-sm font-medium">
          What did it show? <RequiredMark />
        </legend>
        <div className="grid gap-2 sm:grid-cols-3">
          {TEST_OUTCOMES.map((option) => (
            <label
              key={`${option}:${outcome}`}
              className={cn(
                "flex min-h-11 cursor-pointer items-center gap-2 rounded-md border bg-background px-3 py-2 text-sm",
                "has-checked:border-primary has-checked:bg-primary/10",
                "has-focus-visible:ring-[3px] has-focus-visible:ring-ring/50",
              )}
            >
              <input
                type="radio"
                name="outcome"
                value={option}
                defaultChecked={outcome === option}
                className="size-4 shrink-0 accent-primary outline-none"
              />
              <span className="flex min-w-0 flex-col">
                <span className="font-medium">{testOutcomeLabels[option]}</span>
                <span className="text-xs text-muted-foreground">{OUTCOME_HINTS[option]}</span>
              </span>
            </label>
          ))}
        </div>
        <FieldError id={ids("outcome").error}>{outcomeError}</FieldError>
      </fieldset>

      <TextField
        name="evidence"
        label="What did we hear or see?"
        description='Facts and quotes, e.g. "Two site managers asked for a price per helmet".'
        required
        multiline
        rows={3}
        ids={ids("evidence")}
        error={error("evidence")}
        maxLength={HYPOTHESIS_LIMITS.evidence}
        defaultValue={value("evidence")}
      />

      <div className="grid gap-6 md:grid-cols-2">
        <TextField
          name="test_date"
          label="Date"
          type="date"
          required
          ids={ids("test_date")}
          error={error("test_date")}
          defaultValue={value("test_date")}
        />
        <div key={`meeting:${value("org_meeting_id")}`}>
          <SelectField
            name="org_meeting_id"
            label="From a meeting"
            description={
              meetings.length > 0
                ? "Optional. Links the evidence to the meeting's notes."
                : "No meetings logged yet. Leave it empty."
            }
            ids={ids("org_meeting_id")}
            error={error("org_meeting_id")}
            defaultValue={value("org_meeting_id")}
            emptyLabel="Not from a meeting"
            groups={[{ options: meetings.map((m) => ({ value: m.id, label: m.label })) }]}
          />
        </div>
      </div>

      <FormMessage state={state} />

      <div className="flex flex-col-reverse gap-2 md:flex-row md:items-center">
        <SubmitButton
          pendingLabel={mode === "create" ? "Adding…" : "Saving…"}
          className="max-md:w-full"
        >
          {mode === "create" ? "Add evidence" : "Save evidence"}
        </SubmitButton>
        {disclosure ? (
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
    </form>
  )
}
