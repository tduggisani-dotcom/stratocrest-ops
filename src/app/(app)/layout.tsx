import { Suspense, type ReactNode } from "react"
import { AppSidebar } from "@/components/shell/app-sidebar"
import { BottomNav, BottomNavBar } from "@/components/shell/bottom-nav"
import { MobileTopBar } from "@/components/shell/mobile-top-bar"
import { SkipLink } from "@/components/shell/skip-link"

/**
 * The signed-in app shell. It is static (no cookie reads at this level), so it
 * prerenders and shows instantly; the user menu and each page's data stream in
 * behind their own Suspense boundaries.
 *
 * Desktop: sidebar on the left. Phones: top bar + fixed bottom nav, with bottom
 * padding on <main> so nothing hides behind the nav.
 */
export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh">
      <SkipLink />
      <AppSidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <MobileTopBar />
        <main
          id="main"
          tabIndex={-1}
          className="mx-auto w-full max-w-5xl flex-1 px-4 pt-6 pb-[calc(6rem+env(safe-area-inset-bottom))] outline-none md:px-8 md:pt-10 md:pb-12"
        >
          {children}
        </main>
      </div>
      <Suspense fallback={<BottomNavBar pathname={null} />}>
        <BottomNav />
      </Suspense>
    </div>
  )
}
