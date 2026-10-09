import { z } from "zod"

/**
 * Public settings (safe in the browser). NEXT_PUBLIC_* values must be read with
 * literal `process.env.X` expressions so Next.js can inline them at build time.
 */
const publicEnvSchema = z.object({
  supabaseUrl: z.url({ error: "NEXT_PUBLIC_SUPABASE_URL must be a URL" }),
  supabasePublishableKey: z.string().min(1, "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY is missing"),
  siteUrl: z.url().optional(),
})

export type PublicEnv = z.infer<typeof publicEnvSchema>

let cached: PublicEnv | undefined

export function getPublicEnv(): PublicEnv {
  cached ??= publicEnvSchema.parse({
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
    supabasePublishableKey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    siteUrl: process.env.NEXT_PUBLIC_SITE_URL || undefined,
  })
  return cached
}
