<script setup lang="ts">
const footerLinks = {
  product: [
    { label: 'Features', href: '/#features' },
    { label: 'Pricing', href: '/pricing' },
    { label: 'Changelog', href: '#' },
  ],
  support: [
    { label: 'Documentation', href: '/docs' },
    { label: 'Support Center', href: '/support' },
    { label: 'Status', href: '#' },
    { label: 'Report Vulnerability', href: 'https://forum.gigcodes.com/', external: true },
  ],
  legal: [
    { label: 'Privacy Policy', href: '/legal/privacy' },
    { label: 'Terms of Service', href: '/legal/terms' },
    { label: 'Refund Policy', href: '/legal/refund' },
  ],
}

const socialLinks = [
  { label: 'Twitter', href: 'https://x.com/gigcodes', icon: 'lucide:twitter' },
  { label: 'GitHub', href: 'https://github.com/gigcodes', icon: 'lucide:github' },
  { label: 'Discord', href: '#', icon: 'simple-icons:discord' },
]

const currentYear = new Date().getFullYear()
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
            Deploy and manage your servers with ease. No DevOps expertise required.
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
          <h4 class="mb-4 text-sm font-semibold text-foreground">Product</h4>
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
          <h4 class="mb-4 text-sm font-semibold text-foreground">Support</h4>
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
          <h4 class="mb-4 text-sm font-semibold text-foreground">Legal</h4>
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
      <div class="mt-12 flex flex-col items-center justify-between gap-4 border-t pt-8 md:flex-row">
        <p class="text-sm text-muted-foreground">
          &copy; {{ currentYear }} Gigcodes. All rights reserved.
        </p>
        <div class="flex items-center gap-2 text-sm text-muted-foreground">
          <span class="relative flex h-2 w-2">
            <span class="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span class="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
          </span>
          All systems operational
        </div>
      </div>
    </div>
  </footer>
</template>
