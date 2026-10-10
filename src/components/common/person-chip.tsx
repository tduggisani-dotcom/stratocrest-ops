import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"

/** The fields a chip needs; `CurrentPerson` and people rows mapped to camelCase both fit. */
export type ChipPerson = {
  name: string
  avatarUrl?: string | null
  role?: string | null
}

type ChipSize = "sm" | "md"

/** "John LaRocco" -> "JL", "Tanush" -> "T". */
export function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return "?"
  const first = words[0]?.[0] ?? ""
  const last = words.length > 1 ? (words[words.length - 1]?.[0] ?? "") : ""
  return `${first}${last}`.toUpperCase()
}

/** "John LaRocco" -> "John". */
export function firstNameOf(name: string): string {
  return name.trim().split(/\s+/)[0] || name
}

/**
 * A person's photo, or their initials when there is no photo (or it fails to
 * load). Decorative: the name next to it carries the meaning, so pass
 * `label` only when the avatar is shown on its own.
 */
export function PersonAvatar({
  person,
  size = "md",
  label,
  className,
}: {
  person: ChipPerson
  size?: ChipSize
  label?: string
  className?: string
}) {
  return (
    <Avatar
      size={size === "sm" ? "sm" : "default"}
      className={className}
      aria-hidden={label ? undefined : true}
      aria-label={label}
      role={label ? "img" : undefined}
    >
      {person.avatarUrl ? <AvatarImage src={person.avatarUrl} alt="" /> : null}
      <AvatarFallback className="font-medium">{initialsOf(person.name)}</AvatarFallback>
    </Avatar>
  )
}

/**
 * Avatar + name (+ role). Used wherever an item shows its owner ("people
 * first"). Long names truncate instead of widening the layout.
 */
export function PersonChip({
  person,
  size = "md",
  showRole = false,
  className,
}: {
  person: ChipPerson
  size?: ChipSize
  showRole?: boolean
  className?: string
}) {
  const role = showRole ? person.role : null
  return (
    <span
      data-slot="person-chip"
      className={cn("inline-flex max-w-full min-w-0 items-center gap-2", className)}
    >
      <PersonAvatar person={person} size={size} />
      <span className="flex min-w-0 flex-col text-left">
        <span
          className={cn(
            "truncate font-medium text-foreground",
            size === "sm" ? "text-xs" : "text-sm",
          )}
        >
          {person.name}
        </span>
        {role ? <span className="truncate text-xs text-muted-foreground">{role}</span> : null}
      </span>
    </span>
  )
}
