import { Suspense } from "react"
import { AppBrand } from "./app-brand"
import { CurrentUserMenu } from "./current-user-menu"
import { SidebarNav, SidebarNavList } from "./sidebar-nav"

/**
 * Desktop (md and up) sidebar: app name, sections, and the user menu at the
 * bottom. A plain <div>, not <aside>: the <nav> inside is the landmark.
 */
export function AppSidebar() {
  return (
    <div className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r bg-muted/40 md:flex">
      <div className="px-4 pt-4 pb-2">
        <AppBrand className="px-1" />
      </div>
      <div className="flex-1 overflow-y-auto px-2 py-4">
        <Suspense fallback={<SidebarNavList pathname={null} />}>
          <SidebarNav />
        </Suspense>
      </div>
      <div className="border-t p-2">
        <CurrentUserMenu variant="sidebar" />
      </div>
    </div>
  )
}
