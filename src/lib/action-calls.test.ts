import { afterEach, describe, expect, test, vi } from "vitest"
import { CONNECTION_ERROR, callAction, withConnectionErrors } from "./action-calls"
import type { FormState } from "./forms"

// Next's redirect() reaches the client as an error with a NEXT_REDIRECT digest.
vi.mock("next/navigation", () => ({
  unstable_rethrow(error: unknown) {
    const digest = (error as { digest?: unknown } | null)?.digest
    if (typeof digest === "string" && digest.startsWith("NEXT_REDIRECT")) throw error
  },
}))

const redirectError = Object.assign(new Error("NEXT_REDIRECT"), {
  digest: "NEXT_REDIRECT;replace;/sign-in;307;",
})

afterEach(() => vi.restoreAllMocks())

describe("callAction", () => {
  test("returns the action's result", async () => {
    await expect(
      callAction(async () => ({ status: "success" }), { status: "error" }),
    ).resolves.toEqual({ status: "success" })
  })

  test("a failed request returns the fallback instead of throwing", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {})
    const result = await callAction(async () => {
      throw new TypeError("Failed to fetch")
    }, "fallback")
    expect(result).toBe("fallback")
  })

  test("Next's redirects still go through", async () => {
    await expect(
      callAction(async () => {
        throw redirectError
      }, "fallback"),
    ).rejects.toBe(redirectError)
  })
})

describe("withConnectionErrors", () => {
  test("a failed submit returns an error state with what was typed", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {})
    const action = withConnectionErrors<FormState>(async () => {
      throw new TypeError("Failed to fetch")
    })
    const formData = new FormData()
    formData.set("title", "Email Jane the deck")
    formData.set("notes", "")

    const state = await action({ status: "idle" }, formData)

    expect(state).toMatchObject({
      status: "error",
      message: CONNECTION_ERROR,
      fieldErrors: {},
      values: { title: "Email Jane the deck", notes: "" },
    })
  })

  test("passes the action's own result through", async () => {
    const action = withConnectionErrors<FormState>(async (_previous, formData) => ({
      status: "success",
      id: String(formData.get("id")),
    }))
    const formData = new FormData()
    formData.set("id", "abc")
    await expect(action({ status: "idle" }, formData)).resolves.toEqual({
      status: "success",
      id: "abc",
    })
  })
})
