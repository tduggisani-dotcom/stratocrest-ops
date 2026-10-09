/**
 * Applies the saved theme before first paint (no flash of the wrong theme).
 * Pattern from Next 16 docs: guides/preventing-flash-before-hydration.
 * Stored values: "light" | "dark" | "system" (default) in localStorage "theme".
 */
const script = `(function(){try{var t=localStorage.getItem("theme")||"system";var d=t==="dark"||(t==="system"&&window.matchMedia("(prefers-color-scheme: dark)").matches);var r=document.documentElement;r.classList.toggle("dark",d);r.style.colorScheme=d?"dark":"light"}catch(e){}})()`

export function ThemeScript() {
  return <script dangerouslySetInnerHTML={{ __html: script }} />
}
