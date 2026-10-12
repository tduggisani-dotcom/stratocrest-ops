import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { joinedBefore, listenForChanges } from "./live-refresh"

type Status = "SUBSCRIBED" | "CHANNEL_ERROR" | "TIMED_OUT" | "CLOSED"
type Options = Parameters<typeof listenForChanges>[0]

const DEBOUNCE = 400

/** A stand-in Supabase client with one channel: the test reports its join status and changes. */
function fakeSupabase() {
  const onChange: (() => void)[] = []
  let report: (status: Status, error?: Error) => void = () => {}
  const channel = {
    on: vi.fn((_type: string, _filter: object, handler: () => void) => {
      onChange.push(handler)
      return channel
    }),
    subscribe: vi.fn((callback?: typeof report) => {
      if (callback) report = callback
      return channel
    }),
  }
  const supabase = {
    channel: vi.fn(() => channel),
    removeChannel: vi.fn(async () => "ok" as const),
  }
  return {
    supabase: supabase as unknown as Options["supabase"],
    removeChannel: supabase.removeChannel,
    channelOn: channel.on,
    change: () => onChange.forEach((handler) => handler()),
    status: (status: Status, error?: Error) => report(status, error),
  }
}

/** A document whose tab the test hides and shows. */
function fakeDocument() {
  const doc = Object.assign(new EventTarget(), {
    visibilityState: "visible" as DocumentVisibilityState,
  })
  const set = (state: DocumentVisibilityState) => {
    doc.visibilityState = state
    doc.dispatchEvent(new Event("visibilitychange"))
  }
  return { doc, hide: () => set("hidden"), show: () => set("visible") }
}

function setup(joined: { current: boolean } = { current: false }) {
  const client = fakeSupabase()
  const tab = fakeDocument()
  const refresh = vi.fn()
  const stop = listenForChanges({
    supabase: client.supabase,
    tables: ["help_requests", "tasks"],
    refresh,
    debounceMs: DEBOUNCE,
    joined,
    doc: tab.doc,
  })
  const settle = () => vi.advanceTimersByTime(DEBOUNCE)
  return { ...client, ...tab, refresh, stop, settle, joined }
}

beforeEach(() => {
  vi.useFakeTimers()
})
afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe("listenForChanges", () => {
  it("listens to each table and refreshes once after a burst of changes", () => {
    const live = setup()
    expect(live.channelOn.mock.calls.map((call) => call[1])).toEqual([
      { event: "*", schema: "public", table: "help_requests" },
      { event: "*", schema: "public", table: "tasks" },
    ])

    live.change()
    live.change()
    vi.advanceTimersByTime(DEBOUNCE - 1)
    expect(live.refresh).not.toHaveBeenCalled()
    live.settle()
    expect(live.refresh).toHaveBeenCalledTimes(1)
  })

  it("doesn't refresh on the first join, but catches up whenever it joins again", () => {
    const live = setup()
    live.status("SUBSCRIBED")
    live.settle()
    expect(live.refresh).not.toHaveBeenCalled()

    // The connection dropped and Realtime rejoined: changes in between were missed.
    live.status("CHANNEL_ERROR")
    live.status("SUBSCRIBED")
    live.settle()
    expect(live.refresh).toHaveBeenCalledTimes(1)
  })

  it("catches up when a page kept by <Activity> is shown again (a new channel, same page)", () => {
    const first = setup()
    first.status("SUBSCRIBED")
    first.stop() // hidden: its effects are cleaned up
    expect(first.removeChannel).toHaveBeenCalledTimes(1)

    const again = setup(first.joined) // shown: a new channel
    again.status("SUBSCRIBED")
    again.settle()
    expect(again.refresh).toHaveBeenCalledTimes(1)
  })

  it("doesn't refresh a page just opened by a push (a new bfcacheId) on its first join", () => {
    // This Week (visit _b_3_), then Tasks, then This Week again from the nav: a new visit.
    const first = setup(joinedBefore("_b_3_ tasks"))
    first.status("SUBSCRIBED")
    first.stop()

    const pushed = setup(joinedBefore("_b_7_ tasks"))
    pushed.status("SUBSCRIBED")
    pushed.settle()
    expect(pushed.refresh).not.toHaveBeenCalled()
  })

  it("catches up when Back brings a page back from the router's cache as a new instance", () => {
    // Dropped from <Activity> (only the last 3 pages are kept), so the component
    // remounts, but it's the same visit (same bfcacheId) with the old content.
    const first = setup(joinedBefore("_b_11_ people,tasks"))
    first.status("SUBSCRIBED")
    first.stop()

    const back = setup(joinedBefore("_b_11_ people,tasks"))
    back.status("SUBSCRIBED")
    back.settle()
    expect(back.refresh).toHaveBeenCalledTimes(1)

    // The same visit with other tables is another listener, joining for the first time.
    const other = setup(joinedBefore("_b_11_ tasks"))
    other.status("SUBSCRIBED")
    other.settle()
    expect(other.refresh).not.toHaveBeenCalled()
  })

  it("refreshes when the tab is shown again, not when it's hidden", () => {
    const live = setup()
    live.hide()
    live.settle()
    expect(live.refresh).not.toHaveBeenCalled()
    live.show()
    live.settle()
    expect(live.refresh).toHaveBeenCalledTimes(1)
  })

  it("stops everything when cleaned up, including a refresh still waiting", () => {
    const live = setup()
    live.status("SUBSCRIBED")
    live.change()
    live.stop()
    live.hide()
    live.show()
    vi.runAllTimers()
    expect(live.refresh).not.toHaveBeenCalled()
    expect(live.removeChannel).toHaveBeenCalledTimes(1)
  })

  it("warns once per channel while it can't connect, and doesn't refresh for it", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    const live = setup()
    live.status("TIMED_OUT")
    live.status("CHANNEL_ERROR", new Error("socket closed"))
    live.status("CHANNEL_ERROR", new Error("socket closed"))
    live.settle()
    expect(warn).toHaveBeenCalledTimes(1)
    expect(warn.mock.calls[0][0]).toContain("TIMED_OUT")
    expect(live.refresh).not.toHaveBeenCalled()
  })
})
