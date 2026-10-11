"use client"

import { useActionState } from "react"
import { Loader2Icon, Trash2Icon } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { CONNECTION_ERROR, callAction } from "@/lib/action-calls"
import { initialFormState, type FormState } from "@/lib/forms"

type RemoveAction = (prev: FormState, formData: FormData) => Promise<FormState>

/**
 * An icon button that deletes one row (an availability block, a crunch
 * period). `label` is its accessible name, e.g. "Remove Monday 9:00 AM class
 * block". The row disappears when the page refreshes, so the toast is raised
 * as soon as the action answers, and focus moves to `returnFocusId` (the
 * section heading) instead of being lost with the button. A request that
 * fails (no signal, server error) shows an error toast and keeps the row.
 */
export function RemoveButton({
  action,
  id,
  label,
  returnFocusId,
}: {
  action: RemoveAction
  id: string
  label: string
  returnFocusId: string
}) {
  const [, formAction, pending] = useActionState(async (prev: FormState, formData: FormData) => {
    const failed: FormState = { status: "error", message: CONNECTION_ERROR }
    const result = await callAction(() => action(prev, formData), failed)
    if (result.status === "success") {
      document.getElementById(returnFocusId)?.focus()
      toast.success(result.message ?? "Removed.")
    } else if (result.status === "error") {
      toast.error(result.message ?? "Couldn't remove it. Please try again.")
    }
    return result
  }, initialFormState)

  return (
    <form action={formAction} className="shrink-0">
      <input type="hidden" name="id" value={id} />
      <Button
        type="submit"
        variant="ghost"
        size="icon"
        aria-label={label}
        title={label}
        disabled={pending}
        className="text-muted-foreground hover:text-foreground"
      >
        {pending ? (
          <Loader2Icon className="animate-spin" aria-hidden />
        ) : (
          <Trash2Icon aria-hidden />
        )}
      </Button>
    </form>
  )
}
