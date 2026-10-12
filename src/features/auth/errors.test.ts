import { describe, expect, it } from "vitest"
import {
  AUTH_MESSAGES,
  isRateLimited,
  sendCodeErrorMessage,
  verifyErrorMessage,
} from "@/features/auth/errors"

describe("isRateLimited", () => {
  it.each([
    { status: 429, code: undefined },
    { status: 429, code: "over_email_send_rate_limit" },
    { status: 400, code: "over_request_rate_limit" },
  ])("is true for %j", (error) => {
    expect(isRateLimited(error)).toBe(true)
  })

  it("is false for other errors", () => {
    expect(isRateLimited({ status: 403, code: "otp_expired" })).toBe(false)
  })
})

describe("sendCodeErrorMessage", () => {
  it("maps rate limits to a wait message", () => {
    expect(sendCodeErrorMessage({ status: 429, code: "over_email_send_rate_limit" })).toBe(
      "Too many attempts. Wait a minute and try again.",
    )
  })

  it.each(["otp_disabled", "signup_disabled", "user_not_found"])(
    "explains a missing login for %s",
    (code) => {
      expect(sendCodeErrorMessage({ status: 422, code })).toBe(AUTH_MESSAGES.noLogin)
    },
  )

  it("points to email setup when Supabase won't email the address", () => {
    expect(sendCodeErrorMessage({ status: 400, code: "email_address_not_authorized" })).toBe(
      AUTH_MESSAGES.emailNotSetUp,
    )
  })

  it("separates our-side failures from Supabase outages", () => {
    expect(sendCodeErrorMessage({ status: 400, code: "validation_failed" })).toBe(
      AUTH_MESSAGES.sendFailed,
    )
    expect(sendCodeErrorMessage({ status: 500, code: "unexpected_failure" })).toBe(
      AUTH_MESSAGES.unavailable,
    )
    expect(sendCodeErrorMessage({ status: undefined, code: undefined })).toBe(
      AUTH_MESSAGES.unavailable,
    )
  })
})

describe("verifyErrorMessage", () => {
  it("explains a wrong or expired code", () => {
    expect(verifyErrorMessage({ status: 403, code: "otp_expired" }, "code")).toBe(
      AUTH_MESSAGES.badCode,
    )
  })

  it("explains an expired or used link", () => {
    expect(verifyErrorMessage({ status: 403, code: "otp_expired" }, "link")).toBe(
      AUTH_MESSAGES.badLink,
    )
  })

  it("maps rate limits and outages", () => {
    expect(verifyErrorMessage({ status: 429, code: "over_request_rate_limit" }, "code")).toBe(
      AUTH_MESSAGES.rateLimited,
    )
    expect(verifyErrorMessage({ status: 502, code: undefined }, "link")).toBe(
      AUTH_MESSAGES.unavailable,
    )
  })
})
