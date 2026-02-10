<script setup lang="ts">
const { isAuthenticated } = useAuth()

const features = [
  { icon: 'lucide:server', label: 'Server Management' },
  { icon: 'lucide:rocket', label: 'Zero-Downtime Deploys' },
  { icon: 'lucide:database', label: 'Database Control' },
  { icon: 'lucide:shield', label: 'SSL Certificates' },
  { icon: 'lucide:container', label: 'Docker & Compose' },
  { icon: 'lucide:network', label: 'Load Balancers' },
]

const providers = [
  { name: 'DigitalOcean', icon: 'simple-icons:digitalocean' },
  { name: 'Hetzner', icon: 'simple-icons:hetzner' },
  { name: 'Vultr', icon: 'simple-icons:vultr' },
  { name: 'AWS', icon: 'simple-icons:amazonaws' },
  { name: 'Linode', icon: 'simple-icons:linode' },
]
</script>

<template>
  <section class="relative min-h-[90vh] overflow-hidden bg-background">
    <!-- Subtle gradient background -->
    <div class="absolute inset-0 bg-gradient-to-b from-muted/30 via-background to-background" />
    <div class="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/5 via-transparent to-transparent" />

    <!-- Grid pattern -->
    <div class="absolute inset-0 bg-[linear-gradient(to_right,hsl(var(--border)/0.3)_1px,transparent_1px),linear-gradient(to_bottom,hsl(var(--border)/0.3)_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_80%_50%_at_50%_0%,black_70%,transparent_100%)]" />

    <div class="relative mx-auto max-w-7xl px-4 pb-20 pt-32 sm:px-6 lg:px-8">
      <div class="mx-auto max-w-4xl text-center">
        <!-- Badge -->
        <div class="mb-8 inline-flex items-center gap-2 rounded-full border bg-background/80 px-4 py-1.5 text-sm backdrop-blur-sm">
          <span class="relative flex h-2 w-2">
            <span class="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span class="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
          </span>
          <span class="text-muted-foreground">Server management simplified</span>
        </div>

        <!-- Headline -->
        <h1 class="mb-6 text-4xl font-bold tracking-tight text-foreground sm:text-5xl lg:text-6xl">
          Deploy and manage servers
          <span class="block text-muted-foreground">without the complexity</span>
        </h1>

        <!-- Subheadline -->
        <p class="mx-auto mb-10 max-w-2xl text-lg text-muted-foreground">
          One platform for provisioning servers, deploying applications, managing databases,
          and monitoring your infrastructure. No DevOps expertise required.
        </p>

        <!-- CTA Buttons -->
        <div class="mb-16 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <NuxtLink
            :to="isAuthenticated ? '/servers' : '/register'"
            class="inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-foreground px-8 text-sm font-medium text-background transition-colors hover:bg-foreground/90"
          >
            {{ isAuthenticated ? 'Go to Dashboard' : 'Get Started Free' }}
            <Icon name="lucide:arrow-right" class="h-4 w-4" />
          </NuxtLink>
          <NuxtLink
            to="/pricing"
            class="inline-flex h-12 items-center justify-center gap-2 rounded-lg border bg-background px-8 text-sm font-medium text-foreground transition-colors hover:bg-muted"
          >
            View Pricing
          </NuxtLink>
        </div>

        <!-- Feature pills -->
        <div class="mb-16 flex flex-wrap items-center justify-center gap-3">
          <div
            v-for="feature in features"
            :key="feature.label"
            class="inline-flex items-center gap-2 rounded-full border bg-background/50 px-4 py-2 text-sm text-muted-foreground backdrop-blur-sm"
          >
            <Icon :name="feature.icon" class="h-4 w-4" />
            {{ feature.label }}
          </div>
        </div>

        <!-- Dashboard Preview -->
        <div class="relative mx-auto max-w-5xl">
          <div class="absolute -inset-4 rounded-2xl bg-gradient-to-r from-primary/10 via-primary/5 to-primary/10 blur-2xl" />
          <div class="relative overflow-hidden rounded-xl border bg-background shadow-2xl">
            <!-- Browser chrome -->
            <div class="flex items-center gap-2 border-b bg-muted/30 px-4 py-3">
              <div class="flex gap-1.5">
                <div class="h-3 w-3 rounded-full bg-red-500/60" />
                <div class="h-3 w-3 rounded-full bg-yellow-500/60" />
                <div class="h-3 w-3 rounded-full bg-green-500/60" />
              </div>
              <div class="ml-4 flex-1">
                <div class="mx-auto flex max-w-md items-center gap-2 rounded-md bg-background px-3 py-1.5 text-xs text-muted-foreground">
                  <Icon name="lucide:lock" class="h-3 w-3" />
                  app.launchctl.dev/dashboard
                </div>
              </div>
            </div>

            <!-- Dashboard content preview -->
            <div class="text-left">
              <!-- Top navbar row -->
              <div class="flex h-12 items-center justify-between border-b px-4 lg:px-6">
                <span class="text-base font-bold">launchctl</span>
                <div class="flex items-center gap-1">
                  <div class="h-7 w-7 rounded-full bg-muted" />
                  <Icon name="lucide:chevron-down" class="h-3 w-3 text-muted-foreground" />
                </div>
              </div>

              <!-- Tab navigation row -->
              <div class="border-b px-4 lg:px-6">
                <div class="flex gap-5">
                  <div class="flex items-center gap-1.5 border-b-2 border-foreground py-2.5">
                    <Icon name="lucide:layout-dashboard" class="h-3.5 w-3.5" />
                    <span class="text-xs font-medium">Dashboard</span>
                  </div>
                  <div class="flex items-center gap-1.5 py-2.5 text-muted-foreground">
                    <Icon name="lucide:server" class="h-3.5 w-3.5" />
                    <span class="text-xs font-medium">Servers</span>
                  </div>
                  <div class="hidden items-center gap-1.5 py-2.5 text-muted-foreground sm:flex">
                    <Icon name="lucide:globe" class="h-3.5 w-3.5" />
                    <span class="text-xs font-medium">Domains</span>
                  </div>
                  <div class="hidden items-center gap-1.5 py-2.5 text-muted-foreground sm:flex">
                    <Icon name="lucide:scroll-text" class="h-3.5 w-3.5" />
                    <span class="text-xs font-medium">Scripts</span>
                  </div>
                </div>
              </div>

              <!-- Page content -->
              <div class="p-4 lg:p-6">
                <!-- Greeting -->
                <h2 class="mb-5 text-base font-semibold lg:text-lg">Good morning, Alex</h2>

                <!-- Servers section -->
                <div class="mb-5">
                  <div class="mb-2.5 flex items-center justify-between">
                    <span class="text-xs font-medium text-muted-foreground">Servers</span>
                    <span class="text-xs text-muted-foreground">View all</span>
                  </div>
                  <div class="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
                    <!-- Production -->
                    <div class="rounded-lg border bg-card p-2.5 transition-colors">
                      <div class="flex items-center gap-2">
                        <div class="flex h-7 w-7 shrink-0 items-center justify-center rounded bg-muted">
                          <Icon name="simple-icons:digitalocean" class="h-3.5 w-3.5 text-muted-foreground" />
                        </div>
                        <div class="min-w-0 flex-1">
                          <div class="flex items-center gap-1.5">
                            <span class="truncate text-xs font-medium">Production</span>
                            <span class="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
                          </div>
                          <p class="text-[10px] text-muted-foreground">4 sites</p>
                        </div>
                      </div>
                    </div>

                    <!-- Staging -->
                    <div class="rounded-lg border bg-card p-2.5 transition-colors">
                      <div class="flex items-center gap-2">
                        <div class="flex h-7 w-7 shrink-0 items-center justify-center rounded bg-muted">
                          <Icon name="simple-icons:hetzner" class="h-3.5 w-3.5 text-muted-foreground" />
                        </div>
                        <div class="min-w-0 flex-1">
                          <div class="flex items-center gap-1.5">
                            <span class="truncate text-xs font-medium">Staging</span>
                            <span class="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
                          </div>
                          <p class="text-[10px] text-muted-foreground">2 sites</p>
                        </div>
                      </div>
                    </div>

                    <!-- Docker -->
                    <div class="hidden rounded-lg border bg-card p-2.5 transition-colors sm:block">
                      <div class="flex items-center gap-2">
                        <div class="flex h-7 w-7 shrink-0 items-center justify-center rounded bg-muted">
                          <Icon name="simple-icons:vultr" class="h-3.5 w-3.5 text-muted-foreground" />
                        </div>
                        <div class="min-w-0 flex-1">
                          <div class="flex items-center gap-1.5">
                            <span class="truncate text-xs font-medium">Docker-01</span>
                            <span class="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
                          </div>
                          <p class="text-[10px] text-muted-foreground">6 services</p>
                        </div>
                      </div>
                    </div>

                    <!-- Load Balancer -->
                    <div class="hidden rounded-lg border bg-card p-2.5 transition-colors lg:block">
                      <div class="flex items-center gap-2">
                        <div class="flex h-7 w-7 shrink-0 items-center justify-center rounded bg-muted">
                          <Icon name="simple-icons:amazonaws" class="h-3.5 w-3.5 text-muted-foreground" />
                        </div>
                        <div class="min-w-0 flex-1">
                          <div class="flex items-center gap-1.5">
                            <span class="truncate text-xs font-medium">LB-Primary</span>
                            <span class="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
                          </div>
                          <p class="text-[10px] text-muted-foreground">3 upstreams</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <!-- Recent Activity -->
                <div>
                  <div class="mb-2.5">
                    <span class="text-xs font-medium text-muted-foreground">Recent Activity</span>
                  </div>
                  <div class="rounded-lg border bg-card">
                    <!-- Row 1 -->
                    <div class="flex items-center gap-3 border-b px-3 py-2.5">
                      <span class="h-2 w-2 shrink-0 rounded-full bg-green-500" />
                      <div class="min-w-0 flex-1">
                        <div class="flex items-center gap-1.5">
                          <span class="text-xs font-medium">api.example.com</span>
                          <span class="text-[10px] text-muted-foreground">/</span>
                          <span class="text-[10px] text-muted-foreground">Production</span>
                        </div>
                        <p class="truncate text-[10px] text-muted-foreground">fix: update auth middleware</p>
                      </div>
                      <code class="hidden rounded bg-muted px-1 py-0.5 font-mono text-[9px] text-muted-foreground sm:block">a3f8c2d</code>
                      <div class="hidden h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-[8px] font-medium sm:flex">AK</div>
                      <span class="shrink-0 text-[10px] text-muted-foreground">2m ago</span>
                    </div>
                    <!-- Row 2 -->
                    <div class="flex items-center gap-3 border-b px-3 py-2.5">
                      <span class="h-2 w-2 shrink-0 rounded-full animate-pulse bg-blue-500" />
                      <div class="min-w-0 flex-1">
                        <div class="flex items-center gap-1.5">
                          <span class="text-xs font-medium">dashboard.app.io</span>
                          <span class="text-[10px] text-muted-foreground">/</span>
                          <span class="text-[10px] text-muted-foreground">Staging</span>
                        </div>
                        <p class="truncate text-[10px] text-muted-foreground">feat: add dark mode toggle</p>
                      </div>
                      <code class="hidden rounded bg-muted px-1 py-0.5 font-mono text-[9px] text-muted-foreground sm:block">e7b1f09</code>
                      <div class="hidden h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-[8px] font-medium sm:flex">JD</div>
                      <span class="shrink-0 text-[10px] text-muted-foreground">just now</span>
                    </div>
                    <!-- Row 3 -->
                    <div class="flex items-center gap-3 px-3 py-2.5">
                      <span class="h-2 w-2 shrink-0 rounded-full bg-green-500" />
                      <div class="min-w-0 flex-1">
                        <div class="flex items-center gap-1.5">
                          <span class="text-xs font-medium">shop.example.com</span>
                          <span class="text-[10px] text-muted-foreground">/</span>
                          <span class="text-[10px] text-muted-foreground">Production</span>
                        </div>
                        <p class="truncate text-[10px] text-muted-foreground">chore: bump dependencies</p>
                      </div>
                      <code class="hidden rounded bg-muted px-1 py-0.5 font-mono text-[9px] text-muted-foreground sm:block">c4d92e1</code>
                      <div class="hidden h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-[8px] font-medium sm:flex">AK</div>
                      <span class="shrink-0 text-[10px] text-muted-foreground">15m ago</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Provider logos -->
        <div class="mt-16">
          <p class="mb-6 text-center text-sm text-muted-foreground">
            Connect your servers from any provider
          </p>
          <div class="flex flex-wrap items-center justify-center gap-8 opacity-60">
            <div
              v-for="provider in providers"
              :key="provider.name"
              class="flex items-center gap-2 text-muted-foreground"
            >
              <Icon :name="provider.icon" class="h-5 w-5" />
              <span class="text-sm font-medium">{{ provider.name }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
