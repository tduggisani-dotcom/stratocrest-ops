import type { Metadata, Viewport } from "next"
import { ThemeScript } from "@/components/theme/theme-script"
import { Toaster } from "@/components/ui/sonner"
import "./globals.css"

export const metadata: Metadata = {
  title: { default: "StratoCrest Ops", template: "%s · StratoCrest Ops" },
  description: "The StratoCrest team's private operations app.",
  applicationName: "StratoCrest Ops",
  // Private team tool: keep it out of search engines.
  robots: { index: false, follow: false },
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#171717" },
  ],
}

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <ThemeScript />
      </head>
      <body className="min-h-dvh">
        {children}
        <Toaster position="top-center" />
      </body>
    </html>
  )
}
