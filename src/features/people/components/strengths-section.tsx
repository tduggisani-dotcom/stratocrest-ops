import { firstNameOf } from "@/components/common/person-chip"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { strengthDomain, strengthDomainLabels } from "@/lib/clifton-strengths"
import { EmptyLine, ProfileSection, SubHeading } from "./profile-section"

/** CliftonStrengths top 5 (ranked, with each theme's domain) and skills. */
export function StrengthsSection({
  name,
  strengths,
  skills,
}: {
  name: string
  strengths: string[]
  skills: string[]
}) {
  const firstName = firstNameOf(name)
  const editLink = (label: string) => (
    <Button asChild variant="outline">
      <a href="#edit-profile">{label}</a>
    </Button>
  )
  return (
    <ProfileSection
      id="strengths"
      title="Strengths & skills"
      description={`What ${firstName} is good at, so the team knows who to ask.`}
    >
      <div className="space-y-6">
        <div className="space-y-2">
          <SubHeading id="strengths-top5">CliftonStrengths top 5</SubHeading>
          {strengths.length > 0 ? (
            <ol aria-labelledby="strengths-top5" className="flex flex-wrap gap-2">
              {strengths.map((strength, index) => {
                const domain = strengthDomain(strength)
                return (
                  <li
                    key={strength}
                    className="inline-flex max-w-full flex-wrap items-center gap-x-2 rounded-full border px-3 py-1.5 text-sm"
                  >
                    <span
                      aria-hidden
                      className="flex size-5 items-center justify-center rounded-full bg-muted text-xs font-medium tabular-nums"
                    >
                      {index + 1}
                    </span>
                    <span className="sr-only">{index + 1}. </span>
                    <span className="font-medium">{strength}</span>
                    {domain ? (
                      <span className="text-xs text-muted-foreground">
                        <span className="sr-only">, </span>
                        {strengthDomainLabels[domain]}
                      </span>
                    ) : null}
                  </li>
                )
              })}
            </ol>
          ) : (
            <EmptyLine action={editLink("Add strengths")}>
              No strengths added yet. Pick {firstName}&apos;s CliftonStrengths top 5 in the profile
              form below.
            </EmptyLine>
          )}
        </div>

        <div className="space-y-2">
          <SubHeading id="strengths-skills" count={skills.length}>
            Skills
          </SubHeading>
          {skills.length > 0 ? (
            <ul aria-labelledby="strengths-skills" className="flex flex-wrap gap-2">
              {skills.map((skill) => (
                <li key={skill} className="max-w-full">
                  <Badge
                    variant="secondary"
                    className="max-w-full px-2.5 py-1 text-left text-sm font-normal break-words whitespace-normal"
                  >
                    {skill}
                  </Badge>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyLine action={editLink("Add skills")}>
              No skills added yet. List what {firstName} can help with, like CAD or grant writing.
            </EmptyLine>
          )}
        </div>
      </div>
    </ProfileSection>
  )
}
