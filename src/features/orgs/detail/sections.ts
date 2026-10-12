/** The org page's sections, in page order: anchor id and h2. Shared by the slots and skeletons. */
export const ORG_SECTIONS = {
  details: { id: "org-details", title: "Contact & details" },
  meetings: { id: "org-meetings", title: "Meetings" },
  hypotheses: { id: "org-hypotheses", title: "Hypotheses" },
  tasks: { id: "org-tasks", title: "Tasks" },
  debriefs: { id: "org-debriefs", title: "Debriefs" },
  history: { id: "org-history", title: "Activity history" },
} as const

export type OrgSectionKey = keyof typeof ORG_SECTIONS
