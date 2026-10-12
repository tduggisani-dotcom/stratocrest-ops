"use client"

import {
  useActionState,
  useEffect,
  useRef,
  useState,
  type ClipboardEvent,
  type FormEvent,
} from "react"
import { ArrowLeft, LoaderCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { requestCode, verifyCode } from "@/features/auth/actions"
import {
  initialRequestCodeState,
  initialVerifyState,
  type RequestCodeState,
} from "@/features/auth/form-state"
import { OTP_LENGTH, type SignInReason } from "@/lib/schemas/auth"
import { cn } from "@/lib/utils"

const REASON_MESSAGES: Record<SignInReason, string> = {
  "signed-out": "Please sign in to continue.",
  "not-on-team": "Your account isn't active on the StratoCrest team.",
}

type RequestAction = (payload: FormData) => void

/**
 * Two steps on one page: (1) email → we send a code and a link; (2) type the
 * 6-digit code. Typing the code matters on phones, where the email link may
 * open in a different browser than the home-screen app.
 */
export function SignInForm({ next, reason }: { next: string; reason?: SignInReason }) {
  const [request, requestAction, requestPending] = useActionState(
    requestCode,
    initialRequestCodeState,
  )
  // "Use a different email" hides the result on screen; any newer result shows again.
  const [dismissed, setDismissed] = useState<RequestCodeState | null>(null)

  if (request.step === "code" && request !== dismissed) {
    return (
      <CodeStep
        request={request}
        requestAction={requestAction}
        requestPending={requestPending}
        next={next}
        onUseDifferentEmail={() => setDismissed(request)}
      />
    )
  }

  return (
    <EmailStep
      request={request}
      action={requestAction}
      pending={requestPending}
      next={next}
      reason={request === initialRequestCodeState ? reason : undefined}
    />
  )
}

function EmailStep({
  request,
  action,
  pending,
  next,
  reason,
}: {
  request: RequestCodeState
  action: RequestAction
  pending: boolean
  next: string
  reason?: SignInReason
}) {
  const error = request.step === "email" ? request.error : undefined
  const inputRef = useRef<HTMLInputElement>(null)

  // Send focus back to the field when the server rejects it.
  useEffect(() => {
    if (error) inputRef.current?.focus()
  }, [request, error])

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2 className="text-lg">Sign in</h2>
        </CardTitle>
        <CardDescription>We&apos;ll email you a 6-digit code and a sign-in link.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {reason ? (
          <p role="status" className="rounded-md border bg-muted px-3 py-2 text-sm">
            {REASON_MESSAGES[reason]}
          </p>
        ) : null}
        <form action={action} noValidate className="space-y-4">
          <input type="hidden" name="next" value={next} />
          <Field data-invalid={error ? true : undefined}>
            <FieldLabel htmlFor="sign-in-email">Email</FieldLabel>
            <Input
              ref={inputRef}
              id="sign-in-email"
              name="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              required
              defaultValue={request.email}
              autoFocus
              aria-invalid={error ? true : undefined}
              aria-describedby="sign-in-email-message"
            />
            <p id="sign-in-email-message" aria-live="polite" className="text-sm text-destructive">
              {error}
            </p>
          </Field>
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? (
              <>
                <LoaderCircle aria-hidden className="animate-spin" />
                Sending…
              </>
            ) : (
              "Email me a code"
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}

function CodeStep({
  request,
  requestAction,
  requestPending,
  next,
  onUseDifferentEmail,
}: {
  request: RequestCodeState
  requestAction: RequestAction
  requestPending: boolean
  next: string
  onUseDifferentEmail: () => void
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2 className="text-lg">Check your email</h2>
        </CardTitle>
        <CardDescription>
          We sent a 6-digit code to{" "}
          <span className="font-medium break-all text-foreground">{request.email}</span>. Enter it
          here, or tap the link in the email. The code expires in 1 hour.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* A new code (Resend) starts this form fresh: empty, focused, no old error. */}
        <CodeForm key={request.sentAt ?? 0} email={request.email} next={next} />

        <div className="flex flex-wrap items-center justify-between gap-2">
          <Button type="button" variant="ghost" className="-ml-3" onClick={onUseDifferentEmail}>
            <ArrowLeft aria-hidden />
            Use a different email
          </Button>
          <form action={requestAction}>
            <input type="hidden" name="intent" value="resend" />
            <input type="hidden" name="email" value={request.email} />
            <input type="hidden" name="next" value={next} />
            <Button type="submit" variant="ghost" className="-mr-3" disabled={requestPending}>
              {requestPending ? (
                <>
                  <LoaderCircle aria-hidden className="animate-spin" />
                  Sending…
                </>
              ) : (
                "Resend code"
              )}
            </Button>
          </form>
        </div>
        <p
          aria-live="polite"
          className={cn("text-sm", request.error ? "text-destructive" : "text-muted-foreground")}
        >
          {request.error ?? request.notice}
        </p>
      </CardContent>
    </Card>
  )
}

function CodeForm({ email, next }: { email: string; next: string }) {
  const [state, action, pending] = useActionState(verifyCode, initialVerifyState)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (state.error) inputRef.current?.focus()
  }, [state])

  return (
    <form action={action} noValidate className="space-y-4">
      <input type="hidden" name="email" value={email} />
      <input type="hidden" name="next" value={next} />
      <Field data-invalid={state.error ? true : undefined}>
        <FieldLabel htmlFor="sign-in-code">6-digit code</FieldLabel>
        <Input
          ref={inputRef}
          id="sign-in-code"
          name="code"
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]{6}"
          maxLength={OTP_LENGTH}
          required
          autoFocus
          onInput={keepDigits}
          onPaste={pasteDigits}
          className="text-center font-mono text-lg tracking-[0.5em] md:text-lg"
          aria-invalid={state.error ? true : undefined}
          aria-describedby="sign-in-code-message"
        />
        <p id="sign-in-code-message" aria-live="polite" className="text-sm text-destructive">
          {state.error}
        </p>
      </Field>
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? (
          <>
            <LoaderCircle aria-hidden className="animate-spin" />
            Signing in…
          </>
        ) : (
          "Sign in"
        )}
      </Button>
    </form>
  )
}

/** Digits only, at most 6. */
function digitsOf(value: string) {
  return value.replace(/\D/g, "").slice(0, OTP_LENGTH)
}

function keepDigits(event: FormEvent<HTMLInputElement>) {
  const input = event.currentTarget
  const digits = digitsOf(input.value)
  if (digits !== input.value) input.value = digits
}

/** maxLength would cut "123 456" to "123 45", so clean a pasted code before it lands. */
function pasteDigits(event: ClipboardEvent<HTMLInputElement>) {
  const pasted = event.clipboardData.getData("text")
  if (!/\D/.test(pasted)) return
  event.preventDefault()
  event.currentTarget.value = digitsOf(pasted)
}
