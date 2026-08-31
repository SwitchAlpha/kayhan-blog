import { defineConfig } from "vitest/config";
import path from "node:path";
import dotenv from "dotenv";

// The DB tests connect to whatever the app connects to. Without this they fell
// back to a hardcoded URL and could quietly run against a different database
// than the one .env points at.
dotenv.config({ path: path.resolve(import.meta.dirname, ".env"), quiet: true });

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
  },
  resolve: { alias: { "@": path.resolve(import.meta.dirname, "src") } },
});
