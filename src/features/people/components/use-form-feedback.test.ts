import { describe, expect, it } from "vitest"
import { fieldValue, formKey, invalidProps } from "@/features/people/components/use-form-feedback"
import { initialFormState, type FormState } from "@/lib/forms"

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
