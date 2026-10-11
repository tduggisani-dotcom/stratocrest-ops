"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/browser"

/** Tables published to Supabase Realtime (migration 20261010001100). */
export type LiveTable =
  | "people"
  | "synthe6_sessions"
  | "objectives"
  | "key_results"
  | "organizations"
  | "org_meetings"
  | "hypotheses"
  | "team_meetings"
  | "meeting_updates"
  | "decisions"
  | "debriefs"
  | "tasks"
  | "action_items"
  | "checklist_items"
  | "candidates"
  | "help_requests"

/**
 * Live updates (spec §7): when a teammate (or the bot) changes one of `tables`,
 * re-render this page from the server. Realtime respects RLS, so only rows the
 * person can read trigger a refresh. Several quick changes cause one refresh.
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
    const supabase = createClient()
    let timer: ReturnType<typeof setTimeout> | undefined
    const refresh = () => {
      clearTimeout(timer)
      timer = setTimeout(() => router.refresh(), debounceMs)
    }
    const channel = supabase.channel(`live:${key}:${crypto.randomUUID()}`)
    for (const table of key.split(",")) {
      channel.on("postgres_changes", { event: "*", schema: "public", table }, refresh)
    }
    channel.subscribe()
    return () => {
      clearTimeout(timer)
      void supabase.removeChannel(channel)
    }
  }, [key, debounceMs, router])

  return null
}
