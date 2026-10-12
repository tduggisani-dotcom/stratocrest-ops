import { toast } from "sonner"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { CONNECTION_ERROR } from "@/lib/action-calls"
import { restoreTask, setTaskStatus, undoTaskChange } from "./actions"
import { restoreArchived } from "./archive-buttons"
import { saveTaskStatus, undoTaskStatus } from "./task-status"
import { UNDO_CHANGED_SINCE } from "./undo-messages"

// The client side of the inline status control and archive, without React or a server:
// the Server Actions and the toasts are mocks.
vi.mock("./actions", () => ({
  setTaskStatus: vi.fn(),
  undoTaskChange: vi.fn(),
  archiveTask: vi.fn(),
  restoreTask: vi.fn(),
}))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  // Next's redirect() reaches the client as an error with a NEXT_REDIRECT digest.
  unstable_rethrow(error: unknown) {
    const digest = (error as { digest?: unknown } | null)?.digest
    if (typeof digest === "string" && digest.startsWith("NEXT_REDIRECT")) throw error
  },
}))

const offline = () => Promise.reject(new TypeError("Failed to fetch"))

/** The Undo button of the last success toast. */
function undoButton() {
  const options = vi.mocked(toast.success).mock.lastCall?.[1]
  const action = options?.action
  return action && typeof action === "object" && "onClick" in action ? action : undefined
}

beforeEach(() => vi.spyOn(console, "error").mockImplementation(() => {}))
afterEach(() => vi.resetAllMocks())

describe("saveTaskStatus", () => {
  it("a failed request shows an error toast (and the control snaps back) instead of throwing", async () => {
    vi.mocked(setTaskStatus).mockImplementationOnce(offline)
    await expect(saveTaskStatus("t1", "Send the deck", "done", "to_do")).resolves.toBe(false)
    expect(toast.error).toHaveBeenCalledWith(CONNECTION_ERROR)
    expect(toast.success).not.toHaveBeenCalled()
  })

  it("a refused change shows the server's message", async () => {
    vi.mocked(setTaskStatus).mockResolvedValueOnce({ status: "error", message: "Archived." })
    await expect(saveTaskStatus("t1", "Send the deck", "done", "to_do")).resolves.toBe(false)
    expect(toast.error).toHaveBeenCalledWith("Archived.")
  })

  it("Next's redirect to sign-in still goes through", async () => {
    const redirect = Object.assign(new Error("NEXT_REDIRECT"), {
      digest: "NEXT_REDIRECT;replace;/sign-in;307;",
    })
    vi.mocked(setTaskStatus).mockRejectedValueOnce(redirect)
    await expect(saveTaskStatus("t1", "Send the deck", "done", "to_do")).rejects.toBe(redirect)
  })

  it("confirms with Undo, which reverses the logged change instead of setting a new status", async () => {
    vi.mocked(setTaskStatus).mockResolvedValueOnce({ status: "success", undoId: 42 })
    vi.mocked(undoTaskChange).mockResolvedValueOnce({ status: "success" })

    await expect(saveTaskStatus("t1", "Send the deck", "to_do", "done")).resolves.toBe(true)
    expect(setTaskStatus).toHaveBeenCalledWith("t1", "to_do")
    expect(toast.success).toHaveBeenCalledWith(
      "Marked To Do",
      expect.objectContaining({ description: "Send the deck" }),
    )

    const undo = undoButton()
    expect(undo?.label).toBe("Undo")
    undo?.onClick({} as never)
    await vi.waitFor(() => expect(toast.success).toHaveBeenLastCalledWith("Back to Done"))
    expect(undoTaskChange).toHaveBeenCalledWith(42)
    // Setting "done" again would stamp a new completion time and log a second win.
    expect(setTaskStatus).toHaveBeenCalledTimes(1)
  })

  it("offers no Undo when nothing was logged", async () => {
    vi.mocked(setTaskStatus).mockResolvedValueOnce({ status: "success", undoId: null })
    await saveTaskStatus("t1", "Send the deck", "done", "to_do")
    expect(toast.success).toHaveBeenCalledWith("Marked Done", {
      description: "Send the deck",
      action: undefined,
    })
  })
})

describe("undoTaskStatus", () => {
  it("explains a refused undo (the task changed since)", async () => {
    vi.mocked(undoTaskChange).mockResolvedValueOnce({
      status: "error",
      message: UNDO_CHANGED_SINCE,
    })
    await undoTaskStatus(42, "to_do")
    expect(toast.error).toHaveBeenCalledWith(UNDO_CHANGED_SINCE)
    expect(toast.success).not.toHaveBeenCalled()
  })

  it("a failed request shows an error toast instead of throwing", async () => {
    vi.mocked(undoTaskChange).mockImplementationOnce(offline)
    await expect(undoTaskStatus(42, "to_do")).resolves.toBeUndefined()
    expect(toast.error).toHaveBeenCalledWith(CONNECTION_ERROR)
  })
})

describe("restoreArchived (Restore, and Undo after archiving)", () => {
  it("restores", async () => {
    vi.mocked(restoreTask).mockResolvedValueOnce({ status: "success" })
    await restoreArchived("t1")
    expect(restoreTask).toHaveBeenCalledWith("t1")
    expect(toast.success).toHaveBeenCalledWith("Task restored")
  })

  it("a failed request shows an error toast instead of throwing", async () => {
    vi.mocked(restoreTask).mockImplementationOnce(offline)
    await expect(restoreArchived("t1")).resolves.toBeUndefined()
    expect(toast.error).toHaveBeenCalledWith(CONNECTION_ERROR)
  })
})
