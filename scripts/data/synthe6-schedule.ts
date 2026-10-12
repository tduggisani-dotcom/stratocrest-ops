import type { Database } from "../../src/types/database.ts"

/**
 * Synthe6 Cohort 2 schedule, copied cell for cell from spec §11 (all
 * Wednesdays unless noted). `pnpm seed` upserts these on start_date and only
 * ever writes the columns below, so the team's owners, notes, deliverables and
 * times survive a re-run.
 */
type SessionInsert = Database["public"]["Tables"]["synthe6_sessions"]["Insert"]

export type Synthe6ScheduleRow = Required<
  Pick<
    SessionInsert,
    | "week_number"
    | "week_label"
    | "start_date"
    | "end_date"
    | "format"
    | "activity_type"
    | "topic"
    | "is_break"
    | "emphasis"
  >
>

/** The schedule columns `pnpm seed` owns. Everything else belongs to the team. */
export const SCHEDULE_COLUMNS = [
  "week_number",
  "week_label",
  "start_date",
  "end_date",
  "format",
  "activity_type",
  "topic",
  "is_break",
  "emphasis",
] as const satisfies readonly (keyof Synthe6ScheduleRow)[]

/** Spec §11 cells: Week | Date | Format | Type | Topic. "—" means none. */
type SpecRow = readonly [week: string, date: string, format: string, type: string, topic: string]

const NONE = "—"

// prettier-ignore
const SPEC_ROWS: readonly SpecRow[] = [
  ["W1", "2026-10-07", "In-person", "Workshop", "Kickoff + Readiness Levels + Cohort Introductions (PIC overview)"],
  ["W2", "2026-10-14", "Virtual", "Workshop", "Goal Setting & OKRs + CliftonStrengths"],
  ["W3", "2026-10-19 to 2026-10-23", "Virtual / individually scheduled", "Startup 360 Reviews", "Startup 360 Assessments"],
  ["W4", "2026-10-28", "Mentor Coaching", "Lead Mentor Coaching", "—"],
  ["W5", "2026-11-04", "In-person", "Workshop", "OKR Share-out + Time & Team Management & Coachability + Running Mentor Meeting"],
  ["—", "2026-11-11", "No meeting", "Veterans Day / off week", "—"],
  ["W6", "2026-11-18", "Virtual", "Workshop", "Quantified Value Proposition, Competitive Analysis & Pilot Targets"],
  ["—", "2026-11-25", "No meeting", "Thanksgiving break", "—"],
  ["W7", "2026-12-02", "Virtual", "Workshop", "Grant Strategy, Funding Fit, Application Narrative Basics"],
  ["W8", "2026-12-09", "Mentor Coaching", "Lead Mentor Coaching", "—"],
  ["W9", "2026-12-16", "In-person", "Workshop", "Branding Basics + One Page Summaries + Pitch Decks"],
  ["—", "2026-12-23", "No meeting", "Holiday break", "—"],
  ["—", "2026-12-30", "No meeting", "Holiday break", "—"],
  ["—", "2027-01-06", "No meeting", "Holiday break", "—"],
  ["W10", "2027-01-13", "Virtual", "Workshop", "Q1 OKR Share-out + Prioritization & Pivoting"],
  ["W11", "2027-01-20", "Virtual", "Workshop", "Sales, Outreach, Pipelines & Pilot Advancement"],
  ["W12", "2027-01-27", "Mentor Coaching", "Lead Mentor Coaching", "—"],
  ["W13", "2027-02-03", "In-person", "Workshop", "Business Model, Pricing & Financial Model"],
  ["W14", "2027-02-10", "Virtual", "Workshop + Panel", "Intellectual Property Strategy + IP Panel"],
  ["W15", "2027-02-17", "Virtual", "Workshop", "Grant Application Development"],
  ["W16", "2027-02-24", "Mentor Coaching", "Lead Mentor Coaching", "—"],
  ["W17", "2027-03-03", "In-person", "Workshop", "Capital Strategy + Boards, Advisors & Investors"],
  ["W18", "2027-03-10", "Virtual", "Workshop", "Investor Research & Outreach + Pitch Deck Clean"],
  ["W19", "2027-03-17", "Virtual", "Workshop + Panel", "Corporate Pilots & Partnerships Panel + Negotiation"],
  ["W20", "2027-03-24", "Mentor Coaching", "Lead Mentor Coaching", "—"],
  ["W21", "2027-03-31", "In-person", "Workshop", "Manufacturing Scale-Up Planning, Regulatory Considerations & Technical Validation"],
  ["W22", "2027-04-07", "Virtual", "Workshop", "Q2 OKR Share-out + One Page Summary Refresh (evidence, traction, milestones)"],
  ["W23", "2027-04-14", "Virtual", "Workshop", "Grant Submission, Reviewer Feedback, Future Opportunities & Financial Planning"],
  ["W24", "2027-04-21", "Mentor Coaching", "Lead Mentor Coaching", "—"],
  ["W25", "2027-04-28", "In-person", "Workshop", "Pilot Conversion, Contracts, & Strategic Partnerships"],
  ["W26", "2027-05-05", "Virtual", "Workshop", "Qualifying Vendors, Supply Chain & Scale-Up"],
  ["W27", "2027-05-12", "Virtual", "Workshop + Panel", "Manufacturing & Supply Chain Panel + Problem Solving"],
  ["W28", "2027-05-19", "Mentor Coaching", "Lead Mentor Coaching", "—"],
  ["W29", "2027-05-26", "In-person", "Workshop", "Investment: Due Diligence + Data Room"],
  ["W30", "2027-06-02", "Virtual", "Workshop", "Pitch Deck clean up + Executive Presence"],
  ["W31", "2027-06-09", "Virtual", "Workshop", "Customer Economics, Segmentation, & GTM and Growth Strategy"],
  ["W32", "2027-06-16", "Mentor Coaching", "Lead Mentor Coaching", "—"],
  ["W33", "2027-06-23", "In-person", "Workshop", "Company Culture + Emotional Intelligence"],
  ["W34", "2027-06-30", "Virtual", "Workshop", "Hiring, Contractors & Building the Team"],
  ["W35", "2027-07-07", "Virtual", "Workshop", "Q3 OKR Share-out + Exit Strategies"],
  ["W36", "2027-07-14", "Mentor Coaching", "Lead Mentor Coaching", "—"],
  ["W37", "2027-07-21", "In-person", "Workshop", "Boilerplate and Media Training + LinkedIn Operations"],
  ["W38", "2027-07-28", "Virtual", "Workshop", "Investor Q&A + Demo Day Pitch Practice"],
  ["W39", "2027-08-04", "Virtual", "Workshop + Panel", "Investor / Diligence Panel + Website Feedback"],
  ["W40", "2027-08-11", "Mentor Coaching", "Lead Mentor Coaching", "—"],
  ["W41", "2027-08-18", "In-person", "Workshop", "Full Demo Day Pitch Rehearsal"],
  ["W42", "2027-08-25", "Virtual", "Workshop", "Demo Day Pitch/Q&A Practice"],
  ["W43", "2027-09-01", "Virtual", "Workshop", "Demo Day Strategy & Follow-up"],
  ["W44", "2027-09-08", "Mentor Coaching", "Lead Mentor Coaching", "—"],
  ["W45", "2027-09-15", "Virtual", "Workshop", "Demo Day Debrief + Final Readiness Assessment"],
  ["W46", "2027-09-22", "Virtual", "Workshop", "Demo Day Follow-up: Investors, Customers & Pilots"],
  ["W47", "2027-09-29", "In-person", "Workshop", "Post-Synthe6 Roadmap, Graduation"],
  ["W48", "2027-10-06", "Mentor Coaching", "Lead Mentor Coaching", "—"],
]

/** Emphasis tags shown on the timeline (spec §6.5). */
const OKR_SHARE_OUT_WEEKS = new Set([5, 10, 22, 35])
const DEMO_DAY_PREP_WEEKS = new Set([38, 39, 40, 41, 42, 43])
const MENTOR_COACHING_TYPE = "Lead Mentor Coaching"

function emphasisOf(weekNumber: number | null, type: string): Synthe6ScheduleRow["emphasis"] {
  if (weekNumber !== null && OKR_SHARE_OUT_WEEKS.has(weekNumber)) return "okr_share_out"
  if (type === MENTOR_COACHING_TYPE) return "mentor_coaching"
  if (weekNumber !== null && DEMO_DAY_PREP_WEEKS.has(weekNumber)) return "demo_day_prep"
  return null
}

function toRow([week, date, format, type, topic]: SpecRow): Synthe6ScheduleRow {
  const isBreak = week === NONE
  const weekNumber = isBreak ? null : Number(week.slice(1))
  // W3 is a range: "2026-10-19 to 2026-10-23".
  const [startDate, endDate = startDate] = date.split(" to ")
  return {
    week_number: weekNumber,
    week_label: isBreak ? null : week,
    start_date: startDate,
    end_date: endDate,
    format,
    activity_type: type,
    topic: topic === NONE ? null : topic,
    is_break: isBreak,
    emphasis: emphasisOf(weekNumber, type),
  }
}

/** All 53 rows: 48 numbered weeks and 5 break weeks, in date order. */
export const SYNTHE6_SCHEDULE: readonly Synthe6ScheduleRow[] = SPEC_ROWS.map(toRow)
