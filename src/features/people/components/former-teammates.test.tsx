import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"
import type { PersonCard } from "@/features/people/queries"
import { FormerTeammates } from "./former-teammates"

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))

function person(id: string, name: string, owned: Partial<PersonCard> = {}): PersonCard {
  return {
    id,
    name,
    role: "Advisor",
    avatarUrl: null,
    contactPreference: null,
    strengths: [],
    isActive: false,
    openTasks: 0,
    investorsOwned: 0,
    customersOwned: 0,
    keyResultsOwned: 0,
    ...owned,
  }
}

describe("FormerTeammates", () => {
  it("links each former teammate and notes open items in a neutral badge", () => {
    const html = renderToStaticMarkup(
      <FormerTeammates
        people={[
          person("p1", "Alex Former", { openTasks: 2, investorsOwned: 1 }),
          person("p2", "Blair Former"),
        ]}
      />,
    )
    expect(html).toContain('href="/people/p1"')
    expect(html).toContain('href="/people/p2"')
    expect(html).toMatch(/data-slot="badge" data-variant="outline"[^>]*><svg[^>]*triangle-alert/)
    expect(html).toContain("3 open items to hand over")
    // Only Alex has something to hand over.
    expect(html.match(/to hand over/g)).toHaveLength(1)
    // Amber is the "stale" status colour only (spec §7).
    expect(html).not.toMatch(/\b(text|bg|border)-stale/)
  })
})
