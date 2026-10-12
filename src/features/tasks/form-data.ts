import { emptyToUndefined } from "@/lib/forms"
import { TASK_LINK_FIELDS, type TaskLinkField } from "@/lib/schemas/tasks"

type FormLinks = Record<TaskLinkField, string | null | undefined>

/** The task form's fields, ready for taskInputSchema / taskUpdateSchema. */
export type TaskFormInput = FormLinks & {
  id?: string
  title?: string
  next_action?: string
  owner_id?: string
  due_date?: string
  status?: string
  priority?: string
  notes?: string | null
}

/**
 * Reads the task form. Empty fields become undefined, so required ones get the
 * schema's "missing" message. On an edit, an emptied link or note becomes null,
 * which clears it (the form always sends every field).
 */
export function readTaskForm(formData: FormData, mode: "create" | "update"): TaskFormInput {
  const read = (name: string) => emptyToUndefined(formData.get(name))
  const cleared = mode === "update" ? null : undefined

  const links = {} as FormLinks
  for (const field of TASK_LINK_FIELDS) links[field] = read(field) ?? cleared

  return {
    ...(mode === "update" ? { id: read("id") } : {}),
    title: read("title"),
    next_action: read("next_action"),
    owner_id: read("owner_id"),
    due_date: read("due_date"),
    status: read("status"),
    priority: read("priority"),
    notes: read("notes") ?? cleared,
    ...links,
  }
}
