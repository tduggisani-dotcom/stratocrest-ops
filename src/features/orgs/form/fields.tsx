import type { ReactNode } from "react"
import { ChevronRight } from "lucide-react"
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  NativeSelect,
  NativeSelectOptGroup,
  NativeSelectOption,
} from "@/components/ui/native-select"
import { Textarea } from "@/components/ui/textarea"

/**
 * The org form's building blocks: labelled inputs and selects with an
 * optional hint and an inline error (aria-invalid + aria-describedby), and the
 * collapsible groups for optional fields.
 */

export type FieldIds = { input: string; description: string; error: string }

export function RequiredMark() {
  return (
    <span className="font-normal text-muted-foreground">
      <span aria-hidden>*</span>
      <span className="sr-only">(required)</span>
    </span>
  )
}

/** aria-invalid + aria-describedby (hint, then error) for one control. */
export function invalidProps(ids: FieldIds, error: string | undefined, hasDescription: boolean) {
  const describedBy = [hasDescription ? ids.description : null, error ? ids.error : null]
    .filter(Boolean)
    .join(" ")
  return {
    "aria-invalid": error ? true : undefined,
    "aria-describedby": describedBy || undefined,
  } as const
}

type CommonProps = {
  name: string
  label: ReactNode
  description?: ReactNode
  required?: boolean
  ids: FieldIds
  error: string | undefined
  /** Shown under the error (e.g. a link to the record a duplicate name belongs to). */
  after?: ReactNode
}

export function TextField({
  name,
  label,
  description,
  required = false,
  ids,
  error,
  after,
  multiline = false,
  rows,
  ...inputProps
}: CommonProps & {
  defaultValue: string
  multiline?: boolean
  rows?: number
  maxLength?: number
  type?: "text" | "email" | "tel" | "url" | "date"
  inputMode?: "text" | "email" | "tel" | "url"
  autoComplete?: string
}) {
  const shared = {
    id: ids.input,
    name,
    "aria-required": required ? ("true" as const) : undefined,
    ...invalidProps(ids, error, Boolean(description)),
  }
  return (
    <Field data-invalid={error ? true : undefined}>
      <FieldLabel htmlFor={ids.input}>
        {label}
        {required ? <RequiredMark /> : null}
      </FieldLabel>
      {multiline ? (
        <Textarea
          {...shared}
          rows={rows}
          maxLength={inputProps.maxLength}
          defaultValue={inputProps.defaultValue}
          // The textarea sizes to its content, so set a starting height: at
          // least 44 px to tap, taller where longer text is expected.
          className={(rows ?? 0) > 2 ? "min-h-24" : undefined}
        />
      ) : (
        <Input
          {...shared}
          type={inputProps.type ?? "text"}
          inputMode={inputProps.inputMode}
          maxLength={inputProps.maxLength}
          autoComplete={inputProps.autoComplete ?? "off"}
          defaultValue={inputProps.defaultValue}
        />
      )}
      {description ? <FieldDescription id={ids.description}>{description}</FieldDescription> : null}
      <FieldError id={ids.error}>{error}</FieldError>
      {error ? after : null}
    </Field>
  )
}

export type SelectOption = { value: string; label: string }
export type SelectGroup = { label?: string; options: SelectOption[] }

/** A native select: fast, accessible, and the phone's own picker. Remount it (key) to change its default. */
export function SelectField({
  name,
  label,
  description,
  required = false,
  ids,
  error,
  after,
  defaultValue,
  emptyLabel,
  groups,
}: CommonProps & {
  defaultValue: string
  /** The "nothing chosen" option; leave out to force a choice. */
  emptyLabel?: string
  groups: SelectGroup[]
}) {
  return (
    <Field data-invalid={error ? true : undefined}>
      <FieldLabel htmlFor={ids.input}>
        {label}
        {required ? <RequiredMark /> : null}
      </FieldLabel>
      <NativeSelect
        id={ids.input}
        name={name}
        defaultValue={defaultValue}
        aria-required={required ? "true" : undefined}
        {...invalidProps(ids, error, Boolean(description))}
      >
        {emptyLabel !== undefined ? (
          <NativeSelectOption value="">{emptyLabel}</NativeSelectOption>
        ) : null}
        {groups.map((group, index) =>
          group.label ? (
            <NativeSelectOptGroup key={`${group.label}-${index}`} label={group.label}>
              {group.options.map(renderOption)}
            </NativeSelectOptGroup>
          ) : (
            group.options.map(renderOption)
          ),
        )}
      </NativeSelect>
      {description ? <FieldDescription id={ids.description}>{description}</FieldDescription> : null}
      <FieldError id={ids.error}>{error}</FieldError>
      {error ? after : null}
    </Field>
  )
}

function renderOption(option: SelectOption) {
  return (
    <NativeSelectOption key={option.value} value={option.value}>
      {option.label}
    </NativeSelectOption>
  )
}

/**
 * A group of optional fields behind a 44 px summary ("Contact · who we talk
 * to"). `open` decides how it starts; the form opens the group holding the
 * first invalid field after a failed save.
 */
export function OptionalGroup({
  title,
  hint,
  open,
  children,
}: {
  title: string
  hint: string
  open: boolean
  children: ReactNode
}) {
  return (
    <details open={open} className="group rounded-xl border">
      <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 [&::-webkit-details-marker]:hidden">
        <ChevronRight
          aria-hidden
          className="size-4 shrink-0 transition-transform group-open:rotate-90"
        />
        <span className="shrink-0">{title}</span>
        <span className="min-w-0 font-normal text-muted-foreground">{hint}</span>
      </summary>
      <div className="grid gap-6 border-t p-4 md:grid-cols-2">{children}</div>
    </details>
  )
}
