import { readFileSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"
import { parseTeamEmails } from "@/lib/team-emails"

describe("parseTeamEmails", () => {
  it("reads the example value from .env.example", () => {
    const example = readFileSync(path.resolve(import.meta.dirname, "../../.env.example"), "utf8")
    const value = /^TEAM_EMAILS="(.*)"$/m.exec(example)?.[1]
    expect(value).toBeDefined()
    expect(parseTeamEmails(value!)).toEqual([
      { name: "John LaRocco", email: "john@example.com" },
      { name: "Taeyoon Eom", email: "taeyoon@example.com" },
      { name: "Brad Hall", email: "brad@example.com" },
      { name: "Sam Browning", email: "sam@example.com" },
      { name: "Ian Zalcberg", email: "ian@example.com" },
      { name: "Tanush", email: "tanush@example.com" },
    ])
  })

  it("tolerates extra spaces, line breaks, a trailing comma and quoted names", () => {
    const value = `
      John   LaRocco  <  John@Example.COM >,
      "Taeyoon Eom" <taeyoon@example.com>,,
      Tanush<tanush@example.com>,
    `
    expect(parseTeamEmails(value)).toEqual([
      { name: "John LaRocco", email: "john@example.com" },
      { name: "Taeyoon Eom", email: "taeyoon@example.com" },
      { name: "Tanush", email: "tanush@example.com" },
    ])
  })

  it("keeps names with accents, hyphens and apostrophes", () => {
    expect(parseTeamEmails("Zoë O'Neil-Ávila <zoe@example.com>")).toEqual([
      { name: "Zoë O'Neil-Ávila", email: "zoe@example.com" },
    ])
  })

  it.each(["", "   ", " , ,\n"])("rejects the empty value %j", (value) => {
    expect(() => parseTeamEmails(value)).toThrow("TEAM_EMAILS is empty.")
  })

  it("rejects an entry without a name, naming the entry", () => {
    expect(() => parseTeamEmails("John LaRocco <john@example.com>, <ian@example.com>")).toThrow(
      'Entry 2 ("<ian@example.com>") has no name.',
    )
  })

  it.each([
    ["John <john@>", "john@"],
    ["John <john@example>", "john@example"],
    ["John <john example@example.com>", "john example@example.com"],
    ["John <>", ""],
    ["John <john@@example.com>", "john@@example.com"],
  ])("rejects the invalid email in %j", (value, email) => {
    expect(() => parseTeamEmails(value)).toThrow(
      `Entry 1 ("${value}") has an invalid email address "${email}".`,
    )
  })

  it("rejects a repeated email, whatever its case", () => {
    expect(() =>
      parseTeamEmails("John LaRocco <john@example.com>, Brad Hall <JOHN@example.com>"),
    ).toThrow(
      'Entry 2 ("Brad Hall <JOHN@example.com>") repeats the email john@example.com, already used by John LaRocco.',
    )
  })

  it("rejects a repeated name", () => {
    expect(() => parseTeamEmails("Tanush <a@example.com>, tanush <b@example.com>")).toThrow(
      'Entry 2 ("tanush <b@example.com>") repeats the name tanush, already used with a@example.com.',
    )
  })

  it("rejects an entry without angle brackets", () => {
    expect(() => parseTeamEmails("John LaRocco john@example.com")).toThrow(
      'Couldn\'t read "John LaRocco john@example.com" in TEAM_EMAILS.',
    )
    // In the middle, it runs into the next entry's name.
    expect(() =>
      parseTeamEmails("John <john@example.com>, Ian ian@example.com, Brad <brad@example.com>"),
    ).toThrow('Couldn\'t read Entry 2 ("Ian ian@example.com, Brad <brad@example.com>").')
  })

  it("rejects stray text after the last entry", () => {
    expect(() => parseTeamEmails("John <john@example.com>, Brad")).toThrow(
      'Couldn\'t read "Brad" in TEAM_EMAILS.',
    )
  })

  it("rejects a stray angle bracket", () => {
    expect(() => parseTeamEmails("John <john@example.com>>, Brad <brad@example.com>")).toThrow(
      'Couldn\'t read ">".',
    )
  })

  it("rejects an email that is too long", () => {
    const email = `${"a".repeat(250)}@example.com`
    expect(() => parseTeamEmails(`John <${email}>`)).toThrow("has an invalid email address")
  })
})
