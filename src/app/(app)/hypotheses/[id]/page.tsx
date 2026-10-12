import type { Metadata } from "next"
import { HypothesisPageView } from "@/features/hypotheses/hypothesis-page"

export const metadata: Metadata = { title: "Hypothesis" }

/** One hypothesis: status, decision, evidence trail and details (features/hypotheses). */
export default function HypothesisRoute({ params }: PageProps<"/hypotheses/[id]">) {
  return <HypothesisPageView params={params} />
}
