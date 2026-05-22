import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

// The root tsconfig.json extends ./.nuxt/tsconfig.json. That file only exists
// after `nuxt prepare`, so package.json's `pretest` runs it (and stubs the
// file under whichever name Nuxt produced) before vitest starts. Once that's
// in place vite's normal tsconfig walk works, no tsconfigRaw override needed.
export default defineConfig({
  test: {
    environment: "jsdom",
    globals: true,
    include: ["tests/**/*.{test,spec}.{ts,js}"],
  },
  resolve: {
    alias: {
      "~": fileURLToPath(new URL("./", import.meta.url)),
      "@": fileURLToPath(new URL("./", import.meta.url)),
    },
  },
});
