/**
 * The 34 CliftonStrengths themes (Gallup's public taxonomy), alphabetical, with
 * the leadership domain each one belongs to. A profile stores up to five theme
 * names in `people.strengths`, in rank order (1st … 5th).
 *
 * Domains (Gallup): Executing 9, Influencing 8, Relationship Building 9,
 * Strategic Thinking 8.
 */

export const STRENGTH_DOMAINS = [
  "executing",
  "influencing",
  "relationship_building",
  "strategic_thinking",
] as const

export type StrengthDomain = (typeof STRENGTH_DOMAINS)[number]

export const strengthDomainLabels: Record<StrengthDomain, string> = {
  executing: "Executing",
  influencing: "Influencing",
  relationship_building: "Relationship Building",
  strategic_thinking: "Strategic Thinking",
}

export const CLIFTON_STRENGTHS = [
  { name: "Achiever", domain: "executing" },
  { name: "Activator", domain: "influencing" },
  { name: "Adaptability", domain: "relationship_building" },
  { name: "Analytical", domain: "strategic_thinking" },
  { name: "Arranger", domain: "executing" },
  { name: "Belief", domain: "executing" },
  { name: "Command", domain: "influencing" },
  { name: "Communication", domain: "influencing" },
  { name: "Competition", domain: "influencing" },
  { name: "Connectedness", domain: "relationship_building" },
  { name: "Consistency", domain: "executing" },
  { name: "Context", domain: "strategic_thinking" },
  { name: "Deliberative", domain: "executing" },
  { name: "Developer", domain: "relationship_building" },
  { name: "Discipline", domain: "executing" },
  { name: "Empathy", domain: "relationship_building" },
  { name: "Focus", domain: "executing" },
  { name: "Futuristic", domain: "strategic_thinking" },
  { name: "Harmony", domain: "relationship_building" },
  { name: "Ideation", domain: "strategic_thinking" },
  { name: "Includer", domain: "relationship_building" },
  { name: "Individualization", domain: "relationship_building" },
  { name: "Input", domain: "strategic_thinking" },
  { name: "Intellection", domain: "strategic_thinking" },
  { name: "Learner", domain: "strategic_thinking" },
  { name: "Maximizer", domain: "influencing" },
  { name: "Positivity", domain: "relationship_building" },
  { name: "Relator", domain: "relationship_building" },
  { name: "Responsibility", domain: "executing" },
  { name: "Restorative", domain: "executing" },
  { name: "Self-Assurance", domain: "influencing" },
  { name: "Significance", domain: "influencing" },
  { name: "Strategic", domain: "strategic_thinking" },
  { name: "Woo", domain: "influencing" },
] as const satisfies readonly { name: string; domain: StrengthDomain }[]

export type CliftonStrength = (typeof CLIFTON_STRENGTHS)[number]["name"]

export const CLIFTON_STRENGTH_NAMES: readonly CliftonStrength[] = CLIFTON_STRENGTHS.map(
  (s) => s.name,
)

/** How many themes a profile lists (Gallup's "top 5"). */
export const MAX_STRENGTHS = 5

const byLowerName = new Map<string, (typeof CLIFTON_STRENGTHS)[number]>(
  CLIFTON_STRENGTHS.map((s) => [s.name.toLowerCase(), s]),
)

/**
 * The canonical theme name for `value`, ignoring case and surrounding spaces
 * ("woo" -> "Woo", " self-assurance " -> "Self-Assurance"), or null when it isn't
 * one of the 34 themes.
 */
export function canonicalStrength(value: string): CliftonStrength | null {
  return byLowerName.get(value.trim().toLowerCase())?.name ?? null
}

/**
 * The domain of a stored theme name, or null for anything else (e.g. a value
 * written before validation existed). Display code should cope with null.
 */
export function strengthDomain(name: string): StrengthDomain | null {
  return byLowerName.get(name.trim().toLowerCase())?.domain ?? null
}
