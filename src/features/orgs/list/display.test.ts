import { describe, expect, test } from "vitest"
import {
  companyMeta,
  dayLabel,
  firstContact,
  isClosed,
  locationText,
  meetingDates,
  ratingText,
  ratingTone,
  regionText,
  staleText,
} from "./display"

const today = "2026-10-12"

describe("rating", () => {
  test("green only for 4 and 5", () => {
    expect(ratingTone(5)).toBe("good")
    expect(ratingTone(4)).toBe("good")
    expect(ratingTone(3)).toBe("neutral")
    expect(ratingTone(1)).toBe("neutral")
  })

  test("reads as n/5", () => {
    expect(ratingText(4)).toBe("4/5")
  })
})

describe("dayLabel", () => {
  test("adds the year only when it isn't this year", () => {
    expect(dayLabel("2026-10-03", today)).toBe("Oct 3")
    expect(dayLabel("2025-12-30", today)).toBe("Dec 30, 2025")
  })
})

describe("companyMeta", () => {
  test("subtype then stage", () => {
    expect(
      companyMeta("investor", { subtype: "vc", stage: "meeting", stage_label: "Meeting" }),
    ).toBe("VC · Meeting")
  })

  test("just the stage without a subtype, from the label table if the view has none", () => {
    expect(
      companyMeta("customer", { subtype: null, stage: "pilot_active", stage_label: null }),
    ).toBe("Pilot Active")
  })
})

describe("location", () => {
  test("city and state, either alone, or nothing", () => {
    expect(locationText({ city: "Columbus", state_or_country: "OH" })).toBe("Columbus, OH")
    expect(locationText({ city: null, state_or_country: "Germany" })).toBe("Germany")
    expect(locationText({ city: "  ", state_or_country: null })).toBeNull()
  })

  test("region label", () => {
    expect(regionText({ region: "rest_of_us" })).toBe("Rest of US")
    expect(regionText({ region: null })).toBeNull()
  })
})

describe("firstContact", () => {
  test("date and method label", () => {
    expect(
      firstContact({ first_contact_date: "2026-09-02", first_contact_method: "warm_intro" }, today),
    ).toEqual({ date: "Sep 2", method: "Warm intro" })
    expect(firstContact({ first_contact_date: null, first_contact_method: null }, today)).toEqual({
      date: null,
      method: null,
    })
  })
})

describe("meetingDates", () => {
  test("latest as an ET day, next with its ET time", () => {
    const dates = meetingDates(
      {
        // 10:30 PM ET on Oct 3 is already Oct 4 in UTC.
        latest_meeting_at: "2026-10-04T02:30:00Z",
        next_meeting_at: "2026-10-20T18:00:00Z",
      },
      today,
    )
    expect(dates.latest).toEqual({ date: "2026-10-03", label: "Oct 3", relative: "9 days ago" })
    expect(dates.next).toEqual({
      at: "2026-10-20T18:00:00Z",
      label: "Oct 20, 2:00 PM",
      relative: "in 8 days",
    })
  })

  test("none yet", () => {
    expect(meetingDates({ latest_meeting_at: null, next_meeting_at: null }, today)).toEqual({
      latest: null,
      next: null,
    })
  })
})

describe("staleText", () => {
  test("only for stale orgs", () => {
    expect(
      staleText({ is_stale: true, days_since_contact: 21, last_contact_date: "2026-09-21" }),
    ).toBe("No contact in 21 days")
    expect(
      staleText({ is_stale: false, days_since_contact: 21, last_contact_date: "2026-09-21" }),
    ).toBeNull()
  })

  test("never contacted counts from when it was added", () => {
    expect(staleText({ is_stale: true, days_since_contact: 15, last_contact_date: null })).toBe(
      "Never contacted · added 15 days ago",
    )
  })
})

describe("isClosed", () => {
  test("won and lost are closed; open and unknown are not", () => {
    expect(isClosed({ stage_outcome: "won" })).toBe(true)
    expect(isClosed({ stage_outcome: "lost" })).toBe(true)
    expect(isClosed({ stage_outcome: "open" })).toBe(false)
    expect(isClosed({ stage_outcome: null })).toBe(false)
  })
})
