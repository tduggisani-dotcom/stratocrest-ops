import { MailIcon, PencilIcon } from "lucide-react"
import { initialsOf } from "@/components/common/person-chip"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import type { ProfilePerson } from "@/features/people/queries"

/** The top of a profile: large avatar, name (the page's h1), role, and how to reach them. */
export function ProfileHeader({ person, isMe }: { person: ProfilePerson; isMe: boolean }) {
  return (
    <header className="mb-8 flex flex-col gap-5 md:mb-10 md:flex-row md:items-start md:justify-between">
      <div className="flex min-w-0 items-start gap-4">
        <Avatar aria-hidden className="size-16 md:size-20">
          {person.avatarUrl ? <AvatarImage src={person.avatarUrl} alt="" /> : null}
          <AvatarFallback className="text-xl font-medium md:text-2xl">
            {initialsOf(person.name)}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 space-y-3">
          <div className="space-y-1">
            <h1 className="flex flex-wrap items-center gap-x-2 gap-y-1 text-2xl font-semibold tracking-tight break-words">
              {person.name}
              {isMe ? <Badge variant="secondary">You</Badge> : null}
              {!person.isActive ? <Badge variant="outline">Former teammate</Badge> : null}
            </h1>
            <p className="text-muted-foreground">{person.role}</p>
          </div>
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground">How to reach me</p>
            {person.contactPreference ? (
              <p className="max-w-prose text-sm break-words whitespace-pre-line">
                {person.contactPreference}
              </p>
            ) : (
              <p className="text-sm text-muted-foreground italic">
                Not set yet — add it in the profile form below
              </p>
            )}
            <a
              href={`mailto:${person.email}`}
              className="inline-flex min-h-11 items-center gap-1.5 text-sm break-all text-primary underline-offset-4 hover:underline md:min-h-0"
            >
              <MailIcon className="size-4 shrink-0" aria-hidden />
              {person.email}
            </a>
          </div>
        </div>
      </div>
      <Button asChild variant="outline" className="max-md:w-full">
        <a href="#edit-profile">
          <PencilIcon aria-hidden />
          Edit profile
        </a>
      </Button>
    </header>
  )
}
