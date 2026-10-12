import { afterEach, beforeEach, describe, expect, test, vi } from "vitest"
import { CSV_BOM } from "./csv"
import { DEFAULT_FILTERS } from "./filters"
import { testOrg } from "./list/test-org"

const { requireTeamMember, listOrgs } = vi.hoisted(() => ({
  requireTeamMember: vi.fn(),
  listOrgs: vi.fn(),
}))
vi.mock("@/lib/auth", () => ({ requireTeamMember }))
vi.mock("./queries/list", () => ({ listOrgs }))

const { etStamp, exportFilename, exportOrgsCsv, orgCsvHeader, orgCsvRow, orgsCsv } =
  await import("./export")

const SAM = "4f6c2a8e-1b3d-4e5f-8a9b-0c1d2e3f4a5b"

const org = testOrg

describe("etStamp", () => {
  test("ET wall-clock time, 24-hour, across daylight saving", () => {
    expect(etStamp("2026-10-03T18:00:00Z")).toBe("2026-10-03 14:00")
    expect(etStamp("2026-12-03T18:00:00Z")).toBe("2026-12-03 13:00")
    // 12:30 AM UTC is still the previous evening in ET.
    expect(etStamp("2026-10-04T00:30:00Z")).toBe("2026-10-03 20:30")
    expect(etStamp("2026-10-04T04:05:00Z")).toBe("2026-10-04 00:05")
  })
})

describe("orgCsvHeader", () => {
  test("the spec's columns, with the kind's focus label", () => {
    const investor = orgCsvHeader("investor")
    expect(investor).toHaveLength(25)
    expect(investor.slice(0, 6)).toEqual([
      "Company",
      "Stage",
      "Subtype",
      "Coatl point of contact",
      "Next step",
      "Next step date",
    ])
    expect(investor[12]).toBe("Check size or focus")
    expect(orgCsvHeader("customer")[12]).toBe("Need or focus")
    expect(investor.slice(-4)).toEqual([
      "Latest meeting",
      "Latest rating",
      "Latest summary",
      "Next meeting",
    ])
  })
})

describe("orgCsvRow", () => {
  test("labels, not stored values; days as YYYY-MM-DD; moments in ET", () => {
    const row = orgCsvRow("investor", org({ next_meeting_at: "2026-10-20T18:00:00Z" }))
    expect(row).toHaveLength(orgCsvHeader("investor").length)
    expect(row).toEqual([
      "Example Seed Fund",
      "Meeting",
      "VC",
      "Sam Browning",
      "Send the deck, then ask for a partner meeting",
      "2026-10-16",
      "Columbus",
      "OH",
      "Ohio",
      "2026-09-02",
      "Warm intro",
      "Synthe6 mentor",
      "$25k–$100k pre-seed",
      "Jane Doe",
      "Partner",
      "jane@example.com",
      "+1 614 555 0100",
      "https://example.com",
      "2026-10-03",
      9,
      "No",
      "2026-10-03 14:00",
      4,
      "Liked the pilot data, wants unit economics",
      "2026-10-20 14:00",
    ])
  })

  test("empty optional fields stay empty", () => {
    const row = orgCsvRow(
      "customer",
      org({
        kind: "customer",
        stage: "pilot_active",
        stage_label: null,
        subtype: null,
        region: null,
        first_contact_method: null,
        latest_meeting_at: null,
        latest_rating: null,
        is_stale: true,
      }),
    )
    expect(row[1]).toBe("Pilot Active")
    expect(row[2]).toBeNull()
    expect(row[8]).toBeNull()
    expect(row[10]).toBeNull()
    expect(row[20]).toBe("Yes")
    expect(row[21]).toBeNull()
    expect(row[22]).toBeNull()
  })
})

describe("orgsCsv", () => {
  test("header plus one quoted, injection-safe row per org", () => {
    const csv = orgsCsv("investor", [org({ name: "=cmd|' /C calc'!A0", city: "Columbus, Ohio" })])
    expect(csv.startsWith(CSV_BOM)).toBe(true)
    const lines = csv.slice(1).split("\r\n")
    expect(lines).toHaveLength(3) // header, row, trailing CRLF
    expect(lines[0]).toMatch(/^Company,Stage,Subtype,Coatl point of contact,/)
    expect(lines[1]).toMatch(/^'=cmd\|' \/C calc'!A0,Meeting,VC,Sam Browning,/)
    expect(lines[1]).toContain(',"Columbus, Ohio",')
    expect(lines[1]).toContain(",'+1 614 555 0100,")
  })
})

describe("exportFilename", () => {
  test("kind and ET date; archived lists say so", () => {
    expect(exportFilename("investor", DEFAULT_FILTERS, "2026-10-12")).toBe(
      "investors-2026-10-12.csv",
    )
    expect(exportFilename("customer", { ...DEFAULT_FILTERS, archived: true }, "2026-10-12")).toBe(
      "customers-archived-2026-10-12.csv",
    )
  })
})

describe("exportOrgsCsv", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    // 11:30 PM ET on Oct 12 is already Oct 13 in UTC.
    vi.setSystemTime(new Date("2026-10-13T03:30:00Z"))
    requireTeamMember.mockResolvedValue({ id: SAM, name: "Sam Browning" })
    listOrgs.mockResolvedValue([org()])
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.clearAllMocks()
  })

  test("checks the teammate, reads the list's filters from the URL and sends an attachment", async () => {
    const response = await exportOrgsCsv(
      "investor",
      new Request("http://localhost/investors/export?region=ohio&sort=rating&dir=desc"),
    )
    expect(requireTeamMember).toHaveBeenCalledOnce()
    expect(listOrgs).toHaveBeenCalledWith("investor", {
      ...DEFAULT_FILTERS,
      regions: ["ohio"],
      sort: "rating",
      dir: "desc",
    })
    expect(response.status).toBe(200)
    expect(response.headers.get("Content-Type")).toBe("text/csv; charset=utf-8")
    expect(response.headers.get("Content-Disposition")).toBe(
      'attachment; filename="investors-2026-10-12.csv"',
    )
    expect(response.headers.get("Cache-Control")).toBe("no-store")
    const body = await response.text()
    expect(body).toContain("Example Seed Fund")
    expect(body.split("\r\n")).toHaveLength(3)
  })

  test("doesn't query when the teammate check fails (it redirects to sign-in)", async () => {
    requireTeamMember.mockRejectedValue(new Error("NEXT_REDIRECT"))
    await expect(
      exportOrgsCsv("customer", new Request("http://localhost/customers/export")),
    ).rejects.toThrow("NEXT_REDIRECT")
    expect(listOrgs).not.toHaveBeenCalled()
  })

  test("a database error is a plain 503, not a broken file", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {})
    listOrgs.mockRejectedValue(new Error("connection refused"))
    const response = await exportOrgsCsv(
      "customer",
      new Request("http://localhost/customers/export"),
    )
    expect(response.status).toBe(503)
    expect(response.headers.get("Cache-Control")).toBe("no-store")
    expect(response.headers.get("Content-Disposition")).toBeNull()
    expect(await response.text()).toBe("Couldn't export customers. Try again.")
    consoleError.mockRestore()
  })
})
