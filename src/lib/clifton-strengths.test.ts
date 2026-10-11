import { describe, expect, it } from "vitest"
import {
  CLIFTON_STRENGTH_NAMES,
  CLIFTON_STRENGTHS,
  STRENGTH_DOMAINS,
  canonicalStrength,
  strengthDomain,
  strengthDomainLabels,
} from "@/lib/clifton-strengths"

describe("CliftonStrengths themes", () => {
  it("has exactly 34 unique themes", () => {
    expect(CLIFTON_STRENGTHS).toHaveLength(34)
    expect(new Set(CLIFTON_STRENGTH_NAMES).size).toBe(34)
    expect(new Set(CLIFTON_STRENGTH_NAMES.map((n) => n.toLowerCase())).size).toBe(34)
  })

  it("is in alphabetical order", () => {
    const sorted = [...CLIFTON_STRENGTH_NAMES].sort((a, b) => a.localeCompare(b, "en"))
    expect(CLIFTON_STRENGTH_NAMES).toEqual(sorted)
  })

  it("gives every theme a valid domain with a label", () => {
    for (const strength of CLIFTON_STRENGTHS) {
      expect(STRENGTH_DOMAINS).toContain(strength.domain)
      expect(strengthDomainLabels[strength.domain]).toBeTruthy()
    }
  })

  it("splits the themes into Gallup's four domains (9 / 8 / 9 / 8)", () => {
    const count = (domain: string) => CLIFTON_STRENGTHS.filter((s) => s.domain === domain).length
    expect(count("executing")).toBe(9)
    expect(count("influencing")).toBe(8)
    expect(count("relationship_building")).toBe(9)
    expect(count("strategic_thinking")).toBe(8)
  })

  it.each([
    ["Achiever", "executing"],
    ["Restorative", "executing"],
    ["Woo", "influencing"],
    ["Self-Assurance", "influencing"],
    ["Adaptability", "relationship_building"],
    ["Individualization", "relationship_building"],
    ["Context", "strategic_thinking"],
    ["Strategic", "strategic_thinking"],
  ])("puts %s in %s", (name, domain) => {
    expect(strengthDomain(name)).toBe(domain)
  })
})

describe("canonicalStrength", () => {
  it("accepts any case and surrounding spaces", () => {
    expect(canonicalStrength("woo")).toBe("Woo")
    expect(canonicalStrength("  SELF-ASSURANCE ")).toBe("Self-Assurance")
    expect(canonicalStrength("Learner")).toBe("Learner")
  })

  it("rejects anything that isn't a theme", () => {
    expect(canonicalStrength("")).toBeNull()
    expect(canonicalStrength("Leadership")).toBeNull()
    expect(canonicalStrength("Self Assurance")).toBeNull()
  })
})

describe("strengthDomain", () => {
  it("is null for unknown names", () => {
    expect(strengthDomain("Juggling")).toBeNull()
  })
})
