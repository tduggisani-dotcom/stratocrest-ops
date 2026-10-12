import { OrgNotFound } from "@/features/orgs/detail/not-found"

/** /customers/<unknown or malformed id> (and the ids of investors). */
export default function CustomerNotFound() {
  return <OrgNotFound kind="customer" />
}
