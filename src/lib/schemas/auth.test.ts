import { describe, expect, it } from "vitest"
import {
  confirmLinkSchema,
  confirmRedirectUrl,
  emailSchema,
  otpCodeSchema,
  parseSignInReason,
  requestCodeSchema,
  safeNextPath,
  verifyCodeSchema,
} from "@/lib/schemas/auth"

const TOKEN_HASH = "a".repeat(56)

function firstMessage(result: { success: boolean; error?: { issues: { message: string }[] } }) {
  return result.error?.issues[0]?.message
}

describe("safeNextPath", () => {
  it.each([
    "/",
    "/tasks",
    "/tasks?view=mine&sort=due",
    "/investors/123#notes",
    "/search?q=a%2F%2Fb",
    "/a//b",
  ])("keeps the same-site path %s", (path) => {
    expect(safeNextPath(path)).toBe(path)
  })

  it.each([
    ["protocol-relative", "//evil.example"],
    ["backslash trick", "/\\evil.example"],
    ["absolute URL", "https://evil.example/tasks"],
    ["javascript URL", "javascript:alert(1)"],
    ["relative without slash", "tasks"],
    ["empty", ""],
    ["leading space", " /tasks"],
    ["tab that browsers strip", "/\t/evil.example"],
    ["newline", "/tasks\nSet-Cookie: x=1"],
    ["too long", `/${"a".repeat(2048)}`],
  ])("replaces a %s value with /", (_label, value) => {
    expect(safeNextPath(value)).toBe("/")
  })

  it.each([undefined, null, 42, ["/tasks"], { path: "/tasks" }])(
    "replaces the non-string %j with /",
    (value) => {
      expect(safeNextPath(value)).toBe("/")
    },
  )
})

describe("emailSchema", () => {
  it("trims and lowercases", () => {
    expect(emailSchema.parse("  Sam.Browning@Example.COM ")).toBe("sam.browning@example.com")
  })

  it("asks for an email when it's blank", () => {
    expect(firstMessage(emailSchema.safeParse("   "))).toBe("Enter your email address.")
    expect(firstMessage(emailSchema.safeParse(null))).toBe("Enter your email address.")
  })

  it.each(["sam", "sam@", "sam@example", "@example.com", "sam example@example.com"])(
    "rejects %s with one clear message",
    (value) => {
      const result = emailSchema.safeParse(value)
      expect(result.success).toBe(false)
      expect(result.error?.issues).toHaveLength(1)
      expect(firstMessage(result)).toBe("Enter a full email address, like name@company.com.")
    },
  )

  it("rejects addresses longer than 254 characters", () => {
    const long = `${"a".repeat(250)}@example.com`
    expect(firstMessage(emailSchema.safeParse(long))).toBe("That email address is too long.")
  })
})

describe("otpCodeSchema", () => {
  it.each([
    ["123456", "123456"],
    [" 123456 ", "123456"],
    ["123 456", "123456"],
    ["123-456", "123456"],
  ])("accepts %j as %s", (input, code) => {
    expect(otpCodeSchema.parse(input)).toBe(code)
  })

  it.each(["", "12345", "1234567", "12345a", "abcdef", "１２３４５６"])("rejects %j", (value) => {
    expect(firstMessage(otpCodeSchema.safeParse(value))).toBe(
      "Enter the 6-digit code from the email.",
    )
  })

  it("rejects a missing code", () => {
    expect(otpCodeSchema.safeParse(null).success).toBe(false)
  })
})

describe("requestCodeSchema / verifyCodeSchema", () => {
  it("normalizes the email and makes next safe", () => {
    expect(requestCodeSchema.parse({ email: "Ian@Example.com", next: "//evil.example" })).toEqual({
      email: "ian@example.com",
      next: "/",
    })
    expect(requestCodeSchema.parse({ email: "ian@example.com", next: null })).toEqual({
      email: "ian@example.com",
      next: "/",
    })
  })

  it("parses a code submission", () => {
    expect(
      verifyCodeSchema.parse({ email: "ian@example.com", code: "654 321", next: "/tasks" }),
    ).toEqual({ email: "ian@example.com", code: "654321", next: "/tasks" })
  })
})

describe("confirmLinkSchema", () => {
  it("accepts the link the email template builds", () => {
    expect(
      confirmLinkSchema.parse({ token_hash: TOKEN_HASH, type: "email", next: "/tasks" }),
    ).toEqual({ token_hash: TOKEN_HASH, type: "email", next: "/tasks" })
  })

  it("accepts a PKCE token hash", () => {
    const tokenHash = `pkce_${TOKEN_HASH}`
    expect(confirmLinkSchema.parse({ token_hash: tokenHash, type: "email" }).token_hash).toBe(
      tokenHash,
    )
  })

  it("defaults next to / when it's missing or unsafe", () => {
    expect(confirmLinkSchema.parse({ token_hash: TOKEN_HASH, type: "email" }).next).toBe("/")
    expect(
      confirmLinkSchema.parse({ token_hash: TOKEN_HASH, type: "email", next: "//evil.example" })
        .next,
    ).toBe("/")
  })

  it.each([
    ["a missing token", { type: "email" }],
    ["an empty token", { token_hash: "", type: "email" }],
    ["a token with odd characters", { token_hash: `${TOKEN_HASH}<script>`, type: "email" }],
    ["a repeated param", { token_hash: [TOKEN_HASH, TOKEN_HASH], type: "email" }],
    ["a missing type", { token_hash: TOKEN_HASH }],
    ["another OTP type", { token_hash: TOKEN_HASH, type: "recovery" }],
  ])("rejects %s", (_label, input) => {
    expect(confirmLinkSchema.safeParse(input).success).toBe(false)
  })
})

describe("confirmRedirectUrl", () => {
  it("always carries ?next= so the template can append &token_hash=", () => {
    expect(confirmRedirectUrl("http://localhost:3000", "/")).toBe(
      "http://localhost:3000/auth/confirm?next=%2F",
    )
  })

  it("encodes next so its own query string survives", () => {
    const url = confirmRedirectUrl("https://ops.example.com/", "/tasks?view=mine&sort=due")
    expect(url).toBe(
      "https://ops.example.com/auth/confirm?next=%2Ftasks%3Fview%3Dmine%26sort%3Ddue",
    )

    // What the confirm page sees after the template appends the token.
    const link = new URL(`${url}&token_hash=${TOKEN_HASH}&type=email`)
    expect(
      confirmLinkSchema.parse({
        token_hash: link.searchParams.get("token_hash"),
        type: link.searchParams.get("type"),
        next: link.searchParams.get("next"),
      }),
    ).toEqual({ token_hash: TOKEN_HASH, type: "email", next: "/tasks?view=mine&sort=due" })
  })

  it("replaces an unsafe next", () => {
    expect(confirmRedirectUrl("http://localhost:3000", "//evil.example")).toBe(
      "http://localhost:3000/auth/confirm?next=%2F",
    )
  })
})

describe("parseSignInReason", () => {
  it("knows the reasons the app sends", () => {
    expect(parseSignInReason("signed-out")).toBe("signed-out")
    expect(parseSignInReason("not-on-team")).toBe("not-on-team")
  })

  it.each([undefined, "", "other", ["signed-out"]])("ignores %j", (value) => {
    expect(parseSignInReason(value)).toBeUndefined()
  })
})
