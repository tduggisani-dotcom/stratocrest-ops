import { describe, expect, it } from "vitest"
import {
  MOBILE_MORE,
  MOBILE_TABS,
  NAV_ITEMS,
  PRIMARY_NAV,
  SECONDARY_NAV,
  isActivePath,
  navItem,
} from "./nav-config"

const hrefs = (items: readonly { href: string }[]) => items.map((i) => i.href)

describe("nav config", () => {
  it("lists each section once", () => {
    expect(new Set(hrefs(NAV_ITEMS)).size).toBe(NAV_ITEMS.length)
  })

  it("groups the sidebar as planned", () => {
    expect(hrefs(PRIMARY_NAV)).toEqual([
      "/",
      "/investors",
      "/customers",
      "/tasks",
      "/program",
      "/meetings",
      "/debriefs",
      "/okrs",
      "/people",
    ])
    expect(hrefs(SECONDARY_NAV)).toEqual(["/hypotheses", "/checklists", "/inbox", "/settings"])
  })

  it("has four phone tabs (plus More), and More holds everything else", () => {
    expect(hrefs(MOBILE_TABS)).toEqual(["/", "/investors", "/customers", "/tasks"])
    expect([...hrefs(MOBILE_TABS), ...hrefs(MOBILE_MORE)].sort()).toEqual(hrefs(NAV_ITEMS).sort())
  })

  it("keeps bottom-nav labels short enough for a 390 px phone", () => {
    for (const item of MOBILE_TABS) {
      expect((item.shortLabel ?? item.label).length).toBeLessThanOrEqual(10)
    }
  })

  it("finds a section by href", () => {
    expect(navItem("/okrs").label).toBe("OKRs")
  })
})

describe("isActivePath", () => {
  it("matches home only on /", () => {
    expect(isActivePath("/", "/")).toBe(true)
    expect(isActivePath("/", "/investors")).toBe(false)
  })

  it("matches a section and the pages inside it", () => {
    expect(isActivePath("/investors", "/investors")).toBe(true)
    expect(isActivePath("/investors", "/investors/123")).toBe(true)
  })

  it("does not match a different section with the same prefix", () => {
    expect(isActivePath("/investors", "/investors-archive")).toBe(false)
  })

  it("matches nothing while the pathname is unknown", () => {
    expect(isActivePath("/", null)).toBe(false)
  })
})
