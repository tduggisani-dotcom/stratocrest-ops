"use client"

import { useCallback, useSyncExternalStore } from "react"

export type ThemePreference = "light" | "dark" | "system"

const STORAGE_KEY = "theme"
const EVENT = "themechange"

function readPreference(): ThemePreference {
  try {
    const value = localStorage.getItem(STORAGE_KEY)
    return value === "light" || value === "dark" ? value : "system"
  } catch {
    return "system"
  }
}

function systemPrefersDark() {
  return window.matchMedia("(prefers-color-scheme: dark)").matches
}

function apply(preference: ThemePreference) {
  const dark = preference === "dark" || (preference === "system" && systemPrefersDark())
  const root = document.documentElement
  root.classList.toggle("dark", dark)
  root.style.colorScheme = dark ? "dark" : "light"
}

function subscribe(onChange: () => void) {
  const media = window.matchMedia("(prefers-color-scheme: dark)")
  const onSystemChange = () => {
    if (readPreference() === "system") apply("system")
    onChange()
  }
  media.addEventListener("change", onSystemChange)
  window.addEventListener(EVENT, onChange)
  window.addEventListener("storage", onChange)
  return () => {
    media.removeEventListener("change", onSystemChange)
    window.removeEventListener(EVENT, onChange)
    window.removeEventListener("storage", onChange)
  }
}

/** Current theme preference plus the theme actually shown, and a setter. */
export function useTheme() {
  const preference = useSyncExternalStore<ThemePreference>(subscribe, readPreference, () => "system")
  const resolved = useSyncExternalStore<"light" | "dark">(
    subscribe,
    () => (document.documentElement.classList.contains("dark") ? "dark" : "light"),
    () => "light",
  )

  const setPreference = useCallback((next: ThemePreference) => {
    try {
      if (next === "system") localStorage.removeItem(STORAGE_KEY)
      else localStorage.setItem(STORAGE_KEY, next)
    } catch {
      // Private mode or storage disabled: still apply for this page view.
    }
    apply(next)
    window.dispatchEvent(new Event(EVENT))
  }, [])

  return { preference, resolved, setPreference }
}
