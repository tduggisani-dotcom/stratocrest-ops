import { describe, expect, it } from "vitest"
import { fieldErrorsFrom } from "@/lib/forms"
import {
  AVATAR_URL_MESSAGE,
  END_DATE_MESSAGE,
  END_TIME_MESSAGE,
  STRENGTH_FIELDS,
  availabilityBlockSchema,
  crunchPeriodSchema,
  isRecordId,
  parseSkills,
  personIdSchema,
  profileFieldName,
  profileFormInput,
  profileSchema,
  removeAvailabilityBlockSchema,
  removeCrunchPeriodSchema,
} from "@/lib/schemas/people"

const PERSON_ID = "9121d9ea-4e09-4197-a954-7f5c2105f1b7"

function errorsOf(result: { success: boolean; error?: Parameters<typeof fieldErrorsFrom>[0] }) {
  expect(result.success).toBe(false)
  return result.error ? fieldErrorsFrom(result.error) : {}
}

const baseProfile = { name: "Sam Browning", role: "CFO" }

describe("profileSchema", () => {
  it("accepts a minimal profile and leaves missing optional fields undefined", () => {
    const result = profileSchema.parse(baseProfile)
    expect(result).toEqual({ name: "Sam Browning", role: "CFO" })
  })

  it("trims name and role and rejects blanks with inline messages", () => {
    expect(profileSchema.parse({ name: "  Sam  ", role: " CFO " })).toMatchObject({
      name: "Sam",
      role: "CFO",
    })
    const errors = errorsOf(profileSchema.safeParse({ name: "   ", role: "" }))
    expect(errors.name).toBe("Enter a name.")
    expect(errors.role).toBe("Enter a role, like CFO or R&D Lead.")
  })

  it("rejects a missing name (a form field that wasn't sent)", () => {
    expect(errorsOf(profileSchema.safeParse({ name: null, role: "CFO" })).name).toBe(
      "Enter a name.",
    )
  })

  it("limits name and role to 120 characters", () => {
    expect(profileSchema.safeParse({ ...baseProfile, name: "a".repeat(120) }).success).toBe(true)
    const errors = errorsOf(
      profileSchema.safeParse({ name: "a".repeat(121), role: "b".repeat(121) }),
    )
    expect(errors.name).toBe("Use 120 characters or fewer.")
    expect(errors.role).toBe("Use 120 characters or fewer.")
  })

  describe("avatar_url", () => {
    it("accepts an https link", () => {
      const url = "https://example.com/photos/sam.png"
      expect(profileSchema.parse({ ...baseProfile, avatar_url: url }).avatar_url).toBe(url)
    })

    it("turns a blank link into null (clears the photo)", () => {
      expect(profileSchema.parse({ ...baseProfile, avatar_url: "   " }).avatar_url).toBeNull()
      expect(profileSchema.parse({ ...baseProfile, avatar_url: null }).avatar_url).toBeNull()
    })

    it.each([
      "http://example.com/sam.png",
      "example.com/sam.png",
      "https://",
      "javascript:alert(1)",
      "HTTPS://example.com/sam.png",
      "ftp://example.com/sam.png",
      "https://exa mple.com/sam.png",
    ])("rejects %s", (url) => {
      expect(
        errorsOf(profileSchema.safeParse({ ...baseProfile, avatar_url: url })).avatar_url,
      ).toBe(AVATAR_URL_MESSAGE)
    })

    it("limits the link to 2048 characters", () => {
      const prefix = "https://example.com/"
      const ok = prefix + "a".repeat(2048 - prefix.length)
      expect(profileSchema.safeParse({ ...baseProfile, avatar_url: ok }).success).toBe(true)
      expect(
        errorsOf(profileSchema.safeParse({ ...baseProfile, avatar_url: ok + "a" })).avatar_url,
      ).toMatch(/too long/)
    })
  })

  describe("contact_preference", () => {
    it("is optional, trimmed, and blank means clear", () => {
      expect(
        profileSchema.parse({ ...baseProfile, contact_preference: "  Text first  " })
          .contact_preference,
      ).toBe("Text first")
      expect(
        profileSchema.parse({ ...baseProfile, contact_preference: "" }).contact_preference,
      ).toBeNull()
    })

    it("allows up to 500 characters", () => {
      expect(
        profileSchema.safeParse({ ...baseProfile, contact_preference: "a".repeat(500) }).success,
      ).toBe(true)
      expect(
        errorsOf(profileSchema.safeParse({ ...baseProfile, contact_preference: "a".repeat(501) }))
          .contact_preference,
      ).toBe("Use 500 characters or fewer.")
    })
  })

  describe("strengths", () => {
    it("keeps rank order, drops empty pickers and fixes letter case", () => {
      const result = profileSchema.parse({
        ...baseProfile,
        strengths: ["", "woo", "Strategic", "", "self-assurance"],
      })
      expect(result.strengths).toEqual(["Woo", "Strategic", "Self-Assurance"])
    })

    it("accepts five distinct themes", () => {
      const five = ["Achiever", "Learner", "Focus", "Relator", "Ideation"]
      expect(profileSchema.parse({ ...baseProfile, strengths: five }).strengths).toEqual(five)
    })

    it("treats all-empty pickers or null as no strengths", () => {
      expect(
        profileSchema.parse({ ...baseProfile, strengths: ["", "", "", "", ""] }).strengths,
      ).toEqual([])
      expect(profileSchema.parse({ ...baseProfile, strengths: null }).strengths).toEqual([])
    })

    it("accepts a single string (one picker)", () => {
      expect(profileSchema.parse({ ...baseProfile, strengths: "Focus" }).strengths).toEqual([
        "Focus",
      ])
    })

    it("points a duplicate at the picker that repeats it", () => {
      const errors = errorsOf(
        profileSchema.safeParse({
          ...baseProfile,
          strengths: ["Achiever", "Focus", "", "achiever", "Focus"],
        }),
      )
      expect(errors["strengths.3"]).toMatch(/Achiever is already picked/)
      expect(errors["strengths.4"]).toMatch(/Focus is already picked/)
      expect(errors["strengths.0"]).toBeUndefined()
      expect(errors["strengths.1"]).toBeUndefined()
    })

    it("rejects names that aren't CliftonStrengths themes", () => {
      const errors = errorsOf(
        profileSchema.safeParse({ ...baseProfile, strengths: ["Achiever", "Leadership"] }),
      )
      expect(errors["strengths.1"]).toBe("Pick a strength from the list.")
    })

    it("rejects more than five", () => {
      const errors = errorsOf(
        profileSchema.safeParse({
          ...baseProfile,
          strengths: ["Achiever", "Learner", "Focus", "Relator", "Ideation", "Woo"],
        }),
      )
      expect(errors.strengths).toBe("Pick at most 5 strengths.")
    })

    it("rejects non-string entries", () => {
      expect(profileSchema.safeParse({ ...baseProfile, strengths: [42] }).success).toBe(false)
      expect(profileSchema.safeParse({ ...baseProfile, strengths: { a: 1 } }).success).toBe(false)
    })
  })

  describe("skills", () => {
    it("splits comma-separated text into trimmed, unique items", () => {
      expect(
        profileSchema.parse({
          ...baseProfile,
          skills: " CAD,  grant writing , ,cad, Python,python ,\nExcel ",
        }).skills,
      ).toEqual(["CAD", "grant writing", "Python", "Excel"])
    })

    it("accepts a list too (the bot API)", () => {
      expect(
        profileSchema.parse({ ...baseProfile, skills: ["CAD", " CAD ", "SQL"] }).skills,
      ).toEqual(["CAD", "SQL"])
    })

    it("treats blank text or null as no skills", () => {
      expect(profileSchema.parse({ ...baseProfile, skills: "  , , " }).skills).toEqual([])
      expect(profileSchema.parse({ ...baseProfile, skills: null }).skills).toEqual([])
    })

    it("limits each skill to 60 characters", () => {
      expect(profileSchema.safeParse({ ...baseProfile, skills: "a".repeat(60) }).success).toBe(true)
      expect(
        errorsOf(profileSchema.safeParse({ ...baseProfile, skills: `CAD, ${"a".repeat(61)}` }))
          .skills,
      ).toMatch(/60 characters or fewer/)
    })

    it("allows at most 30 skills", () => {
      const thirty = Array.from({ length: 30 }, (_, i) => `skill ${i}`)
      expect(
        profileSchema.parse({ ...baseProfile, skills: thirty.join(", ") }).skills,
      ).toHaveLength(30)
      expect(
        errorsOf(profileSchema.safeParse({ ...baseProfile, skills: [...thirty, "one more"] }))
          .skills,
      ).toBe("List at most 30 skills (this has 31).")
    })
  })
})

describe("parseSkills", () => {
  it("collapses inner whitespace and keeps the first spelling", () => {
    expect(parseSkills("Grant   writing, grant writing, GRANT WRITING")).toEqual(["Grant writing"])
  })
})

describe("profileFormInput", () => {
  it("collects the five strength pickers in order", () => {
    const form = new FormData()
    form.set("name", "Sam")
    form.set("role", "CFO")
    form.set("avatar_url", "")
    form.set("contact_preference", "Email")
    form.set("skills", "Excel")
    form.set(STRENGTH_FIELDS[0]!, "Focus")
    form.set(STRENGTH_FIELDS[2]!, "Woo")
    const input = profileFormInput(form)
    expect(input.strengths).toEqual(["Focus", "", "Woo", "", ""])
    expect(profileSchema.parse(input)).toEqual({
      name: "Sam",
      role: "CFO",
      avatar_url: null,
      contact_preference: "Email",
      strengths: ["Focus", "Woo"],
      skills: ["Excel"],
    })
  })

  it("has one field per rank", () => {
    expect(STRENGTH_FIELDS).toEqual([
      "strength_1",
      "strength_2",
      "strength_3",
      "strength_4",
      "strength_5",
    ])
  })
})

describe("profileFieldName", () => {
  it("maps strength errors to their picker", () => {
    expect(profileFieldName("strengths.0")).toBe("strength_1")
    expect(profileFieldName("strengths.4")).toBe("strength_5")
    expect(profileFieldName("strengths")).toBe("strength_1")
    expect(profileFieldName("strengths.9")).toBe("strength_1")
  })

  it("leaves other fields as they are", () => {
    expect(profileFieldName("name")).toBe("name")
    expect(profileFieldName("avatar_url")).toBe("avatar_url")
  })
})

describe("availabilityBlockSchema", () => {
  const block = {
    person_id: PERSON_ID,
    weekday: "1",
    start_time: "09:00",
    end_time: "12:00",
    label: "class",
    note: "",
  }

  it("parses form values", () => {
    expect(availabilityBlockSchema.parse(block)).toEqual({
      person_id: PERSON_ID,
      weekday: 1,
      start_time: "09:00",
      end_time: "12:00",
      label: "class",
      note: null,
    })
  })

  it("accepts HH:MM:SS (what the database returns) and stores HH:MM", () => {
    expect(
      availabilityBlockSchema.parse({ ...block, start_time: "09:00:00", end_time: "17:30:00" }),
    ).toMatchObject({ start_time: "09:00", end_time: "17:30" })
  })

  it.each(["0", "8", "", "1.5", "monday"])("rejects weekday %j", (weekday) => {
    expect(errorsOf(availabilityBlockSchema.safeParse({ ...block, weekday })).weekday).toBe(
      "Choose a day of the week.",
    )
  })

  it("accepts every ISO weekday 1-7", () => {
    for (let day = 1; day <= 7; day++) {
      expect(availabilityBlockSchema.parse({ ...block, weekday: day }).weekday).toBe(day)
    }
  })

  it.each(["9:00", "24:00", "12:60", "noon", "09:00 AM"])("rejects time %j", (time) => {
    expect(
      errorsOf(availabilityBlockSchema.safeParse({ ...block, start_time: time })).start_time,
    ).toBe("Enter a time like 9:00 AM.")
  })

  it("requires both times", () => {
    const errors = errorsOf(
      availabilityBlockSchema.safeParse({ ...block, start_time: "", end_time: null }),
    )
    expect(errors.start_time).toBe("Enter a start time.")
    expect(errors.end_time).toBe("Enter an end time.")
  })

  it("requires the end after the start", () => {
    expect(
      errorsOf(
        availabilityBlockSchema.safeParse({ ...block, start_time: "12:00", end_time: "12:00" }),
      ).end_time,
    ).toBe(END_TIME_MESSAGE)
    expect(
      errorsOf(
        availabilityBlockSchema.safeParse({ ...block, start_time: "13:00", end_time: "09:00" }),
      ).end_time,
    ).toBe(END_TIME_MESSAGE)
  })

  it("reports the time order together with other field errors", () => {
    const errors = errorsOf(
      availabilityBlockSchema.safeParse({
        ...block,
        label: "",
        start_time: "13:00",
        end_time: "09:00",
      }),
    )
    expect(errors.label).toBe("Choose class, work, or other.")
    expect(errors.end_time).toBe(END_TIME_MESSAGE)
  })

  it("only accepts the availability labels", () => {
    for (const label of ["class", "work", "other"]) {
      expect(availabilityBlockSchema.safeParse({ ...block, label }).success).toBe(true)
    }
    expect(errorsOf(availabilityBlockSchema.safeParse({ ...block, label: "gym" })).label).toBe(
      "Choose class, work, or other.",
    )
  })

  it("limits the note to 200 characters", () => {
    expect(availabilityBlockSchema.parse({ ...block, note: " ECON 101 " }).note).toBe("ECON 101")
    expect(availabilityBlockSchema.safeParse({ ...block, note: "a".repeat(200) }).success).toBe(
      true,
    )
    expect(
      errorsOf(availabilityBlockSchema.safeParse({ ...block, note: "a".repeat(201) })).note,
    ).toBe("Use 200 characters or fewer.")
  })

  it("requires a person id", () => {
    expect(
      errorsOf(availabilityBlockSchema.safeParse({ ...block, person_id: "sam" })).person_id,
    ).toBe("Choose a teammate.")
  })
})

describe("crunchPeriodSchema", () => {
  const period = {
    person_id: PERSON_ID,
    label: "Finals",
    start_date: "2026-12-07",
    end_date: "2026-12-18",
  }

  it("parses a period", () => {
    expect(crunchPeriodSchema.parse({ ...period, label: "  Finals " })).toEqual(period)
  })

  it("allows a one-day period", () => {
    expect(crunchPeriodSchema.safeParse({ ...period, end_date: "2026-12-07" }).success).toBe(true)
  })

  it("rejects an end before the start", () => {
    expect(
      errorsOf(crunchPeriodSchema.safeParse({ ...period, end_date: "2026-12-06" })).end_date,
    ).toBe(END_DATE_MESSAGE)
  })

  it("requires a label of at most 120 characters", () => {
    expect(errorsOf(crunchPeriodSchema.safeParse({ ...period, label: " " })).label).toBe(
      "Name the crunch period, like Finals.",
    )
    expect(
      errorsOf(crunchPeriodSchema.safeParse({ ...period, label: "a".repeat(121) })).label,
    ).toBe("Use 120 characters or fewer.")
  })

  it("requires real calendar days", () => {
    const errors = errorsOf(
      crunchPeriodSchema.safeParse({ ...period, start_date: "", end_date: "2026-02-30" }),
    )
    expect(errors.start_date).toBe("Enter the first day.")
    expect(errors.end_date).toBe("Enter a date like 2026-12-07.")
  })

  it("reports the date order together with other field errors", () => {
    const errors = errorsOf(
      crunchPeriodSchema.safeParse({ ...period, label: "", end_date: "2026-12-01" }),
    )
    expect(errors.label).toBeDefined()
    expect(errors.end_date).toBe(END_DATE_MESSAGE)
  })
})

describe("ids", () => {
  it("accepts any Postgres-style uuid", () => {
    expect(isRecordId(PERSON_ID)).toBe(true)
    expect(isRecordId("00000000-0000-0000-0000-000000000001")).toBe(true)
    expect(personIdSchema.safeParse(PERSON_ID.toUpperCase()).success).toBe(true)
  })

  it("rejects anything else", () => {
    expect(isRecordId("sam")).toBe(false)
    expect(isRecordId("")).toBe(false)
    expect(isRecordId(undefined)).toBe(false)
    expect(isRecordId(`${PERSON_ID}x`)).toBe(false)
  })

  it("remove schemas take an id", () => {
    expect(removeAvailabilityBlockSchema.parse({ id: PERSON_ID })).toEqual({ id: PERSON_ID })
    expect(removeCrunchPeriodSchema.safeParse({ id: "nope" }).success).toBe(false)
    expect(errorsOf(removeCrunchPeriodSchema.safeParse({})).id).toMatch(/no longer exists/)
  })
})
