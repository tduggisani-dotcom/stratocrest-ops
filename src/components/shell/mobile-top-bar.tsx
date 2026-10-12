import { AppBrand } from "./app-brand"
import { CurrentUserMenu } from "./current-user-menu"

/** Phone (below md) top bar: app name and the user menu avatar. */
export function MobileTopBar() {
  return (
    <header className="sticky top-0 z-40 flex h-14 items-center justify-between gap-2 border-b bg-background/95 pr-2 pl-4 backdrop-blur supports-[backdrop-filter]:bg-background/85 md:hidden">
      <AppBrand />
      <CurrentUserMenu variant="compact" />
    </header>
  )
}
