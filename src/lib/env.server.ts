import "server-only"
import { z } from "zod"

/** Server-only settings. Never import this from a Client Component. */
const serverEnvSchema = z.object({
  supabaseSecretKey: z.string().min(1, "SUPABASE_SECRET_KEY is missing"),
  appEnv: z.enum(["development", "production"]).default("development"),
})

export type ServerEnv = z.infer<typeof serverEnvSchema>

let cached: ServerEnv | undefined

export function getServerEnv(): ServerEnv {
  cached ??= serverEnvSchema.parse({
    supabaseSecretKey: process.env.SUPABASE_SECRET_KEY,
    appEnv: process.env.APP_ENV || undefined,
  })
  return cached
}
