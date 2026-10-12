import { OrgNotFound } from "@/features/orgs/detail/not-found"

/** /investors/<unknown or malformed id> (and the ids of customers). */
export default function InvestorNotFound() {
  return <OrgNotFound kind="investor" />
}
