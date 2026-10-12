import { describe, expect, test } from "vitest"
import { readDebriefForm } from "./form-data"

function formData(entries: [string, string][]): FormData {
  const data = new FormData()
  for (const [key, value] of entries) data.append(key, value)
  return data
}

const fields: [string, string][] = [
  ["id", "debrief-1"],
  ["planned", "Pitch"],
  ["actual", ""],
  ["worked", "Demo"],
  ["change", ""],
  ["facilitator_id", "me"],
]

describe("readDebriefForm", () => {
  test("Save keeps the status (none sent)", () => {
    expect(readDebriefForm(formData([...fields, ["intent", "save"]]))).toEqual({
      id: "debrief-1",
      planned: "Pitch",
      actual: "",
      worked: "Demo",
      change: "",
      facilitator_id: "me",
    })
    expect(readDebriefForm(formData(fields))).not.toHaveProperty("status")
  })

  test("Save and mark done / Reopen set the status", () => {
    expect(readDebriefForm(formData([...fields, ["intent", "done"]])).status).toBe("done")
    expect(readDebriefForm(formData([...fields, ["intent", "reopen"]])).status).toBe("due")
  })

  test("an unknown intent reaches the schema as a status (and is rejected there)", () => {
    expect(readDebriefForm(formData([...fields, ["intent", "archive"]])).status).toBe("archive")
  })
})
