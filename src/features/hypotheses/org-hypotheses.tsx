import { FlaskConical, Plus } from "lucide-react"
import { EmptyState } from "@/components/common/empty-state"
import { kindConfig, type OrgKind } from "@/features/orgs/kind-config"
import { requireTeamMember } from "@/lib/auth"
import { getActivePeople } from "@/lib/data/people"
import { DisclosurePanel, DisclosureScope, DisclosureToggle } from "./disclosure"
import { HypothesisForm } from "./hypothesis-form"
import { HypothesisItem } from "./hypothesis-item"
import { isOrgArchived, listOrgHypotheses } from "./queries"
import type { HypothesisListItem } from "./types"

/**
 * The org page's hypothesis log (spec §6.2 detail page, principle 2): what we
 * believe about this investor or customer, each with its status, owner and
 * evidence so far, newest first, and an inline "Add hypothesis" form (owner:
 * me). The org page gives it a card and the h2; this renders the content.
 * An archived org shows its log but takes no new hypotheses.
 */
export async function OrgHypotheses({
  kind,
  orgId,
  orgName,
}: {
  kind: OrgKind
  orgId: string
  orgName: string
}) {
  const me = await requireTeamMember()
  const [items, people, archived] = await Promise.all([
    listOrgHypotheses(orgId),
    getActivePeople(),
    isOrgArchived(orgId),
  ])
  const { singular } = kindConfig(kind)

  if (archived) {
    return items.length > 0 ? (
      <HypothesisList items={items} />
    ) : (
      <p className="text-sm text-muted-foreground">
        No hypotheses were recorded for {orgName}. Restore this {singular.toLowerCase()} to add one.
      </p>
    )
  }

  return (
    <DisclosureScope>
      {items.length > 0 ? (
        <>
          <HypothesisList items={items} />
          <div>
            <DisclosureToggle variant="outline" className="max-md:w-full">
              <Plus aria-hidden />
              Add hypothesis
            </DisclosureToggle>
          </div>
        </>
      ) : (
        <EmptyState
          icon={FlaskConical}
          titleAs="h3"
          size="compact"
          title={`No hypotheses yet — what do you expect to learn from ${orgName}?`}
          description="Write down what we believe before the next conversation, how we'll test it, and what would prove it. Each conversation's evidence then builds up here."
          action={
            <DisclosureToggle className="max-md:w-full">
              <Plus aria-hidden />
              Add hypothesis
            </DisclosureToggle>
          }
        />
      )}
      <DisclosurePanel label={`Add a hypothesis about ${orgName}`}>
        <HypothesisForm
          mode="create"
          orgId={orgId}
          people={people.map(({ id, name }) => ({ id, name }))}
          defaults={{ owner_id: me.id }}
        />
      </DisclosurePanel>
    </DisclosureScope>
  )
}

function HypothesisList({ items }: { items: HypothesisListItem[] }) {
  return (
    <ul className="flex flex-col gap-2">
      {items.map((item) => (
        <HypothesisItem key={item.id} item={item} showLatest />
      ))}
    </ul>
  )
}
