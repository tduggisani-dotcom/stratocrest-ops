import type { DebriefAnswerField } from "@/lib/schemas/debriefs"

/**
 * The one debrief template (spec §6.7), for every kind of debrief: the four
 * questions in order, each with a short hint. Action items → tasks come in
 * Stage 4.
 */
export const DEBRIEF_QUESTIONS: readonly {
  field: DebriefAnswerField
  label: string
  hint: string
}[] = [
  { field: "planned", label: "What was planned?", hint: "What we set out to do, ask or learn." },
  { field: "actual", label: "What happened?", hint: "What really happened, surprises included." },
  { field: "worked", label: "What worked?", hint: "What to keep doing next time." },
  { field: "change", label: "What will we change?", hint: "One or two concrete changes." },
]
