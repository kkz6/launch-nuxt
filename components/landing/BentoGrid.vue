<script setup lang="ts">
const chartHeights = [40, 65, 45, 80, 55, 70, 90, 60, 75, 85, 50, 95]

const databases = [
  { name: 'MySQL', active: true },
  { name: 'PostgreSQL', active: true },
  { name: 'Redis', active: true },
  { name: 'MongoDB', active: false },
]
</script>

<template>
  <section class="site-section bg-[hsl(var(--site-bg))] py-20">
    <div class="site-grid-pattern absolute inset-0" />
    <div class="site-glow left-1/4 top-0 h-[500px] w-[500px] bg-emerald-500 opacity-10" />
    <div class="site-glow bottom-0 right-1/4 h-[400px] w-[400px] bg-cyan-500 opacity-10" />

    <div class="site-container relative">
      <!-- Section Header -->
      <div class="mb-16 text-center" data-aos="fade-up">
        <h2 class="font-site mb-4 text-3xl font-bold text-[hsl(var(--site-text))] md:text-4xl">
          Deployments made easy
        </h2>
        <p class="mx-auto max-w-xl text-base text-[hsl(var(--site-text-muted))]">
          Deploy with ease, leave complexities to us.
        </p>
      </div>

      <!-- Bento Grid -->
      <div class="grid grid-cols-1 gap-4 lg:grid-cols-3 lg:gap-6">
        <!-- Left Column - Terminal + One Click Deploy -->
        <div class="space-y-4 lg:row-span-2 lg:space-y-6">
          <!-- Terminal Card -->
          <div class="site-card site-card-hover h-full overflow-hidden rounded-xl" data-aos="fade-right">
            <div class="flex h-full flex-col p-6">
              <!-- Terminal Window -->
              <div class="flex-1 rounded-lg border border-white/5 bg-[hsl(220,20%,6%)]">
                <div class="flex items-center gap-2 border-b border-white/5 px-4 py-3">
                  <div class="flex gap-1.5">
                    <div class="h-2.5 w-2.5 rounded-full bg-red-500/80" />
                    <div class="h-2.5 w-2.5 rounded-full bg-yellow-500/80" />
                    <div class="h-2.5 w-2.5 rounded-full bg-green-500/80" />
                  </div>
                  <span class="ml-2 font-mono text-[10px] text-white/30"> terminal </span>
                </div>

                <div class="space-y-3 p-4 font-mono text-xs">
                  <div class="flex items-center gap-2">
                    <span class="text-emerald-400">$</span>
                    <span class="text-white/70">git add .</span>
                  </div>
                  <div class="flex items-center gap-2">
                    <span class="text-emerald-400">$</span>
                    <span class="text-white/70"> git commit -m "deploy" </span>
                  </div>
                  <div class="flex items-center gap-2">
                    <span class="text-emerald-400">$</span>
                    <span class="text-white/70">git push</span>
                  </div>
                  <div class="mt-4 border-t border-white/5 pt-3">
                    <div class="flex items-center gap-2 text-cyan-400">
                      <span>✨</span>
                      <span>your site is live</span>
                    </div>
                  </div>
                </div>
              </div>

              <!-- One Click Deploy -->
              <div class="mt-6">
                <h3 class="font-site mb-2 text-lg font-semibold text-[hsl(var(--site-text))]">
                  One click deploy
                </h3>
                <p class="text-sm text-[hsl(var(--site-text-muted))]">
                  Deploy your app in seconds, with our one click deploy feature. Push to Git and we
                  handle the rest.
                </p>
              </div>
            </div>
          </div>
        </div>

        <!-- Right Top - Intuitive Workflow -->
        <div
          class="site-card site-card-hover overflow-hidden rounded-xl lg:col-span-2"
          data-aos="fade-left"
        >
          <div class="h-full p-6">
            <div class="flex h-full flex-col gap-6 lg:flex-row">
              <div class="flex flex-col justify-center lg:w-1/2">
                <h3 class="font-site mb-2 text-lg font-semibold text-[hsl(var(--site-text))]">
                  Intuitive workflow
                </h3>
                <p class="text-sm text-[hsl(var(--site-text-muted))]">
                  With our intuitive workflow, you can easily manage your deployments without complex
                  configurations or DevOps expertise.
                </p>
              </div>
              <div class="lg:w-1/2">
                <!-- Dashboard Preview -->
                <div class="h-full rounded-lg border border-white/5 bg-[hsl(220,20%,6%)] p-4">
                  <div class="space-y-3">
                    <!-- Stats Row -->
                    <div class="grid grid-cols-3 gap-2">
                      <div class="rounded-md bg-white/5 p-2">
                        <div class="font-mono text-[10px] text-white/40">Deployments</div>
                        <div class="text-sm font-semibold text-white">247</div>
                      </div>
                      <div class="rounded-md bg-white/5 p-2">
                        <div class="font-mono text-[10px] text-white/40">Uptime</div>
                        <div class="text-sm font-semibold text-emerald-400">99.9%</div>
                      </div>
                      <div class="rounded-md bg-white/5 p-2">
                        <div class="font-mono text-[10px] text-white/40">Servers</div>
                        <div class="text-sm font-semibold text-white">12</div>
                      </div>
                    </div>

                    <!-- Mini Chart -->
                    <div class="rounded-md bg-white/5 p-3">
                      <div class="flex h-12 items-end gap-1">
                        <div
                          v-for="(height, i) in chartHeights"
                          :key="i"
                          class="flex-1 rounded-t bg-emerald-500/50"
                          :style="{ height: `${height}%` }"
                        />
                      </div>
                      <div class="mt-2 font-mono text-[10px] text-white/30">Deployments this week</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Bottom Left - Global Edge Network -->
        <div
          class="site-card site-card-hover overflow-hidden rounded-xl"
          data-aos="fade-up"
          data-aos-delay="100"
        >
          <div class="flex h-full flex-col p-6">
            <!-- Globe -->
            <div class="relative min-h-[280px] flex-1">
              <Suspense>
                <LandingGitHubGlobe class="opacity-85" />
                <template #fallback>
                  <div class="absolute inset-0 flex items-center justify-center">
                    <div
                      class="h-8 w-8 animate-spin rounded-full border-2 border-emerald-500/30 border-t-emerald-500"
                    />
                  </div>
                </template>
              </Suspense>
            </div>

            <!-- Description -->
            <div class="mt-4">
              <h3 class="font-site mb-2 text-lg font-semibold text-[hsl(var(--site-text))]">
                Global edge network
              </h3>
              <p class="text-sm text-[hsl(var(--site-text-muted))]">
                Deploy to multiple regions. Your app runs closer to your users for lightning-fast
                performance.
              </p>
            </div>
          </div>
        </div>

        <!-- Bottom Right - Database Management -->
        <div
          class="site-card site-card-hover overflow-hidden rounded-xl"
          data-aos="fade-up"
          data-aos-delay="200"
        >
          <div class="flex h-full flex-col p-6">
            <!-- Database Visualization -->
            <div class="flex-1">
              <div class="h-full rounded-lg border border-white/5 bg-[hsl(220,20%,6%)] p-4">
                <div class="space-y-3">
                  <!-- Database Header -->
                  <div class="flex items-center justify-between">
                    <span class="font-mono text-[10px] text-white/40"> Databases </span>
                    <span class="font-mono text-xs text-emerald-400"> Managed </span>
                  </div>

                  <!-- Database Types -->
                  <div class="grid grid-cols-2 gap-2">
                    <div
                      v-for="db in databases"
                      :key="db.name"
                      :class="[
                        'flex items-center gap-2 rounded-md border p-2',
                        db.active
                          ? 'border-emerald-500/20 bg-emerald-500/10'
                          : 'border-dashed border-white/10 bg-white/5',
                      ]"
                    >
                      <svg
                        :class="['h-3.5 w-3.5', db.active ? 'text-emerald-400' : 'text-white/20']"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          :stroke-width="1.5"
                          d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4"
                        />
                      </svg>
                      <span
                        :class="['font-mono text-[10px]', db.active ? 'text-white/70' : 'text-white/30']"
                      >
                        {{ db.name }}
                      </span>
                    </div>
                  </div>

                  <!-- Storage Indicator -->
                  <div class="space-y-1">
                    <div class="flex justify-between font-mono text-[10px]">
                      <span class="text-white/40">Storage</span>
                      <span class="text-white/60">2.4 GB</span>
                    </div>
                    <div class="h-1.5 overflow-hidden rounded-full bg-white/5">
                      <div
                        class="h-full rounded-full bg-gradient-to-r from-emerald-500 to-cyan-500"
                        style="width: 24%"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Description -->
            <div class="mt-4">
              <h3 class="font-site mb-2 text-lg font-semibold text-[hsl(var(--site-text))]">
                Database management
              </h3>
              <p class="text-sm text-[hsl(var(--site-text-muted))]">
                Create and manage databases with one click. Backups, migrations, and monitoring included.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
