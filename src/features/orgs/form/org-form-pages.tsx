import { Suspense } from "react"
import Link from "next/link"
import { Archive } from "lucide-react"
import { LiveRefresh } from "@/components/common/live-refresh"
import { PageHeader } from "@/components/shell/page-header"
import { Button } from "@/components/ui/button"
import { requireTeamMember } from "@/lib/auth"
import { addDays } from "@/lib/dates"
import { BackToOrgs } from "../detail/back-link"
import { orgIdFrom, orgOrNotFound, requestToday, type OrgParams } from "../detail/resolve"
import { OrgFormSkeleton } from "../detail/skeletons"
import { kindConfig, type OrgKind } from "../kind-config"
import { orgHref } from "../links"
import { getOrgFormOptions } from "../queries/detail"
import { editDefaults, editOptions } from "./edit-defaults"
import { OrgForm } from "./org-form"

/** Days from today the first next step is due unless changed. */
const DEFAULT_NEXT_STEP_IN_DAYS = 7

/** "Edit investor" (the edit page's title). */
export function editOrgTitle(kind: OrgKind): string {
  return `Edit ${kindConfig(kind).singular.toLowerCase()}`
}

/** /investors/new and /customers/new: a static frame; the form streams in with its choices. */
export function NewOrgPage({ kind }: { kind: OrgKind }) {
  const config = kindConfig(kind)
  return (
    <div className="max-w-2xl">
      <BackToOrgs kind={kind} />
      <PageHeader
        title={config.addLabel}
        description="One owner, a concrete next step and a date. Everything else can wait."
      />
      <Suspense fallback={<OrgFormSkeleton />}>
        <NewOrgForm kind={kind} />
      </Suspense>
    </div>
  )
}

/** The add form: you as the point of contact, the next step due in a week. */
async function NewOrgForm({ kind }: { kind: OrgKind }) {
  const person = await requireTeamMember()
  const today = requestToday()
  const options = await getOrgFormOptions(kind)
  return (
    <OrgForm
      mode="create"
      kind={kind}
      options={options}
      defaults={{
        owner_id: options.people.some((p) => p.id === person.id) ? person.id : "",
        next_step_date: addDays(today, DEFAULT_NEXT_STEP_IN_DAYS),
      }}
    />
  )
}

/** /investors/<id>/edit and /customers/<id>/edit. Unknown ids are the [id] route's 404. */
export function EditOrgPage({ kind, params }: { kind: OrgKind; params: OrgParams }) {
  return (
    <div className="max-w-2xl">
      <LiveRefresh tables={["organizations"]} />
      <BackToOrgs kind={kind} />
      <PageHeader
        title={editOrgTitle(kind)}
        description="Owner, next step and its date are required. Everything else is optional."
      />
      <Suspense fallback={<OrgFormSkeleton />}>
        <EditOrgForm kind={kind} params={params} />
      </Suspense>
    </div>
  )
}

async function EditOrgForm({ kind, params }: { kind: OrgKind; params: OrgParams }) {
  const id = await orgIdFrom(params)
  const [org, options] = await Promise.all([orgOrNotFound(kind, id), getOrgFormOptions(kind)])
  const noun = kindConfig(kind).singular.toLowerCase()

  if (org.archivedAt) {
    return (
      <div
        role="status"
        className="flex flex-col items-start gap-3 rounded-xl border bg-muted/50 p-4"
      >
        <p className="flex items-start gap-2 text-sm">
          <Archive aria-hidden className="mt-0.5 size-4 shrink-0" />
          <span>
            <span className="font-medium">{org.name} is archived.</span> Restore this {noun} from
            its page to edit it.
          </span>
        </p>
        <Button asChild className="max-w-full max-md:w-full">
          <Link href={orgHref(kind, org.id)}>
            <span className="min-w-0 truncate">Open {org.name}</span>
          </Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Editing <span className="font-medium text-foreground">{org.name}</span>
      </p>
      <OrgForm
        mode="edit"
        kind={kind}
        orgId={org.id}
        options={editOptions(options, org)}
        defaults={editDefaults(org)}
      />
    </div>
  )
}
