import type { Metadata } from "next"
import { navItem } from "@/components/shell/nav-config"
import { HypothesesPage } from "@/features/hypotheses/rollup"

export const metadata: Metadata = { title: navItem("/hypotheses").label }

/** The hypothesis roll-up across investors and customers (spec §6.3), from features/hypotheses. */
export default function HypothesesRoute({ searchParams }: PageProps<"/hypotheses">) {
  return <HypothesesPage searchParams={searchParams} />
}
