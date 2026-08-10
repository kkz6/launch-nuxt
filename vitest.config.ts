import { defineConfig, type UserConfig } from "vitest/config";
import { fileURLToPath } from "node:url";
import vue from "@vitejs/plugin-vue";

export default defineConfig({
  plugins: [vue() as unknown as NonNullable<UserConfig["plugins"]>[number]],
  define: {
    "import.meta.client": true,
    "import.meta.server": false,
  },
  test: {
    environment: "jsdom",
    globals: true,
    include: ["tests/**/*.{test,spec}.{ts,js}"],
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      reportsDirectory: "coverage",
      include: [
        "app.vue",
        "components/**/*.{ts,vue}",
        "composables/**/*.ts",
        "layouts/**/*.vue",
        "middleware/**/*.ts",
        "pages/**/*.vue",
        "plugins/**/*.ts",
        "server/**/*.ts",
        "services/**/*.ts",
        "stores/**/*.ts",
        "utils/**/*.ts",
      ],
      exclude: ["**/*.d.ts", "tests/**"],
    },
  },
  resolve: {
    alias: {
      "~": fileURLToPath(new URL("./", import.meta.url)),
      "@": fileURLToPath(new URL("./", import.meta.url)),
    },
  },
});
