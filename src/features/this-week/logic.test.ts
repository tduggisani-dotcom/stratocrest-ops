import { describe, expect, it } from "vitest"
import {
  askedLabel,
  compareTasksByDue,
  debriefSubject,
  formatKrValue,
  krProgress,
  krProgressText,
  meetingPeople,
  moreCount,
  pickQuarter,
  progressPercent,
  sentenceCase,
  sessionCountdown,
  sessionDateLabel,
  sessionTimeLabel,
  splitByPosted,
  staleLabel,
  weekEnd,
} from "./logic"

describe("weekEnd", () => {
  it("is this Sunday, and today on a Sunday", () => {
    expect(weekEnd("2026-10-12")).toBe("2026-10-18") // Monday
    expect(weekEnd("2026-10-17")).toBe("2026-10-18") // Saturday
    expect(weekEnd("2026-10-11")).toBe("2026-10-11") // Sunday
  })

  it("crosses month and year ends", () => {
    expect(weekEnd("2026-12-29")).toBe("2027-01-03")
  })
})

describe("moreCount", () => {
  it("counts what the list leaves out", () => {
    expect(moreCount(12, 8)).toBe(4)
    expect(moreCount(3, 3)).toBe(0)
  })

  it("is 0 when the count is unknown", () => {
    expect(moreCount(null, 5)).toBe(0)
    expect(moreCount(undefined, 5)).toBe(0)
  })
})

describe("compareTasksByDue", () => {
  const task = (id: string, dueDate: string, priority: "low" | "medium" | "high", title = id) => ({
    id,
    title,
    dueDate,
    priority,
  })

  it("puts overdue (earliest) first, then high priority, then title", () => {
    const tasks = [
      task("a", "2026-10-14", "low", "Zulu"),
      task("b", "2026-10-07", "medium"),
      task("c", "2026-10-14", "high"),
      task("d", "2026-10-14", "low", "Alpha"),
    ]
    expect(tasks.sort(compareTasksByDue).map((t) => t.id)).toEqual(["b", "c", "d", "a"])
  })
})

describe("splitByPosted", () => {
  const john = { id: "j", name: "John", sortOrder: 1 }
  const taeyoon = { id: "t", name: "Taeyoon", sortOrder: 2 }
  const brad = { id: "b", name: "Brad", sortOrder: 3 }
  const gone = { id: "g", name: "Former", sortOrder: 9 }
  const team = [john, taeyoon, brad]

  it("splits active people by whether they submitted, in team order", () => {
    const result = splitByPosted(team, [
      { submittedAt: "2026-10-10T20:00:00Z", person: brad },
      { submittedAt: "2026-10-10T19:00:00Z", person: john },
    ])
    expect(result.posted.map((p) => p.id)).toEqual(["j", "b"])
    expect(result.notPosted.map((p) => p.id)).toEqual(["t"])
  })

  it("treats a draft (not submitted) as not posted", () => {
    const result = splitByPosted(team, [{ submittedAt: null, person: taeyoon }])
    expect(result.posted).toEqual([])
    expect(result.notPosted.map((p) => p.id)).toEqual(["j", "t", "b"])
  })

  it("keeps a deactivated teammate who already posted", () => {
    const result = splitByPosted(team, [{ submittedAt: "2026-10-10T19:00:00Z", person: gone }])
    expect(result.posted.map((p) => p.id)).toEqual(["g"])
    expect(result.notPosted).toHaveLength(3)
  })

  it("handles nobody on the team", () => {
    expect(splitByPosted([], [])).toEqual({ posted: [], notPosted: [] })
  })
})

describe("pickQuarter", () => {
  const quarters = [
    { label: "Q2", startDate: "2027-01-14", endDate: "2027-04-07" },
    { label: "Q1", startDate: "2026-10-14", endDate: "2027-01-13" },
  ]

  it("is the next quarter before Q1 starts", () => {
    expect(pickQuarter(quarters, "2026-10-11")).toEqual({
      quarter: quarters[1],
      status: "upcoming",
    })
  })

  it("is the quarter that includes today, on its first and last days", () => {
    expect(pickQuarter(quarters, "2026-10-14")?.quarter.label).toBe("Q1")
    expect(pickQuarter(quarters, "2027-01-13")?.quarter.label).toBe("Q1")
    expect(pickQuarter(quarters, "2027-01-14")).toEqual({ quarter: quarters[0], status: "current" })
  })

  it("is null after the last quarter", () => {
    expect(pickQuarter(quarters, "2027-04-08")).toBeNull()
    expect(pickQuarter([], "2026-10-11")).toBeNull()
  })
})

describe("krProgress", () => {
  it("measures from the start value to the target", () => {
    expect(krProgress({ startValue: 0, targetValue: 10, currentValue: 3 })).toBeCloseTo(0.3)
    expect(krProgress({ startValue: 2, targetValue: 12, currentValue: 7 })).toBeCloseTo(0.5)
  })

  it("clamps to 0..1", () => {
    expect(krProgress({ startValue: 0, targetValue: 10, currentValue: 15 })).toBe(1)
    expect(krProgress({ startValue: 5, targetValue: 10, currentValue: 2 })).toBe(0)
  })

  it("works for targets below the start", () => {
    expect(krProgress({ startValue: 100, targetValue: 50, currentValue: 75 })).toBeCloseTo(0.5)
    expect(krProgress({ startValue: 100, targetValue: 50, currentValue: 40 })).toBe(1)
  })

  it("doesn't divide by zero when target equals start", () => {
    expect(krProgress({ startValue: 5, targetValue: 5, currentValue: 5 })).toBe(1)
    expect(krProgress({ startValue: 5, targetValue: 5, currentValue: 4 })).toBe(0)
  })
})

describe("progressPercent", () => {
  it("rounds to a whole percent", () => {
    expect(progressPercent(0)).toBe(0)
    expect(progressPercent(0.3)).toBe(30)
    expect(progressPercent(1)).toBe(100)
  })

  it("shows 100 only when done, and more than 0 once started", () => {
    expect(progressPercent(0.996)).toBe(99)
    expect(progressPercent(0.004)).toBe(1)
  })
})

describe("key-result text", () => {
  it("formats values with their unit", () => {
    expect(formatKrValue(12500, "$")).toBe("$12,500")
    expect(formatKrValue(-5, "$")).toBe("-$5")
    expect(formatKrValue(40, "%")).toBe("40%")
    expect(formatKrValue(3, "meetings")).toBe("3 meetings")
    expect(formatKrValue(2.5, null)).toBe("2.5")
    expect(formatKrValue(7, "  ")).toBe("7")
  })

  it('reads "3 of 10 meetings"', () => {
    const kr = { startValue: 0, targetValue: 10, currentValue: 3 }
    expect(krProgressText({ ...kr, unit: "meetings" })).toBe("3 of 10 meetings")
    expect(krProgressText({ ...kr, unit: null })).toBe("3 of 10")
    expect(krProgressText({ ...kr, currentValue: 2000, targetValue: 10000, unit: "$" })).toBe(
      "$2,000 of $10,000",
    )
    expect(krProgressText({ ...kr, currentValue: 30, targetValue: 50, unit: "%" })).toBe(
      "30% of 50%",
    )
  })
})

describe("Synthe6 session labels", () => {
  it("shows one day, or a range for multi-day sessions", () => {
    expect(sessionDateLabel("2026-10-14", "2026-10-14")).toBe("Wed, Oct 14")
    expect(sessionDateLabel("2026-10-19", "2026-10-23")).toBe("Mon, Oct 19 – Fri, Oct 23")
  })

  it("counts down to the start, and is 'today' on any day of a range", () => {
    expect(sessionCountdown("2026-10-14", "2026-10-14", "2026-10-11")).toBe("in 3 days")
    expect(sessionCountdown("2026-10-14", "2026-10-14", "2026-10-13")).toBe("tomorrow")
    expect(sessionCountdown("2026-10-14", "2026-10-14", "2026-10-14")).toBe("today")
    expect(sessionCountdown("2026-10-19", "2026-10-23", "2026-10-21")).toBe("today")
  })

  it("shows ET times when known, and nothing when they aren't", () => {
    expect(sessionTimeLabel("2026-10-14", null, null)).toBeNull()
    expect(sessionTimeLabel("2026-10-14", "18:00:00", null)).toBe("6:00 PM")
    expect(sessionTimeLabel("2026-10-14", "18:00:00", "20:30:00")).toBe("6:00 PM – 8:30 PM")
    // After the DST change: still the ET wall-clock time.
    expect(sessionTimeLabel("2026-11-11", "09:00", "10:00")).toBe("9:00 AM – 10:00 AM")
    expect(sessionTimeLabel("2026-10-14", "not a time", null)).toBeNull()
  })
})

describe("debriefSubject", () => {
  const none = { session: null, orgMeeting: null, teamMeeting: null }

  it("names the Synthe6 session, falling back to the activity", () => {
    expect(
      debriefSubject({
        ...none,
        kind: "synthe6",
        session: { weekLabel: "W2", topic: "Goal Setting & OKRs", activityType: "Workshop" },
      }),
    ).toBe("W2 · Goal Setting & OKRs")
    expect(
      debriefSubject({
        ...none,
        kind: "mentor",
        session: { weekLabel: "W4", topic: null, activityType: "Lead Mentor Coaching" },
      }),
    ).toBe("W4 · Lead Mentor Coaching")
  })

  it("names the org and the ET day of an org meeting", () => {
    expect(
      debriefSubject({
        ...none,
        kind: "investor",
        // 11:30 PM ET on Oct 4 is already Oct 5 in UTC.
        orgMeeting: { startsAt: "2026-10-05T03:30:00Z", orgName: "Acme Ventures" },
      }),
    ).toBe("Acme Ventures, Oct 4")
  })

  it("names the Sunday meeting by its date", () => {
    expect(
      debriefSubject({ ...none, kind: "team_meeting", teamMeeting: { meetingDate: "2026-10-11" } }),
    ).toBe("Sunday meeting, Oct 11")
  })

  it("falls back to the kind label", () => {
    expect(debriefSubject({ ...none, kind: "customer" })).toBe("Customer meeting")
  })
})

describe("staleLabel and askedLabel", () => {
  it("says how long since contact, or that there was none", () => {
    expect(staleLabel(19, "2026-09-22")).toBe("No contact in 19 days")
    expect(staleLabel(15, null)).toBe("Never contacted · added 15 days ago")
    expect(staleLabel(1, "2026-10-10")).toBe("No contact in 1 day")
  })

  it("says when help was asked for, in ET days", () => {
    expect(askedLabel("2026-10-11T13:00:00Z", "2026-10-11")).toBe("Asked today")
    // 1 AM UTC on Oct 11 is still Oct 10 in ET.
    expect(askedLabel("2026-10-11T01:00:00Z", "2026-10-11")).toBe("Asked yesterday")
    expect(askedLabel("2026-10-08T15:00:00Z", "2026-10-11")).toBe("Asked 3 days ago")
  })
})

describe("meetingPeople", () => {
  const owner = { id: "o", sortOrder: 4 }

  it("lists attendees in team order", () => {
    const result = meetingPeople(
      [
        { id: "b", sortOrder: 3 },
        { id: "a", sortOrder: 1 },
      ],
      owner,
    )
    expect(result).toEqual({
      people: [
        { id: "a", sortOrder: 1 },
        { id: "b", sortOrder: 3 },
      ],
      isOwnerFallback: false,
    })
  })

  it("falls back to the org owner when nobody is listed", () => {
    expect(meetingPeople([], owner)).toEqual({ people: [owner], isOwnerFallback: true })
  })
})

describe("sentenceCase", () => {
  it("capitalizes the first letter only", () => {
    expect(sentenceCase("in 3 days")).toBe("In 3 days")
    expect(sentenceCase("today")).toBe("Today")
    expect(sentenceCase("")).toBe("")
  })
})
