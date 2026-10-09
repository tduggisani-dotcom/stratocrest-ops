import path from "node:path"
import { defineConfig } from "vitest/config"

const alias = {
  "@": path.resolve(import.meta.dirname, "src"),
  // `server-only` throws outside React Server Components; tests run plain Node.
  "server-only": path.resolve(import.meta.dirname, "tests/support/empty-module.ts"),
}

export default defineConfig({
  resolve: { alias },
  test: {
    projects: [
      {
        resolve: { alias },
        test: {
          name: "unit",
          environment: "node",
          include: ["src/**/*.test.ts", "src/**/*.test.tsx", "scripts/**/*.test.ts"],
        },
      },
      {
        resolve: { alias },
        test: {
          name: "db",
          environment: "node",
          include: ["tests/db/**/*.test.ts"],
          // One shared local database: run files one at a time.
          fileParallelism: false,
          testTimeout: 30_000,
        },
      },
    ],
  },
})
