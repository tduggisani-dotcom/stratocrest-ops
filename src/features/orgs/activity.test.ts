import { describe, expect, it } from "vitest"
import {
  activityActor,
  activityWhen,
  describeActivities,
  describeActivity,
  type ActivityContext,
  type ActivityEntry,
} from "./activity"

const ORG = "076c0045-a5db-4275-a4b6-d772ae8d7d0e"
const JOHN = "f294266f-162f-43dc-a6d6-81aa7192d182"
const BRAD = "8c42dd7c-f051-42f7-beb4-27ba8cde2f16"
const MEETING = "f4602b32-3bf8-4a4d-875a-384bab4bff16"
const HYPOTHESIS = "5a63a9f5-2122-4626-89ac-6d41356760cf"

// Oct 3, 2026, 2:00 PM ET.
const MEETING_AT = "2026-10-03T18:00:00+00:00"

const context: ActivityContext = {
  kind: "investor",
  people: new Map([
    [JOHN, "John LaRocco"],
    [BRAD, "Brad Hall"],
  ]),
  meetings: new Map([[MEETING, MEETING_AT]]),
  hypotheses: new Map([[HYPOTHESIS, "Angels will write $25k checks before a pilot"]]),
}

function entry(partial: Partial<ActivityEntry>): ActivityEntry {
  return {
    id: 1,
    occurredAt: "2026-10-05T15:00:00+00:00",
    action: "update",
    entityType: "organizations",
    entityId: ORG,
    before: null,
    after: null,
    changedFields: null,
    actor: { kind: "person", id: JOHN, name: "John LaRocco", avatarUrl: null },
    ...partial,
  }
}

function orgUpdate(before: Record<string, unknown>, after: Record<string, unknown>) {
  return entry({ before, after, changedFields: Object.keys(after).sort() })
}

describe("organizations", () => {
  it("describes adding, archiving and restoring", () => {
    expect(
      describeActivity(entry({ action: "insert", after: { stage: "identified" } }), context),
    ).toBe("Added this investor")
    expect(
      describeActivity(entry({ action: "insert", after: { stage: "meeting" } }), context),
    ).toBe("Added this investor at Meeting")
    expect(
      describeActivity(entry({ action: "insert", after: { stage: "pilot_active" } }), {
        ...context,
        kind: "customer",
      }),
    ).toBe("Added this customer at Pilot Active")
    expect(
      describeActivity(
        entry({
          action: "archive",
          before: { archived_at: null },
          after: { archived_at: "2026-10-05T15:00:00Z" },
          changedFields: ["archived_at"],
        }),
        context,
      ),
    ).toBe("Archived this investor")
    expect(describeActivity(entry({ action: "restore" }), context)).toBe("Restored this investor")
  })

  it("names stage moves with the kind's labels", () => {
    expect(describeActivity(orgUpdate({ stage: "contacted" }, { stage: "meeting" }), context)).toBe(
      "Moved from Contacted to Meeting",
    )
    expect(
      describeActivity(orgUpdate({ stage: "pilot_proposed" }, { stage: "pilot_active" }), {
        ...context,
        kind: "customer",
      }),
    ).toBe("Moved from Pilot Proposed to Pilot Active")
  })

  it("describes next-step changes", () => {
    expect(describeActivity(orgUpdate({ next_step: "a" }, { next_step: "b" }), context)).toBe(
      "Changed the next step",
    )
    expect(
      describeActivity(
        orgUpdate(
          { next_step: "a", next_step_date: "2026-10-10" },
          { next_step: "b", next_step_date: "2026-10-20" },
        ),
        context,
      ),
    ).toBe("Changed the next step (due Oct 20)")
    expect(
      describeActivity(
        orgUpdate({ next_step_date: "2026-10-10" }, { next_step_date: "2026-10-20" }),
        context,
      ),
    ).toBe("Moved the next step to Oct 20")
  })

  it("joins several changes into one sentence", () => {
    expect(
      describeActivity(
        orgUpdate(
          { stage: "meeting", owner_id: JOHN, next_step: "a", notes: null },
          { stage: "diligence", owner_id: BRAD, next_step: "b", notes: "x" },
        ),
        context,
      ),
    ).toBe(
      "Moved from Meeting to Diligence, made Brad Hall the point of contact, changed the next step and edited the notes",
    )
  })

  it("groups detail fields and names the kind's focus", () => {
    expect(
      describeActivity(
        orgUpdate(
          { contact_email: null, contact_phone: null, city: null },
          { contact_email: "a@b.co", contact_phone: "555", city: "Akron" },
        ),
        context,
      ),
    ).toBe("Updated the contact details and updated the location")
    expect(
      describeActivity(orgUpdate({ check_size_or_focus: null }, { check_size_or_focus: "x" }), {
        ...context,
        kind: "customer",
      }),
    ).toBe("Updated the need or focus")
    expect(
      describeActivity(
        orgUpdate({ first_contact_method: null }, { first_contact_method: "warm_intro" }),
        context,
      ),
    ).toBe("Noted how we met (warm intro)")
    expect(describeActivity(orgUpdate({ subtype: null }, { subtype: "vc" }), context)).toBe(
      "Set the type to VC",
    )
    expect(
      describeActivity(
        orgUpdate({ last_contact_date: null }, { last_contact_date: "2026-10-09" }),
        context,
      ),
    ).toBe("Noted contact on Oct 9")
    expect(
      describeActivity(
        orgUpdate({ related_organization_id: null }, { related_organization_id: ORG }),
        context,
      ),
    ).toBe("Linked the matching customer")
    expect(describeActivity(orgUpdate({ link: "https://a.co" }, { link: null }), context)).toBe(
      "Removed the link",
    )
  })

  it("names a former teammate when the person is unknown", () => {
    expect(
      describeActivity(orgUpdate({ owner_id: JOHN }, { owner_id: "someone-else" }), context),
    ).toBe("Made a former teammate the point of contact")
  })

  it("falls back to a general sentence", () => {
    expect(describeActivity(orgUpdate({ mystery: 1 }, { mystery: 2 }), context)).toBe(
      "Updated the details",
    )
  })

  it("describes an undo by what it did", () => {
    const undo = entry({
      action: "undo",
      before: { stage: "meeting", archived_at: null },
      after: { stage: "contacted", archived_at: null },
      changedFields: ["stage"],
    })
    expect(describeActivity(undo, context)).toBe("Moved from Meeting to Contacted")
    expect(describeActivities([undo], context)[0]).toMatchObject({ undo: true })
    expect(
      describeActivity(
        entry({
          action: "undo",
          before: { archived_at: "2026-10-05T15:00:00Z" },
          after: { archived_at: null },
          changedFields: ["archived_at"],
        }),
        context,
      ),
    ).toBe("Restored this investor")
  })
})

describe("meetings", () => {
  const meeting = (partial: Partial<ActivityEntry>) =>
    entry({ entityType: "org_meetings", entityId: MEETING, ...partial })

  it("tells logging a past meeting from scheduling a future one", () => {
    expect(
      describeActivity(meeting({ action: "insert", after: { starts_at: MEETING_AT } }), context),
    ).toBe("Logged a meeting on Oct 3")
    expect(
      describeActivity(
        meeting({ action: "insert", after: { starts_at: MEETING_AT, rating: 4 } }),
        context,
      ),
    ).toBe("Logged a meeting on Oct 3, rated 4/5")
    expect(
      describeActivity(
        meeting({
          action: "insert",
          occurredAt: "2026-10-01T12:00:00+00:00",
          after: { starts_at: MEETING_AT },
        }),
        context,
      ),
    ).toBe("Scheduled a meeting for Oct 3")
  })

  it("describes ratings, moves, follow-ups and notes", () => {
    expect(
      describeActivity(
        meeting({
          before: { starts_at: MEETING_AT, rating: null },
          after: { starts_at: MEETING_AT, rating: 5 },
          changedFields: ["rating"],
        }),
        context,
      ),
    ).toBe("Rated the Oct 3 meeting 5/5")
    expect(
      describeActivity(
        meeting({
          before: { starts_at: MEETING_AT },
          after: { starts_at: "2026-10-05T18:00:00+00:00" },
          changedFields: ["starts_at"],
        }),
        context,
      ),
    ).toBe("Moved the meeting from Oct 3 to Oct 5")
    expect(
      describeActivity(
        meeting({
          before: { starts_at: MEETING_AT },
          after: { starts_at: "2026-10-03T20:00:00+00:00" },
          changedFields: ["starts_at"],
        }),
        context,
      ),
    ).toBe("Changed the time of the Oct 3 meeting")
    expect(
      describeActivity(
        meeting({
          before: { starts_at: MEETING_AT },
          after: { starts_at: MEETING_AT, follow_up_owner_id: BRAD, follow_up_date: "2026-10-09" },
          changedFields: ["follow_up_date", "follow_up_owner_id"],
        }),
        context,
      ),
    ).toBe("Set a follow-up for Brad Hall by Oct 9")
    expect(
      describeActivity(
        meeting({
          before: { starts_at: MEETING_AT },
          after: { starts_at: MEETING_AT, rating: 3, summary: "Fine" },
          changedFields: ["rating", "summary"],
        }),
        context,
      ),
    ).toBe("Rated the Oct 3 meeting 3/5 and updated the notes on the Oct 3 meeting")
  })

  it("describes a removed meeting from its old row", () => {
    expect(
      describeActivity(
        meeting({ action: "delete", before: { starts_at: MEETING_AT }, after: null }),
        context,
      ),
    ).toBe("Removed the meeting on Oct 3")
  })

  it("names who was added to or removed from a meeting", () => {
    const attendee = { org_meeting_id: MEETING, person_id: BRAD }
    expect(
      describeActivity(
        entry({ entityType: "org_meeting_attendees", action: "insert", after: attendee }),
        context,
      ),
    ).toBe("Added Brad Hall to the Oct 3 meeting")
    expect(
      describeActivity(
        entry({
          entityType: "org_meeting_attendees",
          action: "delete",
          before: { ...attendee, org_meeting_id: "gone" },
        }),
        context,
      ),
    ).toBe("Removed Brad Hall from a meeting")
  })
})

describe("hypotheses and tests", () => {
  const statement = "Angels will write $25k checks before a pilot"

  it("quotes the hypothesis", () => {
    expect(
      describeActivity(
        entry({ entityType: "hypotheses", action: "insert", after: { statement } }),
        context,
      ),
    ).toBe(`Added the hypothesis “${statement}”`)
  })

  it("describes status and decision changes", () => {
    expect(
      describeActivity(
        entry({
          entityType: "hypotheses",
          before: { statement, status: "untested", decision: null },
          after: { statement, status: "validated", decision: "persevere" },
          changedFields: ["decision", "status"],
        }),
        context,
      ),
    ).toBe(`Marked “${statement}” Validated and decided to persevere on “${statement}”`)
  })

  it("cuts a long statement", () => {
    const long = "x".repeat(120)
    const line = describeActivity(
      entry({ entityType: "hypotheses", action: "insert", after: { statement: long } }),
      context,
    )
    expect(line).toBe(`Added the hypothesis “${"x".repeat(79)}…”`)
  })

  it("describes evidence with its outcome", () => {
    expect(
      describeActivity(
        entry({
          entityType: "hypothesis_tests",
          action: "insert",
          after: { hypothesis_id: HYPOTHESIS, outcome: "contradicts" },
        }),
        context,
      ),
    ).toBe(`Recorded evidence for “${statement}”: contradicts`)
    expect(
      describeActivity(
        entry({
          entityType: "hypothesis_tests",
          action: "insert",
          after: { hypothesis_id: "unknown", outcome: "supports" },
        }),
        context,
      ),
    ).toBe("Recorded evidence for a hypothesis: supports")
  })
})

describe("debriefs", () => {
  const debrief = (partial: Partial<ActivityEntry>) => entry({ entityType: "debriefs", ...partial })

  it("describes the automatic debrief and its completion", () => {
    expect(
      describeActivity(
        debrief({ action: "insert", after: { org_meeting_id: MEETING, status: "due" } }),
        context,
      ),
    ).toBe("Opened the debrief for the Oct 3 meeting")
    expect(
      describeActivity(
        debrief({
          before: { org_meeting_id: MEETING, status: "due" },
          after: { org_meeting_id: MEETING, status: "done" },
          changedFields: ["completed_at", "status", "worked"],
        }),
        context,
      ),
    ).toBe("Completed the debrief for the Oct 3 meeting")
    expect(
      describeActivity(
        debrief({
          before: { org_meeting_id: MEETING, facilitator_id: JOHN },
          after: { org_meeting_id: MEETING, facilitator_id: BRAD },
          changedFields: ["facilitator_id"],
        }),
        context,
      ),
    ).toBe("Made Brad Hall the facilitator for the Oct 3 meeting")
  })
})

describe("activityActor", () => {
  it("reads people, the bot and scheduled jobs", () => {
    expect(
      activityActor("person", {
        id: JOHN,
        kind: "person",
        display_name: "John",
        person: { name: "John LaRocco", avatar_url: null },
      }),
    ).toEqual({ kind: "person", id: JOHN, name: "John LaRocco", avatarUrl: null })
    expect(
      activityActor("bot", { id: "b", kind: "bot", display_name: "Grok", person: null }),
    ).toEqual({ kind: "bot", name: "Grok" })
    expect(activityActor("system", null)).toEqual({ kind: "system" })
  })
})

describe("activityWhen", () => {
  const today = "2026-10-12"
  it.each([
    ["2026-10-12T14:05:00Z", "today, 10:05 AM"],
    // 11:30 PM ET on Oct 11 is still "yesterday" although it's Oct 12 in UTC.
    ["2026-10-12T03:30:00Z", "yesterday, 11:30 PM"],
    ["2026-10-09T12:00:00Z", "3 days ago"],
    ["2026-10-03T12:00:00Z", "Oct 3"],
    ["2025-12-30T12:00:00Z", "Dec 30, 2025"],
  ])("%s → %s", (occurredAt, expected) => {
    expect(activityWhen(occurredAt, today)).toBe(expected)
  })
})
