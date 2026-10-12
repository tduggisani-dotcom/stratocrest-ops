import { DEFAULT_NEXT_PATH } from "@/lib/schemas/auth"

/** Link target for /sign-in that keeps where the person was headed. */
export function signInHref(next: string) {
  return {
    pathname: "/sign-in",
    query: next === DEFAULT_NEXT_PATH ? {} : { next },
  }
}
