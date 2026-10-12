import { exportOrgsCsv } from "@/features/orgs/export"

/** CSV of the customer list as filtered (same query string as /customers). */
export function GET(request: Request) {
  return exportOrgsCsv("customer", request)
}
