import { describe, expect, it } from "vitest"
import { z } from "zod"
import { emptyToUndefined, fieldErrorsFrom, formValues, initialFormState } from "@/lib/forms"

describe("initialFormState", () => {
  it("starts idle with nothing to show", () => {
    expect(initialFormState).toEqual({ status: "idle" })
  })
})

describe("fieldErrorsFrom", () => {
  const schema = z.object({
    title: z.string({ error: "Give it a title." }).min(1, "Give it a title."),
    owner_id: z.uuid({ error: "Choose an owner." }),
    links: z.object({ org: z.uuid({ error: "Pick an org." }) }),
  })

  it("keys the first message per field by its dotted path", () => {
    const result = schema.safeParse({ title: "", owner_id: "x", links: { org: "y" } })
    expect(result.success).toBe(false)
    expect(fieldErrorsFrom(result.error!)).toEqual({
      title: "Give it a title.",
      owner_id: "Choose an owner.",
      "links.org": "Pick an org.",
    })
  })

  it("keeps only the first message when a field has several", () => {
    const twoRules = z.object({
      code: z.string().min(6, "Too short.").regex(/^\d+$/, "Digits only."),
    })
    const result = twoRules.safeParse({ code: "ab" })
    expect(fieldErrorsFrom(result.error!)).toEqual({ code: "Too short." })
  })

  it("puts errors about the whole object under _form", () => {
    const refined = z
      .object({ start: z.string(), end: z.string() })
      .refine((v) => v.end >= v.start, "The end must be after the start.")
    const result = refined.safeParse({ start: "b", end: "a" })
    expect(fieldErrorsFrom(result.error!)).toEqual({ _form: "The end must be after the start." })
  })
})

describe("formValues", () => {
  it("returns the string fields, first value per name", () => {
    const data = new FormData()
    data.append("title", "Book the room")
    data.append("tag", "a")
    data.append("tag", "b")
    data.append("empty", "")
    expect(formValues(data)).toEqual({ title: "Book the room", tag: "a", empty: "" })
  })

  it("skips files", () => {
    const data = new FormData()
    data.append("upload", new Blob(["x"]), "x.txt")
    data.append("note", "kept")
    expect(formValues(data)).toEqual({ note: "kept" })
  })
})

describe("emptyToUndefined", () => {
  it("trims, and turns empty or blank strings into undefined", () => {
    expect(emptyToUndefined("  hello ")).toBe("hello")
    expect(emptyToUndefined("")).toBeUndefined()
    expect(emptyToUndefined(" \t\n ")).toBeUndefined()
  })

  it("treats a missing field or a file as undefined", () => {
    expect(emptyToUndefined(null)).toBeUndefined()
    expect(emptyToUndefined(new File(["x"], "x.txt"))).toBeUndefined()
  })
})
