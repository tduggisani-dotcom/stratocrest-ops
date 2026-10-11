import { renderToStaticMarkup } from "react-dom/server"
import { toast } from "sonner"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  addAvailabilityBlock,
  addCrunchPeriod,
  removeCrunchPeriod,
  updateProfile,
} from "@/features/people/actions"
import { CONNECTION_ERROR } from "@/lib/action-calls"
import { initialFormState, type FormState } from "@/lib/forms"
import { AvailabilityForm } from "./availability-form"
import { CrunchForm } from "./crunch-form"
import { ProfileForm } from "./profile-form"
import { RemoveButton } from "./remove-button"

/**
 * A Server Action call that rejects (no signal, a server exception) must come
 * back as the form's normal error state, not reach the error boundary that
 * replaces the page. Each form is rendered once to capture the action it gives
 * `useActionState`, which is then called with a failing Server Action.
 */

type FormAction = (previous: FormState, formData: FormData) => Promise<FormState>

const captured = vi.hoisted(() => ({ actions: [] as unknown[] }))

vi.mock("react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react")>()),
  useActionState: (action: unknown, initial: unknown) => {
    captured.actions.push(action)
    return [initial, () => {}, false]
  },
}))
vi.mock("@/features/people/actions", () => ({
  updateProfile: vi.fn(),
  addAvailabilityBlock: vi.fn(),
  addCrunchPeriod: vi.fn(),
  removeAvailabilityBlock: vi.fn(),
  removeCrunchPeriod: vi.fn(),
}))
vi.mock("next/navigation", () => ({ unstable_rethrow: () => {} }))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

/** Renders `element` and returns the action it passed to `useActionState`. */
function actionOf(element: React.ReactElement): FormAction {
  captured.actions = []
  renderToStaticMarkup(element)
  expect(captured.actions).toHaveLength(1)
  return captured.actions[0] as FormAction
}

function formData(entries: Record<string, string>): FormData {
  const data = new FormData()
  for (const [key, value] of Object.entries(entries)) data.set(key, value)
  return data
}

const PERSON_ID = "9121d9ea-4e09-4197-a954-7f5c2105f1b7"
const offline = () => Promise.reject(new TypeError("Failed to fetch"))

beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(console, "error").mockImplementation(() => {})
})
afterEach(() => vi.restoreAllMocks())

describe("a failed request keeps the form", () => {
  const forms: {
    name: string
    serverAction: FormAction
    element: React.ReactElement
    typed: Record<string, string>
  }[] = [
    {
      name: "ProfileForm",
      serverAction: updateProfile,
      element: (
        <ProfileForm
          isMe
          person={{
            id: PERSON_ID,
            name: "Sam Browning",
            role: "CTO",
            avatarUrl: null,
            contactPreference: null,
            strengths: [],
            skills: [],
          }}
        />
      ),
      typed: { id: PERSON_ID, name: "Sam Browning", contact_preference: "Text first" },
    },
    {
      name: "AvailabilityForm",
      serverAction: addAvailabilityBlock,
      element: <AvailabilityForm personId={PERSON_ID} headingId="busy-add-heading" />,
      typed: { person_id: PERSON_ID, weekday: "3", start_time: "14:00", note: "ECON 101" },
    },
    {
      name: "CrunchForm",
      serverAction: addCrunchPeriod,
      element: <CrunchForm personId={PERSON_ID} headingId="crunch-add-heading" />,
      typed: { person_id: PERSON_ID, label: "Finals", start_date: "2026-12-07" },
    },
  ]

  for (const form of forms) {
    it(`${form.name}: shows the connection error and refills what was typed`, async () => {
      vi.mocked(form.serverAction).mockImplementation(offline)
      const action = actionOf(form.element)

      const state = await action(initialFormState, formData(form.typed))

      expect(form.serverAction).toHaveBeenCalledOnce()
      expect(state).toMatchObject({
        status: "error",
        message: CONNECTION_ERROR,
        fieldErrors: {},
        values: form.typed,
      })
    })

    it(`${form.name}: passes the action's own answer through`, async () => {
      vi.mocked(form.serverAction).mockResolvedValue({ status: "success", message: "Saved." })
      const action = actionOf(form.element)
      await expect(action(initialFormState, formData(form.typed))).resolves.toEqual({
        status: "success",
        message: "Saved.",
      })
    })
  }
})

describe("RemoveButton", () => {
  const element = (
    <RemoveButton
      action={removeCrunchPeriod}
      id="c1"
      label="Remove Finals crunch period"
      returnFocusId="crunch-heading"
    />
  )

  it("a failed request shows an error toast instead of the error screen", async () => {
    vi.mocked(removeCrunchPeriod).mockImplementation(offline)
    const action = actionOf(element)

    const state = await action(initialFormState, formData({ id: "c1" }))

    expect(state).toMatchObject({ status: "error", message: CONNECTION_ERROR })
    expect(toast.error).toHaveBeenCalledExactlyOnceWith(CONNECTION_ERROR)
    expect(toast.success).not.toHaveBeenCalled()
  })

  it("shows the action's own error message", async () => {
    vi.mocked(removeCrunchPeriod).mockResolvedValue({ status: "error", message: "Already gone." })
    await actionOf(element)(initialFormState, formData({ id: "c1" }))
    expect(toast.error).toHaveBeenCalledExactlyOnceWith("Already gone.")
  })
})
