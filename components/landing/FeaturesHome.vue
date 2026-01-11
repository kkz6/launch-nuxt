<script setup lang="ts">
const steps = [
  {
    step: '01',
    title: 'Connect Your Server',
    description: 'Link your cloud provider or bring your own server.',
  },
  {
    step: '02',
    title: 'Configure Your App',
    description: 'Connect Git repository and set environment variables.',
  },
  {
    step: '03',
    title: 'Deploy & Scale',
    description: 'Push to deploy. Scale with a single click.',
  },
]
</script>

<template>
  <section class="site-section bg-[hsl(var(--site-bg))] py-20">
    <div class="site-grid-pattern absolute inset-0" />
    <div
      class="site-glow bottom-0 right-0 h-[400px] w-[400px] translate-x-1/2 translate-y-1/2 bg-violet-500 opacity-15"
    />

    <div class="site-container relative">
      <div class="grid items-center gap-12 lg:grid-cols-2">
        <div data-aos="fade-right">
          <div
            class="mb-5 inline-flex items-center gap-2 rounded border border-[hsl(var(--site-border))] bg-[hsl(var(--site-text))]/5 px-3 py-1 font-mono text-xs text-[hsl(var(--site-text-muted))]"
          >
            <span class="h-1.5 w-1.5 rounded-full bg-cyan-400" />
            how it works
          </div>
          <h2 class="font-site mb-4 text-2xl font-bold text-[hsl(var(--site-text))] md:text-3xl">
            Deploy in <span class="text-emerald-400">Three Steps</span>
          </h2>
          <p class="mb-8 text-sm text-[hsl(var(--site-text-muted))]">
            No complex configurations. No DevOps expertise required. Just connect, configure, and deploy.
          </p>

          <div class="space-y-6">
            <div
              v-for="(item, index) in steps"
              :key="item.step"
              class="group flex gap-4"
              data-aos="fade-up"
              :data-aos-delay="index * 100"
            >
              <div
                class="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg border border-[hsl(var(--site-border))] bg-emerald-500/10 font-mono text-xs font-bold text-emerald-400 transition-colors group-hover:border-emerald-500/30"
              >
                {{ item.step }}
              </div>
              <div>
                <h3 class="font-site mb-1 text-sm font-semibold text-[hsl(var(--site-text))]">
                  {{ item.title }}
                </h3>
                <p class="text-xs text-[hsl(var(--site-text-muted))]">
                  {{ item.description }}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div class="relative" data-aos="fade-left">
          <div class="absolute inset-0 rounded-lg bg-emerald-500/5 blur-3xl" />

          <div class="site-card relative overflow-hidden rounded-lg">
            <div class="space-y-4 p-5">
              <div class="flex items-center gap-3">
                <div class="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/20">
                  <svg
                    class="h-5 w-5 text-emerald-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      :stroke-width="1.5"
                      d="M5 12h14M12 5l7 7-7 7"
                    />
                  </svg>
                </div>
                <div>
                  <div class="font-mono text-sm font-medium text-[hsl(var(--site-text))]">my-app</div>
                  <div class="font-mono text-xs text-[hsl(var(--site-text-muted))]">production</div>
                </div>
                <div class="ml-auto">
                  <span
                    class="inline-flex items-center gap-1.5 rounded bg-emerald-500/20 px-2 py-0.5 font-mono text-[10px] text-emerald-400"
                  >
                    <span class="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
                    live
                  </span>
                </div>
              </div>

              <div class="h-px bg-[hsl(var(--site-border))]" />

              <div class="space-y-3">
                <div class="flex items-center gap-2">
                  <span class="font-mono text-xs text-emerald-400">$</span>
                  <span class="font-mono text-xs text-[hsl(var(--site-text-muted))]">
                    git push origin main
                  </span>
                </div>
                <div class="space-y-1.5 pl-4">
                  <div class="flex items-center gap-2 text-xs">
                    <span class="text-emerald-400">✓</span>
                    <span class="font-mono text-[hsl(var(--site-text-muted))]"> Building... </span>
                  </div>
                  <div class="flex items-center gap-2 text-xs">
                    <span class="text-emerald-400">✓</span>
                    <span class="font-mono text-[hsl(var(--site-text-muted))]"> Deploying... </span>
                  </div>
                  <div class="flex items-center gap-2 text-xs">
                    <span class="text-cyan-400">✨</span>
                    <span class="font-mono text-[hsl(var(--site-text))]"> Deployed! </span>
                  </div>
                </div>
              </div>

              <div class="h-px bg-[hsl(var(--site-border))]" />

              <div class="flex items-center gap-3">
                <div class="flex h-7 w-7 items-center justify-center rounded-md bg-emerald-500/20">
                  <svg
                    class="h-3.5 w-3.5 text-emerald-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      :stroke-width="2"
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                </div>
                <div class="flex-1">
                  <div class="font-mono text-xs text-[hsl(var(--site-text))]">feat: add dashboard</div>
                  <div class="font-mono text-[10px] text-[hsl(var(--site-text-muted))]">
                    commit a3f2b1c
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
