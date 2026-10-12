"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/browser"

/**
 * Tables published to Supabase Realtime (migrations 20261010001100,
 * 20261011000300 and 20261012000100). tests/db/reference-data.test.ts checks this list against
 * the database's publication.
 */
export const PUBLISHED_TABLES = [
  "people",
  "availability_blocks",
  "crunch_periods",
  "synthe6_sessions",
  "objectives",
  "key_results",
  "organizations",
  "org_meetings",
  "org_meeting_attendees",
  "hypotheses",
  "hypothesis_tests",
  "team_meetings",
  "meeting_updates",
  "decisions",
  "debriefs",
  "tasks",
  "action_items",
  "checklist_items",
  "candidates",
  "help_requests",
] as const

export type LiveTable = (typeof PUBLISHED_TABLES)[number]

type BrowserClient = ReturnType<typeof createClient>

/** The part of `document` that says when the tab is shown again. */
type VisibilitySource = {
  readonly visibilityState: DocumentVisibilityState
  addEventListener(type: "visibilitychange", listener: () => void): void
  removeEventListener(type: "visibilitychange", listener: () => void): void
}

/**
 * Listens on one Realtime channel for changes to `tables` and calls `refresh`
 * once they settle (`debounceMs` after the last one). Realtime doesn't replay
 * changes made while a channel was down, so it also catches up (one refresh)
 * when the channel joins again, after a dropped connection or when a page
 * kept by <Activity> is shown again, and when the tab becomes visible.
 * `joined` says whether this page has joined before (see `joinedBefore`): its
 * very first join has nothing to catch up on. Returns the cleanup.
 */
export function listenForChanges({
  supabase,
  tables,
  refresh,
  debounceMs,
  joined,
  doc = document,
}: {
  supabase: Pick<BrowserClient, "channel" | "removeChannel">
  tables: readonly string[]
  refresh: () => void
  debounceMs: number
  joined: { current: boolean }
  doc?: VisibilitySource
}): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined
  const refreshSoon = () => {
    clearTimeout(timer)
    timer = setTimeout(refresh, debounceMs)
  }

  const channel = supabase.channel(`live:${tables.join(",")}:${crypto.randomUUID()}`)
  for (const table of tables) {
    channel.on("postgres_changes", { event: "*", schema: "public", table }, refreshSoon)
  }
  let warned = false
  channel.subscribe((status, error) => {
    if (status === "SUBSCRIBED") {
      if (joined.current) refreshSoon()
      joined.current = true
    } else if ((status === "CHANNEL_ERROR" || status === "TIMED_OUT") && !warned) {
      // Realtime keeps retrying by itself, so one note per channel is enough.
      warned = true
      console.warn(
        `Live updates paused (${status}); they resume when the connection is back.`,
        error,
      )
    }
  })

  const onVisibilityChange = () => {
    if (doc.visibilityState === "visible") refreshSoon()
  }
  doc.addEventListener("visibilitychange", onVisibilityChange)

  return () => {
    doc.removeEventListener("visibilitychange", onVisibilityChange)
    clearTimeout(timer)
    void supabase.removeChannel(channel)
  }
}

// The pages (route segment visit + tables) whose channel has joined in this tab.
const joinedPages = new Set<string>()

/**
 * Whether the page `pageKey` has joined before, kept outside React so it
 * survives the page being hidden by <Activity> or dropped from it.
 */
export function joinedBefore(pageKey: string): { current: boolean } {
  return {
    get current() {
      return joinedPages.has(pageKey)
    },
    set current(value: boolean) {
      if (value) joinedPages.add(pageKey)
      else joinedPages.delete(pageKey)
    },
  }
}

/**
 * Live updates (spec §7): when a teammate (or the bot) changes one of `tables`,
 * re-render this page from the server. Realtime respects RLS, so only rows the
 * person can read trigger a refresh. Several quick changes cause one refresh,
 * and the page catches up after any gap (see `listenForChanges`).
 */
export function LiveRefresh({
  tables,
  debounceMs = 400,
}: {
  tables: readonly LiveTable[]
  debounceMs?: number
}) {
  const router = useRouter()
  const key = [...tables].sort().join(",")

  useEffect(() => {
    if (!key) return
    return listenForChanges({
      supabase: createClient(),
      tables: key.split(","),
      refresh: () => router.refresh(),
      debounceMs,
      // bfcacheId names this visit of the page: the same on Back/Forward (the
      // page comes from the router's cache, as it was, so it must catch up)
      // and new on a push (the page was just fetched, so it needn't). A ref
      // wouldn't do: a page shown by a push keeps its <Activity> state, and
      // one dropped from <Activity> comes back from the cache with a new ref.
      joined: joinedBefore(`${router.bfcacheId} ${key}`),
    })
  }, [key, debounceMs, router])

  return null
}
