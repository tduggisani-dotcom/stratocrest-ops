"use client"

import { useState, type ReactNode } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Ellipsis, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { cn } from "@/lib/utils"
import { MOBILE_MORE, MOBILE_TABS, isActivePath } from "./nav-config"

/** Phone bottom nav (below `md`): four tabs plus "More". */
export function BottomNav() {
  return <BottomNavBar pathname={usePathname()} />
}

const tabClass = cn(
  "flex min-h-16 min-w-0 flex-col items-center justify-center gap-1 px-1 text-xs font-medium",
  "text-muted-foreground transition-colors hover:text-foreground",
  "focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-ring",
)

/**
 * Rendered with `pathname={null}` (nothing highlighted) as the Suspense
 * fallback, for the same reason as `SidebarNavList`.
 */
export function BottomNavBar({ pathname }: { pathname: string | null }) {
  const [moreOpen, setMoreOpen] = useState(false)
  const moreActive = MOBILE_MORE.some((item) => isActivePath(item.href, pathname))

  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur supports-[backdrop-filter]:bg-background/85 md:hidden"
    >
      <ul className="grid grid-cols-5">
        {MOBILE_TABS.map((item) => {
          const active = isActivePath(item.href, pathname)
          const Icon = item.icon
          return (
            <li key={item.href} className="min-w-0">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(tabClass, active && "text-primary hover:text-primary")}
              >
                <TabIcon active={active}>
                  <Icon aria-hidden className="size-5" />
                </TabIcon>
                <span className="max-w-full truncate">{item.shortLabel ?? item.label}</span>
              </Link>
            </li>
          )
        })}
        <li className="min-w-0">
          <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
            <SheetTrigger
              className={cn(tabClass, "w-full", moreActive && "text-primary hover:text-primary")}
            >
              <TabIcon active={moreActive}>
                <Ellipsis aria-hidden className="size-5" />
              </TabIcon>
              <span className="max-w-full truncate">More</span>
            </SheetTrigger>
            <SheetContent
              side="bottom"
              showCloseButton={false}
              className="max-h-[85dvh] gap-0 overflow-y-auto rounded-t-2xl pb-[calc(0.75rem+env(safe-area-inset-bottom))]"
            >
              <SheetHeader className="flex-row items-center justify-between gap-2 pb-2">
                <div className="min-w-0">
                  <SheetTitle>More</SheetTitle>
                  <SheetDescription className="sr-only">
                    The other sections of StratoCrest Ops.
                  </SheetDescription>
                </div>
                <SheetClose asChild>
                  <Button variant="ghost" size="icon" aria-label="Close">
                    <X aria-hidden />
                  </Button>
                </SheetClose>
              </SheetHeader>
              <nav aria-label="More sections" className="px-2">
                <ul className="flex flex-col">
                  {MOBILE_MORE.map((item) => {
                    const active = isActivePath(item.href, pathname)
                    const Icon = item.icon
                    return (
                      <li key={item.href}>
                        <SheetClose asChild>
                          <Link
                            href={item.href}
                            aria-current={active ? "page" : undefined}
                            className={cn(
                              "flex min-h-12 items-center gap-3 rounded-md px-3 text-base font-medium",
                              "hover:bg-accent hover:text-accent-foreground",
                              "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring",
                              active && "bg-accent text-foreground",
                            )}
                          >
                            <Icon
                              aria-hidden
                              className={cn(
                                "size-5 shrink-0 text-muted-foreground",
                                active && "text-primary",
                              )}
                            />
                            <span className="truncate">{item.label}</span>
                          </Link>
                        </SheetClose>
                      </li>
                    )
                  })}
                </ul>
              </nav>
            </SheetContent>
          </Sheet>
        </li>
      </ul>
    </nav>
  )
}

/** A pill behind the active tab's icon, so "active" isn't shown by colour alone. */
function TabIcon({ active, children }: { active: boolean; children: ReactNode }) {
  return (
    <span
      className={cn(
        "flex h-7 w-12 items-center justify-center rounded-full transition-colors",
        active && "bg-accent",
      )}
    >
      {children}
    </span>
  )
}
