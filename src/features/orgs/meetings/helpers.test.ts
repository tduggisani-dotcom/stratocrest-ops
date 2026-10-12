import { describe, expect, test } from "vitest"
import {
  attendeeChoices,
  defaultMeetingMoment,
  etTimeOf,
  followUpTaskDraft,
  followUpTaskTitle,
  isFutureMeeting,
  splitMeetings,
} from "./helpers"

describe("etTimeOf", () => {
  test("the ET wall clock, 24-hour, in summer and winter", () => {
    expect(etTimeOf("2026-10-12T14:05:00Z")).toBe("10:05")
    expect(etTimeOf("2026-12-01T04:30:00Z")).toBe("23:30")
    expect(etTimeOf(new Date("2026-12-01T05:00:00Z"))).toBe("00:00")
  })
})

describe("defaultMeetingMoment", () => {
  test("today in ET, rounded down to the quarter hour", () => {
    expect(defaultMeetingMoment(new Date("2026-10-12T14:07:00Z"))).toEqual({
      date: "2026-10-12",
      time: "10:00",
    })
    expect(defaultMeetingMoment(new Date("2026-10-12T14:59:59Z"))).toEqual({
      date: "2026-10-12",
      time: "10:45",
    })
    expect(defaultMeetingMoment(new Date("2026-10-12T14:15:00Z")).time).toBe("10:15")
  })

  test("late evening ET is still today in ET, not tomorrow in UTC", () => {
    expect(defaultMeetingMoment(new Date("2026-10-13T02:20:00Z"))).toEqual({
      date: "2026-10-12",
      time: "22:15",
    })
  })

  test("is never in the future", () => {
    const now = new Date("2026-10-12T14:07:00Z")
    const { date, time } = defaultMeetingMoment(now)
    expect(isFutureMeeting(date, time, now)).toBe(false)
  })
})

describe("isFutureMeeting", () => {
  const now = new Date("2026-10-12T14:07:00Z") // 10:07 ET
  test("compares the ET moment with now", () => {
    expect(isFutureMeeting("2026-10-12", "10:15", now)).toBe(true)
    expect(isFutureMeeting("2026-10-12", "10:00", now)).toBe(false)
    expect(isFutureMeeting("2026-10-13", "08:00", now)).toBe(true)
  })
  test("false while the date or time is incomplete", () => {
    expect(isFutureMeeting("", "10:15", now)).toBe(false)
    expect(isFutureMeeting("2026-10-13", "", now)).toBe(false)
    expect(isFutureMeeting("2026-13-01", "10:00", now)).toBe(false)
  })
})

describe("splitMeetings", () => {
  test("scheduled soonest first, past newest first", () => {
    const now = new Date("2026-10-12T14:00:00Z")
    const m = (id: string, startsAt: string) => ({ id, startsAt })
    const { scheduled, past } = splitMeetings(
      [
        m("old", "2026-09-01T14:00:00Z"),
        m("far", "2026-11-20T14:00:00Z"),
        m("now", "2026-10-12T14:00:00Z"),
        m("next", "2026-10-14T14:00:00Z"),
        m("recent", "2026-10-10T14:00:00Z"),
      ],
      now,
    )
    expect(scheduled.map((x) => x.id)).toEqual(["next", "far"])
    expect(past.map((x) => x.id)).toEqual(["now", "recent", "old"])
  })
})

describe("attendeeChoices", () => {
  test("active teammates in order, then current attendees who left the team", () => {
    const a = { id: "a" }
    const b = { id: "b" }
    const gone = { id: "gone" }
    expect(attendeeChoices([a, b], [b, gone])).toEqual([a, b, gone])
    expect(attendeeChoices([a, b], [])).toEqual([a, b])
  })
})

describe("the follow-up task", () => {
  const source = {
    org: {
      id: "org-1",
      name: "Acme Ventures",
      ownerId: "owner",
      nextStep: "Send the test results",
      nextStepDate: "2026-10-20",
    },
    meeting: {
      id: "meeting-1",
      startsAt: "2026-10-12T14:00:00Z",
      followUpOwnerId: null,
      followUpDate: null,
      materialsRequested: null,
      concernsRaised: null,
    },
  }

  test("defaults to the org's next step, owner and date, linked to the org and meeting", () => {
    expect(followUpTaskDraft(source)).toEqual({
      title: "Follow up with Acme Ventures",
      next_action: "Send the test results",
      owner_id: "owner",
      due_date: "2026-10-20",
      notes: "From the meeting on Monday, October 12, 2026.",
      organization_id: "org-1",
      org_meeting_id: "meeting-1",
    })
  })

  test("uses the meeting's follow-up owner and date, and notes what they asked for", () => {
    const draft = followUpTaskDraft({
      ...source,
      meeting: {
        ...source.meeting,
        followUpOwnerId: "mate",
        followUpDate: "2026-10-15",
        materialsRequested: "Deck and test data",
        concernsRaised: "Battery life",
      },
    })
    expect(draft).toMatchObject({ owner_id: "mate", due_date: "2026-10-15" })
    expect(draft.notes).toBe(
      "From the meeting on Monday, October 12, 2026.\n\nMaterials requested: Deck and test data\n\nConcerns raised: Battery life",
    )
  })

  test("a long name is shortened to fit a task title", () => {
    const title = followUpTaskTitle("x".repeat(200))
    expect(title).toHaveLength(200)
    expect(title.endsWith("…")).toBe(true)
    expect(followUpTaskTitle("  Acme  ")).toBe("Follow up with Acme")
  })
})
