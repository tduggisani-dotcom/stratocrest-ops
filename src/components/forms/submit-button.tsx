"use client"

import { useFormStatus } from "react-dom"
import { Loader2Icon } from "lucide-react"
import { Button } from "@/components/ui/button"

/** The form's submit button: disabled and labelled while the Server Action runs. */
export function SubmitButton({
  children,
  pendingLabel = "Saving…",
  ...props
}: React.ComponentProps<typeof Button> & { pendingLabel?: string }) {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={pending || props.disabled} aria-disabled={pending} {...props}>
      {pending ? (
        <>
          <Loader2Icon className="animate-spin" aria-hidden="true" />
          {pendingLabel}
        </>
      ) : (
        children
      )}
    </Button>
  )
}
