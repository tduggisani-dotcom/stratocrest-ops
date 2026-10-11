import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import type { FormState } from "@/lib/forms"
import { FormMessage } from "./form-message"

const render = (state: FormState) => renderToStaticMarkup(<FormMessage state={state} />)

/** Each top-level message: [whole tag, its role]. */
function messages(html: string) {
  return [...html.matchAll(/<p role="(alert|status)"[^>]*>.*?<\/p>/g)].map((m) => [m[0], m[1]])
}

describe("FormMessage", () => {
  it("renders nothing without an error or warnings", () => {
    expect(render({ status: "idle" })).toBe("")
    expect(render({ status: "success", message: "Saved", warnings: [] })).toBe("")
  })

  it("shows a whole-form error in red, as an alert", () => {
    const [[error, role]] = messages(render({ status: "error", message: "Couldn't save." }))
    expect(role).toBe("alert")
    expect(error).toContain("Couldn&#x27;t save.")
    expect(error).toMatch(/\btext-overdue\b/)
    expect(error).toMatch(/\bbg-overdue-soft\b/)
  })

  it("shows warnings neutrally, with a warning icon: amber means stale (spec §7)", () => {
    const html = render({
      status: "success",
      warnings: ["Sam is in a crunch period on Oct 14.", "Ian is away that day."],
    })
    const found = messages(html)
    expect(found.map(([, role]) => role)).toEqual(["status", "status"])
    for (const [warning] of found) {
      expect(warning).toMatch(/\bbg-muted\/50\b/)
      expect(warning).toMatch(/\btext-foreground\b/)
      expect(warning).not.toMatch(/\b(?:bg|text|border)-(?:stale|overdue|good)/)
      expect(warning).toMatch(/<svg[^>]*lucide-triangle-alert[^>]*text-muted-foreground/)
      expect(warning).toMatch(/<svg[^>]*aria-hidden="true"/)
    }
    expect(html).toContain("Sam is in a crunch period on Oct 14.")
  })

  it("shows an error and warnings together", () => {
    const found = messages(
      render({ status: "error", message: "Pick an owner.", warnings: ["Due on a Sunday."] }),
    )
    expect(found.map(([, role]) => role)).toEqual(["alert", "status"])
  })
})
