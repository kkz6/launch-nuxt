<script setup lang="ts">
const { isAuthenticated } = useAuth()

const features = [
  { icon: 'lucide:server', label: 'Server Management' },
  { icon: 'lucide:globe', label: 'Site Deployments' },
  { icon: 'lucide:database', label: 'Database Control' },
  { icon: 'lucide:shield', label: 'SSL Certificates' },
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
                  app.launchctl.dev/servers
                </div>
              </div>
            </div>

            <!-- Dashboard content preview -->
            <div class="p-6">
              <!-- Nav preview -->
              <div class="mb-6 flex items-center justify-between">
                <span class="text-lg font-bold">launchctl</span>
                <div class="flex items-center gap-4">
                  <div class="h-8 w-24 rounded bg-muted" />
                  <div class="h-8 w-8 rounded-full bg-muted" />
                </div>
              </div>

              <!-- Tabs preview -->
              <div class="mb-6 flex gap-6 border-b">
                <span class="border-b-2 border-foreground pb-2 text-sm font-medium">Servers</span>
                <span class="pb-2 text-sm text-muted-foreground">Domains</span>
              </div>

              <!-- Server cards preview -->
              <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <div class="rounded-lg border bg-card p-4">
                  <div class="mb-3 flex items-center gap-3">
                    <div class="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10">
                      <Icon name="simple-icons:digitalocean" class="h-5 w-5 text-blue-500" />
                    </div>
                    <div>
                      <div class="flex items-center gap-2">
                        <span class="h-2 w-2 rounded-full bg-emerald-500" />
                        <span class="text-sm font-medium">Production</span>
                      </div>
                      <span class="text-xs text-muted-foreground">159.89.214.52</span>
                    </div>
                  </div>
                  <div class="flex gap-2">
                    <span class="rounded bg-muted px-2 py-0.5 text-xs">Ubuntu 22.04</span>
                    <span class="rounded bg-muted px-2 py-0.5 text-xs">4 Sites</span>
                  </div>
                </div>

                <div class="rounded-lg border bg-card p-4">
                  <div class="mb-3 flex items-center gap-3">
                    <div class="flex h-10 w-10 items-center justify-center rounded-lg bg-rose-500/10">
                      <Icon name="simple-icons:hetzner" class="h-5 w-5 text-rose-500" />
                    </div>
                    <div>
                      <div class="flex items-center gap-2">
                        <span class="h-2 w-2 rounded-full bg-emerald-500" />
                        <span class="text-sm font-medium">Staging</span>
                      </div>
                      <span class="text-xs text-muted-foreground">168.119.45.123</span>
                    </div>
                  </div>
                  <div class="flex gap-2">
                    <span class="rounded bg-muted px-2 py-0.5 text-xs">Ubuntu 22.04</span>
                    <span class="rounded bg-muted px-2 py-0.5 text-xs">2 Sites</span>
                  </div>
                </div>

                <div class="hidden rounded-lg border border-dashed bg-card/50 p-4 lg:block">
                  <div class="flex h-full flex-col items-center justify-center">
                    <Icon name="lucide:plus" class="mb-2 h-6 w-6 text-muted-foreground" />
                    <span class="text-sm text-muted-foreground">Add Server</span>
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
