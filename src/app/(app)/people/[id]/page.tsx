import { Suspense } from "react"
import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeftIcon } from "lucide-react"
import { LiveRefresh } from "@/components/common/live-refresh"
import { AvailabilitySection } from "@/features/people/components/availability-section"
import { CrunchSection } from "@/features/people/components/crunch-section"
import { OwnershipSection } from "@/features/people/components/ownership-section"
import { ProfileForm } from "@/features/people/components/profile-form"
import { ProfileHeader } from "@/features/people/components/profile-header"
import { ProfileSection } from "@/features/people/components/profile-section"
import { ProfileSkeleton } from "@/features/people/components/skeletons"
import { StrengthsSection } from "@/features/people/components/strengths-section"
import { getPersonName, getProfile } from "@/features/people/queries"
import { requireTeamMember } from "@/lib/auth"

/** The tab title is the person's name (it streams in with the page's data). */
export async function generateMetadata({ params }: PageProps<"/people/[id]">): Promise<Metadata> {
  const { id } = await params
  const name = await getPersonName(id)
  return { title: name ?? "Profile" }
}

/**
 * /people/[id]: one teammate's profile. The back link is the static shell; the
 * profile streams in. Anyone on the team can edit any profile (spec §2).
 */
export default function PersonPage({ params }: PageProps<"/people/[id]">) {
  return (
    <>
      <Link
        href="/people"
        className="-ml-2 mb-4 inline-flex min-h-11 items-center gap-1.5 rounded-md px-2 text-sm text-muted-foreground hover:text-foreground md:min-h-9"
      >
        <ArrowLeftIcon className="size-4" aria-hidden />
        People
      </Link>
      <Suspense fallback={<ProfileSkeleton />}>
        <Profile params={params} />
      </Suspense>
    </>
  )
}

async function Profile({ params }: Pick<PageProps<"/people/[id]">, "params">) {
  const me = await requireTeamMember()
  const { id } = await params
  const profile = await getProfile(id)
  if (!profile) notFound()

  const { person } = profile
  const isMe = person.id === me.id
  return (
    <>
      <LiveRefresh tables={["people", "tasks", "organizations", "key_results"]} />
      <ProfileHeader person={person} isMe={isMe} />
      <div className="space-y-12">
        <OwnershipSection
          personId={person.id}
          name={person.name}
          orgs={profile.orgs}
          keyResults={profile.keyResults}
          openTasks={profile.openTasks}
          today={profile.today}
        />
        <StrengthsSection name={person.name} strengths={person.strengths} skills={person.skills} />
        <AvailabilitySection
          personId={person.id}
          name={person.name}
          blocks={profile.availability}
        />
        <CrunchSection
          personId={person.id}
          name={person.name}
          upcoming={profile.crunch.upcoming}
          past={profile.crunch.past}
          today={profile.today}
        />
        <ProfileSection
          id="edit-profile"
          title="Edit profile"
          description={
            isMe
              ? "Keep your profile current so the team knows how to reach you and what to ask you about."
              : `Anyone on the team can update ${person.name}'s profile.`
          }
        >
          <div className="rounded-xl border p-4 md:p-6">
            <ProfileForm
              person={{
                id: person.id,
                name: person.name,
                role: person.role,
                avatarUrl: person.avatarUrl,
                contactPreference: person.contactPreference,
                strengths: person.strengths,
                skills: person.skills,
              }}
              isMe={isMe}
            />
          </div>
        </ProfileSection>
      </div>
    </>
  )
}
