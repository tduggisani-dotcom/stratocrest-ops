import { toast } from "sonner"
import { beforeEach, describe, expect, it, vi } from "vitest"
import {
  fieldValue,
  formKey,
  invalidProps,
  useFormFeedback,
} from "@/features/people/components/use-form-feedback"
import { initialFormState, type FormState } from "@/lib/forms"

// A tiny hook runner. React keeps refs for the life of a component, also while
// <Activity> hides and shows the page, and runs the effect after a render and
// again each time the page is shown. Here each "render" reuses the refs, and
// the test runs the effect itself.
const hooks = vi.hoisted(() => ({
  refs: [] as { current: unknown }[],
  next: 0,
  effect: undefined as (() => void) | undefined,
}))

vi.mock("react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react")>()),
  useRef: (initial: unknown) => (hooks.refs[hooks.next++] ??= { current: initial }),
  useEffect: (effect: () => void) => {
    hooks.effect = effect
  },
}))
vi.mock("sonner", () => ({ toast: { success: vi.fn() } }))

const error: FormState = {
  status: "error",
  fieldErrors: { name: "Enter a name." },
  values: { name: "", role: "CFO" },
}

describe("formKey", () => {
  it("stays the same while nothing new needs showing", () => {
    expect(formKey(initialFormState)).toBe(formKey({ status: "success" }))
    expect(formKey(initialFormState, { a: 1 })).toBe(formKey({ status: "success" }, { a: 1 }))
  })

  it("changes when saved values change, so selects pick up new defaults", () => {
    expect(formKey({ status: "success" }, { a: 1 })).not.toBe(
      formKey({ status: "success" }, { a: 2 }),
    )
  })

  it("changes after an error, and with what was typed", () => {
    expect(formKey(error)).not.toBe(formKey(initialFormState))
    expect(formKey(error)).not.toBe(formKey({ ...error, values: { name: "x", role: "CFO" } }))
    expect(formKey(error)).toBe(formKey({ ...error }))
  })
})

describe("fieldValue", () => {
  it("refills what was typed after an error", () => {
    expect(fieldValue(error, "role", "CEO")).toBe("CFO")
    expect(fieldValue(error, "missing", "CEO")).toBe("")
  })

  it("shows the saved value otherwise", () => {
    expect(fieldValue(initialFormState, "role", "CEO")).toBe("CEO")
    expect(fieldValue({ status: "success" }, "role")).toBe("")
  })
})

describe("invalidProps", () => {
  it("links the error (and hint) when there is one", () => {
    expect(invalidProps("Bad", "e", "h")).toEqual({
      "aria-invalid": true,
      "aria-describedby": "h e",
    })
    expect(invalidProps("Bad", "e")).toEqual({ "aria-invalid": true, "aria-describedby": "e" })
  })

  it("keeps only the hint without an error", () => {
    expect(invalidProps(undefined, "e", "h")).toEqual({
      "aria-invalid": undefined,
      "aria-describedby": "h",
    })
    expect(invalidProps(undefined, "e")).toEqual({
      "aria-invalid": undefined,
      "aria-describedby": undefined,
    })
  })
})

describe("useFormFeedback", () => {
  const submit = { focus: vi.fn() }
  const nameField = { focus: vi.fn() }
  const form = {
    querySelector: (selector: string) =>
      selector === '[type="submit"]' ? submit : selector === '[name="name"]' ? nameField : null,
  } as unknown as HTMLFormElement

  /** A stand-in form: renders with `state`, then runs the effect as React does after a render. */
  function Form({ state }: { state: FormState }) {
    useFormFeedback(state, { current: form })
    return null
  }
  function render(state: FormState) {
    hooks.next = 0
    Form({ state })
    hooks.effect?.()
  }
  const showAgain = () => hooks.effect?.()

  beforeEach(() => {
    hooks.refs = []
    vi.clearAllMocks()
    vi.stubGlobal("CSS", { escape: (value: string) => value })
  })

  it("does nothing on the first render", () => {
    render(initialFormState)
    expect(toast.success).not.toHaveBeenCalled()
    expect(submit.focus).not.toHaveBeenCalled()
  })

  it("toasts a success once, even when the page is shown again", () => {
    render(initialFormState)
    render({ status: "success", message: "Profile saved." })
    expect(toast.success).toHaveBeenCalledExactlyOnceWith("Profile saved.")
    expect(submit.focus).toHaveBeenCalledOnce()

    // Back to a page that <Activity> kept: the effect runs again with the same result.
    showAgain()
    showAgain()
    expect(toast.success).toHaveBeenCalledOnce()
    expect(submit.focus).toHaveBeenCalledOnce()

    // The next save is a new result.
    render({ status: "success", message: "Profile saved." })
    expect(toast.success).toHaveBeenCalledTimes(2)
  })

  it("moves focus to the first invalid field once", () => {
    render(initialFormState)
    render(error)
    expect(nameField.focus).toHaveBeenCalledOnce()
    showAgain()
    expect(nameField.focus).toHaveBeenCalledOnce()
    expect(toast.success).not.toHaveBeenCalled()
  })

  it("puts focus back on the button after a whole-form error, like a failed request", () => {
    render(initialFormState)
    render({ status: "error", message: "Couldn't reach the server.", fieldErrors: {} })
    expect(submit.focus).toHaveBeenCalledOnce()
    expect(nameField.focus).not.toHaveBeenCalled()
  })
})
