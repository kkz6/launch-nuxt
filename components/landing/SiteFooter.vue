<script setup lang="ts">
const footerLinks = {
  product: [
    { label: 'Features', href: '/#features' },
    { label: 'Integrations', href: '/integrations' },
    { label: 'Pricing', href: '/pricing' },
    { label: 'Changelog', href: '#' },
  ],
  support: [
    { label: 'Documentation', href: '/support' },
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
  {
    label: 'Twitter',
    href: 'https://x.com/gigcodes',
    icon: 'M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z',
  },
  {
    label: 'GitHub',
    href: 'https://github.com/gigcodes',
    icon: 'M12 2C6.477 2 2 6.477 2 12c0 4.42 2.87 8.17 6.84 9.5.5.08.66-.23.66-.5v-1.69c-2.77.6-3.36-1.34-3.36-1.34-.46-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.87 1.52 2.34 1.07 2.91.83.09-.65.35-1.09.63-1.34-2.22-.25-4.55-1.11-4.55-4.92 0-1.11.38-2 1.03-2.71-.1-.25-.45-1.29.1-2.64 0 0 .84-.27 2.75 1.02.79-.22 1.65-.33 2.5-.33.85 0 1.71.11 2.5.33 1.91-1.29 2.75-1.02 2.75-1.02.55 1.35.2 2.39.1 2.64.65.71 1.03 1.6 1.03 2.71 0 3.82-2.34 4.66-4.57 4.91.36.31.69.92.69 1.85V21c0 .27.16.59.67.5C19.14 20.16 22 16.42 22 12A10 10 0 0012 2z',
  },
  {
    label: 'Discord',
    href: '#',
    icon: 'M20.317 4.37a19.791 19.791 0 00-4.885-1.515.074.074 0 00-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 00-5.487 0 12.64 12.64 0 00-.617-1.25.077.077 0 00-.079-.037A19.736 19.736 0 003.677 4.37a.07.07 0 00-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 00.031.057 19.9 19.9 0 005.993 3.03.078.078 0 00.084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 00-.041-.106 13.107 13.107 0 01-1.872-.892.077.077 0 01-.008-.128 10.2 10.2 0 00.372-.292.074.074 0 01.077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 01.078.01c.12.098.246.198.373.292a.077.077 0 01-.006.127 12.299 12.299 0 01-1.873.892.077.077 0 00-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 00.084.028 19.839 19.839 0 006.002-3.03.077.077 0 00.032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 00-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z',
  },
]

const currentYear = new Date().getFullYear()
</script>

<template>
  <footer class="relative border-t border-[hsl(var(--site-border))] bg-[hsl(var(--site-bg))]">
    <div class="site-grid-pattern absolute inset-0 opacity-30" />

    <div class="site-container relative py-12">
      <div class="grid grid-cols-2 gap-6 md:grid-cols-4 lg:grid-cols-5 lg:gap-10">
        <div class="col-span-2 lg:col-span-2">
          <NuxtLink to="/" class="mb-4 inline-block text-[hsl(var(--site-text))]">
            <img src="/images/logo.svg" alt="Launch" width="80" class="h-8" />
          </NuxtLink>
          <p class="mb-5 max-w-xs font-mono text-xs text-[hsl(var(--site-text-muted))]">
            Deploy and manage your applications with ease. No DevOps expertise required.
          </p>
          <div class="flex items-center gap-2">
            <a
              v-for="social in socialLinks"
              :key="social.label"
              :href="social.href"
              target="_blank"
              rel="noopener noreferrer"
              class="flex h-9 w-9 items-center justify-center rounded-lg border border-[hsl(var(--site-border))] bg-[hsl(var(--site-text))]/5 text-[hsl(var(--site-text-muted))] transition-all hover:border-[hsl(var(--site-text))]/20 hover:bg-[hsl(var(--site-text))]/10 hover:text-[hsl(var(--site-text))]"
              :aria-label="social.label"
            >
              <svg class="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                <path :d="social.icon" />
              </svg>
            </a>
          </div>
        </div>

        <div>
          <h4 class="mb-3 font-mono text-xs font-medium text-[hsl(var(--site-text))]">Product</h4>
          <ul class="space-y-2">
            <li v-for="link in footerLinks.product" :key="link.label">
              <NuxtLink
                :to="link.href"
                class="text-xs text-[hsl(var(--site-text-muted))] transition-colors hover:text-[hsl(var(--site-text))]"
              >
                {{ link.label }}
              </NuxtLink>
            </li>
          </ul>
        </div>

        <div>
          <h4 class="mb-3 font-mono text-xs font-medium text-[hsl(var(--site-text))]">Support</h4>
          <ul class="space-y-2">
            <li v-for="link in footerLinks.support" :key="link.label">
              <a
                v-if="link.external"
                :href="link.href"
                target="_blank"
                rel="noopener noreferrer"
                class="text-xs text-[hsl(var(--site-text-muted))] transition-colors hover:text-[hsl(var(--site-text))]"
              >
                {{ link.label }}
              </a>
              <NuxtLink
                v-else
                :to="link.href"
                class="text-xs text-[hsl(var(--site-text-muted))] transition-colors hover:text-[hsl(var(--site-text))]"
              >
                {{ link.label }}
              </NuxtLink>
            </li>
          </ul>
        </div>

        <div>
          <h4 class="mb-3 font-mono text-xs font-medium text-[hsl(var(--site-text))]">Legal</h4>
          <ul class="space-y-2">
            <li v-for="link in footerLinks.legal" :key="link.label">
              <NuxtLink
                :to="link.href"
                class="text-xs text-[hsl(var(--site-text-muted))] transition-colors hover:text-[hsl(var(--site-text))]"
              >
                {{ link.label }}
              </NuxtLink>
            </li>
          </ul>
        </div>
      </div>

      <div
        class="mt-10 flex flex-col items-center justify-between gap-3 border-t border-[hsl(var(--site-border))] pt-6 md:flex-row"
      >
        <p class="font-mono text-[10px] text-[hsl(var(--site-text-muted))]">
          © {{ currentYear }} Gigcodes. All rights reserved.
        </p>
        <div class="flex items-center gap-4">
          <span class="flex items-center gap-1.5 font-mono text-[10px] text-[hsl(var(--site-text-muted))]">
            <span class="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
            All systems operational
          </span>
        </div>
      </div>
    </div>

    <div
      class="pointer-events-none absolute bottom-0 left-1/2 h-[150px] w-[400px] -translate-x-1/2 translate-y-1/2 bg-emerald-500/10 blur-[80px]"
    />
  </footer>
</template>
