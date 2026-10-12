import { readFileSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"
import { addDays, isIsoDate, isoWeekday } from "../../src/lib/dates.ts"
import { CHECKLIST_TEMPLATES } from "./checklist-templates.ts"
import { QUARTERS } from "./quarters.ts"
import { SCHEDULE_COLUMNS, SYNTHE6_SCHEDULE } from "./synthe6-schedule.ts"
import type { Synthe6ScheduleRow } from "./synthe6-schedule.ts"
import { TEAM } from "./team.ts"

const numbered = SYNTHE6_SCHEDULE.filter((row) => !row.is_break)
const breaks = SYNTHE6_SCHEDULE.filter((row) => row.is_break)

function week(label: string): Synthe6ScheduleRow {
  const row = SYNTHE6_SCHEDULE.find((r) => r.week_label === label)
  if (!row) throw new Error(`No ${label}`)
  return row
}

function labelsWith(emphasis: Synthe6ScheduleRow["emphasis"]) {
  return SYNTHE6_SCHEDULE.filter((row) => row.emphasis === emphasis).map((row) => row.week_label)
}

describe("team", () => {
  it("lists the six people from spec §2 in rotation order", () => {
    expect(TEAM).toEqual([
      { name: "John LaRocco", role: "CEO", sort_order: 1 },
      { name: "Taeyoon Eom", role: "CTO", sort_order: 2 },
      { name: "Brad Hall", role: "COO", sort_order: 3 },
      { name: "Sam Browning", role: "CFO", sort_order: 4 },
      { name: "Ian Zalcberg", role: "IT Director", sort_order: 5 },
      { name: "Tanush", role: "R&D Lead", sort_order: 6 },
    ])
  })
})

describe("Synthe6 schedule", () => {
  it("has 53 rows: 48 numbered weeks and 5 breaks", () => {
    expect(SYNTHE6_SCHEDULE).toHaveLength(53)
    expect(numbered).toHaveLength(48)
    expect(breaks).toHaveLength(5)
  })

  it("numbers the weeks W1…W48 in order", () => {
    expect(numbered.map((row) => row.week_number)).toEqual(
      Array.from({ length: 48 }, (_, i) => i + 1),
    )
    for (const row of numbered) expect(row.week_label).toBe(`W${row.week_number}`)
  })

  it("is in date order with unique, valid dates", () => {
    const starts = SYNTHE6_SCHEDULE.map((row) => row.start_date)
    expect([...starts].sort()).toEqual(starts)
    expect(new Set(starts).size).toBe(starts.length)
    for (const row of SYNTHE6_SCHEDULE) {
      expect(isIsoDate(row.start_date)).toBe(true)
      expect(isIsoDate(row.end_date)).toBe(true)
    }
  })

  it("has the five break weeks, with no week number or topic", () => {
    expect(breaks.map((row) => row.start_date)).toEqual([
      "2026-11-11",
      "2026-11-25",
      "2026-12-23",
      "2026-12-30",
      "2027-01-06",
    ])
    expect(breaks.map((row) => row.activity_type)).toEqual([
      "Veterans Day / off week",
      "Thanksgiving break",
      "Holiday break",
      "Holiday break",
      "Holiday break",
    ])
    for (const row of breaks) {
      expect(row).toMatchObject({
        week_number: null,
        week_label: null,
        format: "No meeting",
        topic: null,
        emphasis: null,
      })
      expect(row.end_date).toBe(row.start_date)
    }
  })

  it("is all single Wednesdays, except W3 (Monday to Friday)", () => {
    for (const row of SYNTHE6_SCHEDULE) {
      if (row.week_label === "W3") continue
      expect(isoWeekday(row.start_date), row.start_date).toBe(3)
      expect(row.end_date).toBe(row.start_date)
    }
    expect(week("W3")).toMatchObject({ start_date: "2026-10-19", end_date: "2026-10-23" })
    expect(isoWeekday("2026-10-19")).toBe(1)
    expect(isoWeekday("2026-10-23")).toBe(5)
  })

  it("tags the OKR share-outs", () => {
    expect(labelsWith("okr_share_out")).toEqual(["W5", "W10", "W22", "W35"])
  })

  it("tags every Lead Mentor Coaching week (every fourth week from W4)", () => {
    const mentor = Array.from({ length: 12 }, (_, i) => `W${4 * (i + 1)}`)
    expect(labelsWith("mentor_coaching")).toEqual(mentor)
    expect(
      SYNTHE6_SCHEDULE.filter((row) => row.activity_type === "Lead Mentor Coaching").map(
        (row) => row.week_label,
      ),
    ).toEqual(mentor)
  })

  it("tags Demo Day prep W38–W43; W40 stays mentor coaching", () => {
    expect(labelsWith("demo_day_prep")).toEqual(["W38", "W39", "W41", "W42", "W43"])
    expect(week("W40").emphasis).toBe("mentor_coaching")
  })

  it("leaves every other row untagged, breaks included", () => {
    expect(labelsWith(null)).toHaveLength(53 - 4 - 12 - 5)
    for (const row of breaks) expect(row.emphasis).toBeNull()
  })

  it("matches spot-checked rows from spec §11 exactly", () => {
    expect(week("W1")).toEqual({
      week_number: 1,
      week_label: "W1",
      start_date: "2026-10-07",
      end_date: "2026-10-07",
      format: "In-person",
      activity_type: "Workshop",
      topic: "Kickoff + Readiness Levels + Cohort Introductions (PIC overview)",
      is_break: false,
      emphasis: null,
    })
    expect(week("W3")).toMatchObject({
      format: "Virtual / individually scheduled",
      activity_type: "Startup 360 Reviews",
      topic: "Startup 360 Assessments",
    })
    expect(week("W4")).toMatchObject({
      start_date: "2026-10-28",
      format: "Mentor Coaching",
      activity_type: "Lead Mentor Coaching",
      topic: null,
    })
    expect(week("W14")).toMatchObject({
      start_date: "2027-02-10",
      activity_type: "Workshop + Panel",
      topic: "Intellectual Property Strategy + IP Panel",
    })
    expect(week("W22").topic).toBe(
      "Q2 OKR Share-out + One Page Summary Refresh (evidence, traction, milestones)",
    )
    expect(week("W25").topic).toBe("Pilot Conversion, Contracts, & Strategic Partnerships")
    expect(week("W42").topic).toBe("Demo Day Pitch/Q&A Practice")
    expect(week("W47")).toMatchObject({
      start_date: "2027-09-29",
      format: "In-person",
      topic: "Post-Synthe6 Roadmap, Graduation",
    })
    expect(week("W48")).toMatchObject({ start_date: "2027-10-06", topic: null })
  })

  it("matches every cell of the table in docs/SPEC.md §11", () => {
    const spec = readFileSync(path.resolve(import.meta.dirname, "../../docs/SPEC.md"), "utf8")
    const section = spec.slice(spec.indexOf("## 11."))
    const specRows = section
      .split("\n")
      .filter((line) => /^\| (W\d+|—) \|/.test(line))
      .map((line) =>
        line
          .slice(1, -1)
          .split("|")
          .map((cell) => cell.trim()),
      )
    const ours = SYNTHE6_SCHEDULE.map((row) => [
      row.week_label ?? "—",
      row.start_date === row.end_date ? row.start_date : `${row.start_date} to ${row.end_date}`,
      row.format,
      row.activity_type,
      row.topic ?? "—",
    ])
    expect(ours).toEqual(specRows)
  })

  it("only has the schedule columns the seed owns", () => {
    for (const row of SYNTHE6_SCHEDULE) {
      expect(Object.keys(row).sort()).toEqual([...SCHEDULE_COLUMNS].sort())
    }
  })
})

describe("quarters", () => {
  it("matches spec §6.8", () => {
    expect(QUARTERS).toEqual([
      {
        label: "Q1",
        start_date: "2026-10-14",
        end_date: "2027-01-13",
        share_out_date: "2027-01-13",
        share_out_week_label: "W10",
      },
      {
        label: "Q2",
        start_date: "2027-01-14",
        end_date: "2027-04-07",
        share_out_date: "2027-04-07",
        share_out_week_label: "W22",
      },
      {
        label: "Q3",
        start_date: "2027-04-08",
        end_date: "2027-07-07",
        share_out_date: "2027-07-07",
        share_out_week_label: "W35",
      },
      {
        label: "Q4",
        start_date: "2027-07-08",
        end_date: "2027-09-29",
        share_out_date: "2027-09-29",
        share_out_week_label: "W47",
      },
    ])
  })

  it("are contiguous: each starts the day after the previous one ends", () => {
    for (let i = 1; i < QUARTERS.length; i++) {
      expect(QUARTERS[i].start_date).toBe(addDays(QUARTERS[i - 1].end_date, 1))
    }
  })

  it("start when goals are set (W2) and end at graduation (W47)", () => {
    expect(QUARTERS[0].start_date).toBe(week("W2").start_date)
    expect(QUARTERS.at(-1)?.end_date).toBe(week("W47").start_date)
  })

  it("each end on the date of its share-out session", () => {
    for (const quarter of QUARTERS) {
      expect(quarter.share_out_date).toBe(quarter.end_date)
      expect(week(quarter.share_out_week_label).start_date).toBe(quarter.share_out_date)
    }
  })

  it("puts the first share-out (W5) inside Q1", () => {
    const w5 = week("W5").start_date
    expect(w5 >= QUARTERS[0].start_date && w5 <= QUARTERS[0].end_date).toBe(true)
  })
})

describe("checklist templates", () => {
  it("are the four starters from spec §6.9", () => {
    expect(CHECKLIST_TEMPLATES.map((t) => t.name)).toEqual([
      "Investor meeting prep",
      "Grant submission",
      "Mentor session prep",
      "Demo Day rehearsal",
    ])
  })

  it.each(CHECKLIST_TEMPLATES)("$name has 6–10 short, distinct items", (template) => {
    expect(template.items.length).toBeGreaterThanOrEqual(6)
    expect(template.items.length).toBeLessThanOrEqual(10)
    expect(template.description.trim()).not.toBe("")

    const texts = template.items.map((item) => item.text)
    expect(new Set(texts).size).toBe(texts.length)
    for (const item of template.items) {
      expect(Object.keys(item).every((key) => key === "text" || key === "hint")).toBe(true)
      expect(item.text.trim()).toBe(item.text)
      expect(item.text.length).toBeGreaterThan(0)
      expect(item.text.length).toBeLessThanOrEqual(120)
      if (item.hint !== undefined) expect(item.hint.trim()).not.toBe("")
    }
  })

  it.each(CHECKLIST_TEMPLATES)("$name moves from before to after", (template) => {
    expect(template.items[0].text).toMatch(/^(Before|Plan):/)
    expect(template.items.at(-1)?.text).toMatch(/^After:/)
  })
})
