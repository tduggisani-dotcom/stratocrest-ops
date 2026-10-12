import { HypothesisNotFound } from "@/features/hypotheses/not-found"

/** /hypotheses/<unknown or malformed id>. */
export default function HypothesisRouteNotFound() {
  return <HypothesisNotFound />
}
