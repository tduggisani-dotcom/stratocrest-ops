import { exportOrgsCsv } from "@/features/orgs/export"

/** CSV of the investor list as filtered (same query string as /investors). */
export function GET(request: Request) {
  return exportOrgsCsv("investor", request)
}
