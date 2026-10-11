/**
 * Plain-language messages for failed database writes. The database enforces the
 * real rules (NOT NULL, CHECK, unique names, RLS); Zod catches most mistakes
 * first, so these are the fallback a person sees if one slips through.
 */
type DbError = { code?: string; message: string; details?: string | null } | null | undefined

export function friendlyDbError(
  error: DbError,
  fallback = "Couldn't save. Please try again.",
): string {
  if (!error) return fallback
  switch (error.code) {
    case "23505":
      return "Something with that name already exists."
    case "23503":
      return "Something this links to no longer exists. Refresh and try again."
    case "23502":
      return "A required field is missing."
    case "23514":
    case "P0001":
      // Our own triggers raise readable sentences ("An objective can have at most 4 key results.").
      // Constraint names ("violates check constraint …") are not for people.
      return /violates check constraint/.test(error.message)
        ? "Something in the form isn't valid. Check the highlighted fields."
        : error.message
    case "42501":
    case "PGRST301":
      return "You don't have access to do that. Try signing in again."
    case "40001":
      return "Someone changed this in the meantime. Refresh to see the latest version."
    default:
      return fallback
  }
}
