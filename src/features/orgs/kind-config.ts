import { orgKindLabels, orgStagesByKind, orgSubtypesByKind } from "@/lib/labels"
import type { Database } from "@/types/database"

/**
 * Investors and customers share ONE implementation (CLAUDE.md). Everything
 * that differs between them lives here; components read it by `kind` and
 * never branch on the kind themselves.
 */

export type OrgKind = Database["public"]["Enums"]["org_kind"]
export type OrgRegion = Database["public"]["Enums"]["org_region"]
export type OrgSubtype = Database["public"]["Enums"]["org_subtype"]

type StageOption = { value: string; label: string; outcome: "open" | "won" | "lost" }

export type KindConfig = {
  kind: OrgKind
  /** "Investor" / "Customer" */
  singular: string
  /** "Investors" / "Customers" */
  plural: string
  /** The list page; every other org URL is built from it (see links.ts). */
  basePath: "/investors" | "/customers"
  /** Pipeline stages in order (mirrors the org_stages table). */
  stages: readonly StageOption[]
  /** Subtypes allowed for this kind (mirrors the CHECK on organizations.subtype). */
  subtypes: readonly OrgSubtype[]
  /** Label and hint for organizations.check_size_or_focus. */
  focusLabel: string
  focusHint: string
  /** The list's empty state. */
  emptyTitle: string
  emptyDescription: string
  /** "Add investor" */
  addLabel: string
  /** Shown under the page title. */
  description: string
}

export const KIND_CONFIG = {
  investor: {
    kind: "investor",
    singular: orgKindLabels.investor.singular,
    plural: orgKindLabels.investor.plural,
    basePath: "/investors",
    stages: orgStagesByKind.investor,
    subtypes: orgSubtypesByKind.investor,
    focusLabel: "Check size or focus",
    focusHint: "For example: $25k–$100k pre-seed, hardware and construction tech",
    emptyTitle: "No investors yet",
    emptyDescription:
      "Each investor gets one owner, a concrete next step and a date, plus a log of every meeting: how it went, what they asked for, and what we learned.",
    addLabel: "Add investor",
    description: "Every investor conversation: who owns it, what's next, and how it went.",
  },
  customer: {
    kind: "customer",
    singular: orgKindLabels.customer.singular,
    plural: orgKindLabels.customer.plural,
    basePath: "/customers",
    stages: orgStagesByKind.customer,
    subtypes: orgSubtypesByKind.customer,
    focusLabel: "Need or focus",
    focusHint: "For example: crews of 50+, wants a 10-helmet pilot on one site",
    emptyTitle: "No customers yet",
    emptyDescription:
      "Each customer or pilot gets one owner, a concrete next step and a date, plus a log of every conversation and what it taught us.",
    addLabel: "Add customer",
    description: "The customer and pilot pipeline, from first contact to conversion.",
  },
} as const satisfies Record<OrgKind, KindConfig>

export function kindConfig(kind: OrgKind): KindConfig {
  return KIND_CONFIG[kind]
}

/** Stage values for a kind, in pipeline order. */
export function stageValues(kind: OrgKind): string[] {
  return KIND_CONFIG[kind].stages.map((stage) => stage.value)
}

export function isStageOf(kind: OrgKind, stage: string): boolean {
  return KIND_CONFIG[kind].stages.some((s) => s.value === stage)
}

/** The org's owner, in the words of the spec's tracker table. */
export const OWNER_LABEL = "Coatl point of contact"
