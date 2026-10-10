import { describe, expect, it } from "vitest"
import { firstNameOf, initialsOf } from "./person-chip"

describe("initialsOf", () => {
  it("uses the first and last name", () => {
    expect(initialsOf("John LaRocco")).toBe("JL")
    expect(initialsOf("Mary Ann van der Berg")).toBe("MB")
  })

  it("handles a single name and extra spaces", () => {
    expect(initialsOf("Tanush")).toBe("T")
    expect(initialsOf("  taeyoon   eom ")).toBe("TE")
  })

  it("never returns an empty avatar", () => {
    expect(initialsOf("   ")).toBe("?")
  })
})

describe("firstNameOf", () => {
  it("returns the first word", () => {
    expect(firstNameOf("Sam Browning")).toBe("Sam")
    expect(firstNameOf(" Tanush ")).toBe("Tanush")
  })
})
