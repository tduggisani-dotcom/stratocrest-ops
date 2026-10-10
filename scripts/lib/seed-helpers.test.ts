import { describe, expect, it } from "vitest"
import { TEAM } from "../data/team.ts"
import { demoSeedBlockReason, maskEmail, matchTeamEmails, readEnv } from "./seed-helpers.ts"

const team = [
  { name: "John LaRocco", email: "john@example.com" },
  { name: "Taeyoon Eom", email: "taeyoon@example.com" },
  { name: "Brad Hall", email: "brad@example.com" },
  { name: "Sam Browning", email: "sam@example.com" },
  { name: "Ian Zalcberg", email: "ian@example.com" },
  { name: "Tanush", email: "tanush@example.com" },
]

describe("maskEmail", () => {
  it.each([
    ["john@example.com", "j***@example.com"],
    ["a@b.co", "a***@b.co"],
    ["not-an-email", "***"],
    ["@example.com", "***"],
  ])("masks %s as %s", (email, masked) => {
    expect(maskEmail(email)).toBe(masked)
  })
})

describe("readEnv", () => {
  it("returns trimmed values", () => {
    expect(readEnv(["A", "B"], { A: " one ", B: "two" })).toEqual({ A: "one", B: "two" })
  })

  it("lists every missing or blank setting in one error", () => {
    expect(() => readEnv(["A", "B", "C"], { A: "x", B: "  " })).toThrow(
      "Missing B, C. Add them to .env.local",
    )
    expect(() => readEnv(["A"], {})).toThrow("Missing A. Add it to .env.local")
  })
})

describe("matchTeamEmails", () => {
  it("pairs entries with teammates in team order, whatever the input order", () => {
    const matched = matchTeamEmails([...team].reverse(), TEAM)
    expect(matched.map((m) => [m.sort_order, m.name, m.role, m.email])).toEqual([
      [1, "John LaRocco", "CEO", "john@example.com"],
      [2, "Taeyoon Eom", "CTO", "taeyoon@example.com"],
      [3, "Brad Hall", "COO", "brad@example.com"],
      [4, "Sam Browning", "CFO", "sam@example.com"],
      [5, "Ian Zalcberg", "IT Director", "ian@example.com"],
      [6, "Tanush", "R&D Lead", "tanush@example.com"],
    ])
  })

  it("rejects a name that isn't on the team", () => {
    const entries = team.map((e) => (e.name === "Brad Hall" ? { ...e, name: "Bradley Hall" } : e))
    expect(() => matchTeamEmails(entries, TEAM)).toThrow(
      'TEAM_EMAILS has "Bradley Hall", not on the team list',
    )
  })

  it("rejects a missing teammate", () => {
    expect(() => matchTeamEmails(team.slice(0, 5), TEAM)).toThrow("TEAM_EMAILS is missing Tanush.")
  })
})

describe("demoSeedBlockReason", () => {
  const local = { NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321", APP_ENV: "development" }
  const remote = "https://abcdefghijklmnop.supabase.co"

  it.each(["http://127.0.0.1:54321", "http://localhost:54321", "http://[::1]:54321"])(
    "allows the local stack at %s",
    (url) => {
      expect(demoSeedBlockReason({ ...local, NEXT_PUBLIC_SUPABASE_URL: url })).toBeNull()
    },
  )

  it("allows a local stack when APP_ENV is unset", () => {
    expect(demoSeedBlockReason({ NEXT_PUBLIC_SUPABASE_URL: "http://localhost:54321" })).toBeNull()
  })

  it("refuses production, even when remote demo data is allowed", () => {
    expect(demoSeedBlockReason({ ...local, APP_ENV: "production" })).toMatch(/production/)
    expect(
      demoSeedBlockReason({
        NEXT_PUBLIC_SUPABASE_URL: remote,
        APP_ENV: "production",
        ALLOW_REMOTE_DEMO: "1",
      }),
    ).toMatch(/APP_ENV is production/)
  })

  it("refuses the production project", () => {
    expect(
      demoSeedBlockReason({
        NEXT_PUBLIC_SUPABASE_URL: remote,
        PROD_SUPABASE_PROJECT_REF: "abcdefghijklmnop",
        ALLOW_REMOTE_DEMO: "1",
      }),
    ).toMatch(/production project/)
  })

  it("ignores an empty production ref", () => {
    expect(demoSeedBlockReason({ ...local, PROD_SUPABASE_PROJECT_REF: "" })).toBeNull()
  })

  it("refuses a remote project unless ALLOW_REMOTE_DEMO=1", () => {
    expect(demoSeedBlockReason({ NEXT_PUBLIC_SUPABASE_URL: remote })).toMatch(
      /not the local stack \(abcdefghijklmnop\.supabase\.co\)/,
    )
    expect(
      demoSeedBlockReason({ NEXT_PUBLIC_SUPABASE_URL: remote, ALLOW_REMOTE_DEMO: "true" }),
    ).not.toBeNull()
    expect(
      demoSeedBlockReason({ NEXT_PUBLIC_SUPABASE_URL: remote, ALLOW_REMOTE_DEMO: "1" }),
    ).toBeNull()
  })

  it("refuses a missing or broken URL", () => {
    expect(demoSeedBlockReason({})).toMatch(/missing or not a URL/)
    expect(demoSeedBlockReason({ NEXT_PUBLIC_SUPABASE_URL: "127.0.0.1:54321" })).not.toBeNull()
  })
})
