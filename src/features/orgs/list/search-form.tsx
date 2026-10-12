import Form from "next/form"
import { Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { MAX_QUERY_LENGTH, type OrgFilters } from "../filters"
import { kindConfig, type OrgKind } from "../kind-config"
import { searchHiddenFields } from "./filter-options"

/**
 * Search by name. A GET form (next/form: a client-side navigation) whose
 * hidden fields carry the other filters, the view and the sort in the URL's
 * own format, so a search narrows the current view instead of resetting it.
 */
export function SearchForm({
  kind,
  filters,
  className,
}: {
  kind: OrgKind
  filters: OrgFilters
  className?: string
}) {
  const config = kindConfig(kind)
  const inputId = `org-search-${kind}`
  return (
    <Form
      action={config.basePath}
      scroll={false}
      role="search"
      aria-label={`Search ${config.plural.toLowerCase()}`}
      className={cn("flex min-w-0 gap-2", className)}
    >
      {searchHiddenFields(filters).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <label htmlFor={inputId} className="sr-only">
        Search {config.plural.toLowerCase()} by name
      </label>
      <div className="relative min-w-0 flex-1">
        <Search
          aria-hidden
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          // A new search from elsewhere (e.g. "Clear filters") resets the box.
          key={filters.q}
          id={inputId}
          name="q"
          type="search"
          defaultValue={filters.q}
          maxLength={MAX_QUERY_LENGTH}
          placeholder={`Search ${config.plural.toLowerCase()}`}
          autoComplete="off"
          enterKeyHint="search"
          className="pl-9"
        />
      </div>
      <Button type="submit" variant="outline" size="icon" aria-label="Search">
        <Search aria-hidden />
      </Button>
    </Form>
  )
}
