/**
 * The six StratoCrest teammates (spec §2), in rotation order.
 * `sort_order` sets the display order and the Sunday-meeting facilitator
 * rotation. Emails are NOT here: they come from TEAM_EMAILS so they never land
 * in git. `pnpm seed` matches TEAM_EMAILS entries to these names exactly.
 */
export type TeamMember = { name: string; role: string; sort_order: number }

export const TEAM: readonly TeamMember[] = [
  { name: "John LaRocco", role: "CEO", sort_order: 1 },
  { name: "Taeyoon Eom", role: "CTO", sort_order: 2 },
  { name: "Brad Hall", role: "COO", sort_order: 3 },
  { name: "Sam Browning", role: "CFO", sort_order: 4 },
  { name: "Ian Zalcberg", role: "IT Director", sort_order: 5 },
  { name: "Tanush", role: "R&D Lead", sort_order: 6 },
]
