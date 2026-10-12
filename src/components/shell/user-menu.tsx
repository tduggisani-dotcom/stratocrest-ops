"use client"

import { useRef } from "react"
import { ChevronsUpDown, LogOut, Monitor, Moon, Sun, type LucideIcon } from "lucide-react"
import { PersonAvatar, PersonChip } from "@/components/common/person-chip"
import { useTheme, type ThemePreference } from "@/components/theme/use-theme"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { signOut } from "@/features/auth/actions"
import { cn } from "@/lib/utils"

/** Plain data from the server; never the whole session. */
export type UserMenuPerson = {
  name: string
  role: string
  email: string
  avatarUrl: string | null
}

const THEMES = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
] as const satisfies readonly { value: ThemePreference; label: string; icon: LucideIcon }[]

function isThemePreference(value: string): value is ThemePreference {
  return THEMES.some((t) => t.value === value)
}

// Menu rows are 44 px tall on phones (tap targets), compact on desktop.
const itemClass = "max-md:min-h-11"

/**
 * The signed-in person's menu: who you are, the theme, and sign out.
 * `variant="sidebar"` is a full-width row (desktop); `"compact"` is just the
 * avatar (phone top bar).
 */
export function UserMenu({
  person,
  variant,
}: {
  person: UserMenuPerson
  variant: "sidebar" | "compact"
}) {
  const { preference, setPreference } = useTheme()
  const signOutForm = useRef<HTMLFormElement>(null)

  return (
    <>
      {/* Lives outside the menu so it stays mounted while the menu closes. */}
      <form ref={signOutForm} action={signOut} className="hidden" />
      <DropdownMenu>
        {variant === "sidebar" ? (
          <DropdownMenuTrigger
            className={cn(
              "flex w-full min-w-0 items-center gap-2 rounded-md p-2 text-left transition-colors",
              "hover:bg-accent data-[state=open]:bg-accent",
              "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
            )}
          >
            <PersonChip person={person} showRole className="flex-1" />
            <ChevronsUpDown aria-hidden className="size-4 shrink-0 text-muted-foreground" />
            <span className="sr-only">Open account menu</span>
          </DropdownMenuTrigger>
        ) : (
          <DropdownMenuTrigger
            aria-label={`Account menu for ${person.name}`}
            className={cn(
              "flex size-11 items-center justify-center rounded-full",
              "hover:bg-accent data-[state=open]:bg-accent",
              "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
            )}
          >
            <PersonAvatar person={person} />
          </DropdownMenuTrigger>
        )}
        <DropdownMenuContent
          align={variant === "sidebar" ? "start" : "end"}
          side={variant === "sidebar" ? "top" : "bottom"}
          className="w-[min(16rem,calc(100vw-2rem))]"
        >
          <DropdownMenuLabel className="flex flex-col gap-1 font-normal">
            <PersonChip person={person} showRole />
            <span className="truncate text-xs text-muted-foreground">{person.email}</span>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuLabel className="text-xs font-medium text-muted-foreground">
            Theme
          </DropdownMenuLabel>
          <DropdownMenuRadioGroup
            value={preference}
            onValueChange={(value) => {
              if (isThemePreference(value)) setPreference(value)
            }}
          >
            {THEMES.map(({ value, label, icon: Icon }) => (
              <DropdownMenuRadioItem key={value} value={value} className={itemClass}>
                <Icon aria-hidden className="text-muted-foreground" />
                {label}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className={itemClass}
            onSelect={() => signOutForm.current?.requestSubmit()}
          >
            <LogOut aria-hidden />
            Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  )
}
