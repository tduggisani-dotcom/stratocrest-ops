import type { OrgKind } from "@/features/orgs/kind-config"

/**
 * CONTRACT (Stage 3 build; the hypotheses agent implements it, the org page
 * renders it). The org's hypothesis log: each hypothesis with its status and
 * latest evidence, plus adding one. An async server component, rendered
 * inside the org page's Suspense.
 */
export async function OrgHypotheses(_props: { kind: OrgKind; orgId: string; orgName: string }) {
  return null
}
