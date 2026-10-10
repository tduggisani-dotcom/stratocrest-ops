"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { PRIMARY_NAV, SECONDARY_NAV, isActivePath, type NavItem } from "./nav-config"

/** Desktop sidebar links, with the current section highlighted. */
export function SidebarNav() {
  return <SidebarNavList pathname={usePathname()} />
}

/**
 * The links themselves. Rendered with `pathname={null}` (nothing highlighted)
 * as the Suspense fallback: on a page with an unknown dynamic segment,
 * `usePathname()` suspends during prerendering.
 */
export function SidebarNavList({ pathname }: { pathname: string | null }) {
  return (
    <nav aria-label="Main" className="flex flex-col gap-6">
      <ul className="flex flex-col gap-0.5">
        {PRIMARY_NAV.map((item) => (
          <SidebarLink key={item.href} item={item} active={isActivePath(item.href, pathname)} />
        ))}
      </ul>
      <div className="flex flex-col gap-1">
        <h2
          id="sidebar-more-heading"
          className="px-3 text-xs font-medium tracking-wide text-muted-foreground uppercase"
        >
          More
        </h2>
        <ul aria-labelledby="sidebar-more-heading" className="flex flex-col gap-0.5">
          {SECONDARY_NAV.map((item) => (
            <SidebarLink key={item.href} item={item} active={isActivePath(item.href, pathname)} />
          ))}
        </ul>
      </div>
    </nav>
  )
}

function SidebarLink({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon
  return (
    <li>
      <Link
        href={item.href}
        aria-current={active ? "page" : undefined}
        className={cn(
          "flex h-9 items-center gap-3 rounded-md px-3 text-sm font-medium transition-colors",
          "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
          active && "bg-accent text-foreground",
        )}
      >
        <Icon aria-hidden className={cn("size-4 shrink-0", active && "text-primary")} />
        <span className="truncate">{item.label}</span>
      </Link>
    </li>
  )
}
