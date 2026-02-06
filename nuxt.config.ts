// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: "2024-11-01",
  devtools: { enabled: true },

  modules: [
    "@nuxtjs/tailwindcss",
    "@nuxtjs/color-mode",
    "@pinia/nuxt",
    "@vueuse/nuxt",
    "@vee-validate/nuxt",
    "@nuxt/icon",
    "motion-v/nuxt",
    "@nuxt/content",
  ],


  css: ["~/assets/css/main.css"],

  colorMode: {
    classSuffix: "",
    preference: "system",
    fallback: "light",
    storageKey: "nuxt-color-mode",
  },

  tailwindcss: {
    cssPath: "~/assets/css/main.css",
    configPath: "tailwind.config.ts",
  },

  typescript: {
    strict: true,
    typeCheck: true,
  },

  runtimeConfig: {
    public: {
      apiBase: process.env.NUXT_PUBLIC_API_BASE || "http://localhost:8080/api",
      wsBase: process.env.NUXT_PUBLIC_WS_BASE || "ws://localhost:8080",
    },
  },

  app: {
    pageTransition: { name: "page", mode: "out-in" },
    layoutTransition: { name: "layout", mode: "out-in" },
    head: {
      title: "launchctl",
      titleTemplate: "%s - launchctl",
      meta: [
        { charset: "utf-8" },
        { name: "viewport", content: "width=device-width, initial-scale=1" },
      ],
      link: [
        { rel: "icon", type: "image/x-icon", href: "/favicon.ico" },
        { rel: "preconnect", href: "https://fonts.googleapis.com" },
        {
          rel: "preconnect",
          href: "https://fonts.gstatic.com",
          crossorigin: "anonymous",
        },
        {
          rel: "stylesheet",
          href: "https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap",
        },
      ],
    },
  },

  imports: {
    dirs: ["composables/**", "utils/**", "stores/**", "services/**"],
  },

  components: [
    {
      path: "~/components/ui",
      pathPrefix: false,
      ignore: ["**/index.ts"],
    },
    {
      path: "~/components",
      pathPrefix: true,
      ignore: ["ui/**"],
    },
  ],

  hooks: {
    close: () => {
      process.exit(0);
    },
  },

  build: {
    transpile: ["@xterm/xterm", "@xterm/addon-fit"],
  },

  vite: {
    optimizeDeps: {
      include: [
        "radix-vue",
        "class-variance-authority",
        "clsx",
        "tailwind-merge",
      ],
    },
  },
});
