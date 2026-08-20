<script setup lang="ts">
const { t, locale } = useI18n();

const footerLinks = computed(() => ({
  product: [
    { label: t("public.footer.features"), href: "/#features" },
    { label: t("public.navigation.pricing"), href: "/pricing" },
    { label: t("public.footer.changelog"), href: "#" },
  ],
  support: [
    { label: t("public.footer.documentation"), href: "/docs" },
    { label: t("public.footer.supportCenter"), href: "/support" },
    { label: t("public.footer.status"), href: "#" },
    {
      label: t("public.footer.reportVulnerability"),
      href: "https://forum.gigcodes.com/",
      external: true,
    },
  ],
  legal: [
    { label: t("public.footer.privacy"), href: "/legal/privacy" },
    { label: t("public.footer.terms"), href: "/legal/terms" },
    { label: t("public.footer.refund"), href: "/legal/refund" },
  ],
}));

const socialLinks = [
  { label: "Twitter", href: "https://x.com/gigcodes", icon: "lucide:twitter" },
  {
    label: "GitHub",
    href: "https://github.com/gigcodes",
    icon: "lucide:github",
  },
  { label: "Discord", href: "#", icon: "simple-icons:discord" },
];

const currentYear = new Date().getFullYear();
const formattedYear = computed(() =>
  new Intl.NumberFormat(locale.value === "ja" ? "ja-JP" : "en-US", {
    useGrouping: false,
  }).format(currentYear),
);
</script>

<template>
  <footer class="border-t bg-background">
    <div class="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <div class="grid grid-cols-2 gap-8 md:grid-cols-4 lg:grid-cols-5">
        <!-- Brand -->
        <div class="col-span-2 lg:col-span-2">
          <NuxtLink to="/" class="mb-4 inline-block">
            <span class="text-xl font-bold text-foreground">launchctl</span>
          </NuxtLink>
          <p class="mb-6 max-w-xs text-sm text-muted-foreground">
            {{ t("public.footer.description") }}
          </p>
          <div class="flex items-center gap-2">
            <a
              v-for="social in socialLinks"
              :key="social.label"
              :href="social.href"
              target="_blank"
              rel="noopener noreferrer"
              class="flex h-9 w-9 items-center justify-center rounded-lg border bg-background text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              :aria-label="social.label"
            >
              <Icon :name="social.icon" class="h-4 w-4" />
            </a>
          </div>
        </div>

        <!-- Product -->
        <div>
          <h4 class="mb-4 text-sm font-semibold text-foreground">
            {{ t("public.footer.product") }}
          </h4>
          <ul class="space-y-3">
            <li v-for="link in footerLinks.product" :key="link.label">
              <NuxtLink
                :to="link.href"
                class="text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                {{ link.label }}
              </NuxtLink>
            </li>
          </ul>
        </div>

        <!-- Support -->
        <div>
          <h4 class="mb-4 text-sm font-semibold text-foreground">
            {{ t("public.footer.support") }}
          </h4>
          <ul class="space-y-3">
            <li v-for="link in footerLinks.support" :key="link.label">
              <a
                v-if="link.external"
                :href="link.href"
                target="_blank"
                rel="noopener noreferrer"
                class="text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                {{ link.label }}
              </a>
              <NuxtLink
                v-else
                :to="link.href"
                class="text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                {{ link.label }}
              </NuxtLink>
            </li>
          </ul>
        </div>

        <!-- Legal -->
        <div>
          <h4 class="mb-4 text-sm font-semibold text-foreground">
            {{ t("public.footer.legal") }}
          </h4>
          <ul class="space-y-3">
            <li v-for="link in footerLinks.legal" :key="link.label">
              <NuxtLink
                :to="link.href"
                class="text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                {{ link.label }}
              </NuxtLink>
            </li>
          </ul>
        </div>
      </div>

      <!-- Bottom bar -->
      <div
        class="mt-12 flex flex-col items-center justify-between gap-4 border-t pt-8 md:flex-row"
      >
        <p class="text-sm text-muted-foreground">
          {{ t("public.footer.copyright", { year: formattedYear }) }}
        </p>
        <div class="flex items-center gap-2 text-sm text-muted-foreground">
          <span class="relative flex h-2 w-2">
            <span
              class="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"
            />
            <span
              class="relative inline-flex h-2 w-2 rounded-full bg-emerald-500"
            />
          </span>
          {{ t("public.footer.operational") }}
        </div>
      </div>
    </div>
  </footer>
</template>
