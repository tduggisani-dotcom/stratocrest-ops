/**
 * Starter checklist templates (spec §6.9), in the spirit of the WHO surgical
 * checklist: a few short, checkable steps grouped by pause point (before,
 * during, after), not a manual. Generic process steps only — no names, facts or
 * numbers about real organizations.
 *
 * `pnpm seed` only inserts a template whose name doesn't exist yet, so the
 * team's edits are never overwritten.
 */
export type ChecklistItemSeed = { text: string; hint?: string }

export type ChecklistTemplateSeed = {
  name: string
  description: string
  items: readonly ChecklistItemSeed[]
}

export const CHECKLIST_TEMPLATES: readonly ChecklistTemplateSeed[] = [
  {
    name: "Investor meeting prep",
    description: "Before, during and after a meeting with an investor.",
    items: [
      {
        text: "Before: Research the investor's focus, past investments and typical check size",
        hint: "Note anything that makes Coatl a fit, or not.",
      },
      {
        text: "Before: Write the hypothesis this meeting will test",
        hint: "Add it to the investor's hypothesis log so the result gets recorded.",
      },
      { text: "Before: Agree who leads, who presents and who takes notes" },
      { text: "Before: Prepare the deck or one-page summary and answers to likely questions" },
      { text: "Before: Decide the one thing we will ask for at the end" },
      { text: "During: Ask how they make decisions and what they would need to see next" },
      { text: "During: Agree a concrete next step and a date before the meeting ends" },
      {
        text: "After: Log the meeting with a 1–5 rating and a one-line summary the same day",
        hint: "Logging the meeting prompts the debrief and a follow-up task.",
      },
      { text: "After: Send the follow-up and any requested materials" },
      { text: "After: Complete the debrief and turn action items into tasks" },
    ],
  },
  {
    name: "Grant submission",
    description: "From reading the call to recording the decision.",
    items: [
      {
        text: "Plan: Confirm eligibility, the deadline (with time zone) and the submission portal",
        hint: "Set an internal deadline a few days before the real one.",
      },
      { text: "Plan: Read the full call and list every required document and scoring criterion" },
      { text: "Plan: Give each section one owner and an internal due date" },
      { text: "Draft: Show where the application answers each scoring criterion" },
      {
        text: "Draft: Build the budget and justification, and have a second person check the numbers",
      },
      { text: "Draft: Request letters of support and other attachments early" },
      {
        text: "Review: Have someone who didn't write it score it against the criteria",
      },
      {
        text: "Submit: Submit early, then save the confirmation and a copy of what was sent",
      },
      { text: "After: Record the expected decision date and log any reviewer feedback" },
    ],
  },
  {
    name: "Mentor session prep",
    description: "Get specific help from a mentor session and act on it.",
    items: [
      { text: "Before: Review notes and action items from the last session" },
      {
        text: "Before: Choose the few questions we most need help with",
        hint: "Specific questions get specific advice.",
      },
      { text: "Before: Send the mentor a short update and the questions ahead of time" },
      { text: "Before: Bring current pipeline, OKR progress and blockers" },
      { text: "Before: Agree who takes notes" },
      { text: "During: Write down specific advice and any introductions offered" },
      { text: "During: Confirm next steps and when we'll meet again" },
      { text: "After: Thank the mentor and follow up on introductions" },
      { text: "After: Complete the debrief and turn advice into tasks with owners" },
    ],
  },
  {
    name: "Demo Day rehearsal",
    description: "Run a rehearsal that ends with clear, owned changes.",
    items: [
      { text: "Before: Confirm the time limit, format and AV setup with the organizers" },
      { text: "Before: Lock the deck version for this run and keep a backup copy offline" },
      { text: "Before: Agree who presents each part and who answers which kinds of questions" },
      { text: "During: Run the full pitch with a timer and note where it runs long" },
      {
        text: "During: Practice the questions we expect, with someone playing the investor",
      },
      { text: "During: Collect written feedback from everyone watching" },
      { text: "After: Decide which changes to make and give each one an owner" },
      { text: "After: Schedule the next rehearsal" },
      { text: "After: Complete the debrief" },
    ],
  },
]
