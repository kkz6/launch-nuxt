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
  <section class="relative bg-background py-24">
    <div class="absolute inset-0 bg-gradient-to-t from-muted/30 to-background" />

    <div class="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
      <div class="grid items-center gap-12 lg:grid-cols-2">
        <div>
          <div
            class="mb-5 inline-flex items-center gap-2 rounded-full border bg-background px-3 py-1 text-sm"
          >
            <span class="relative flex h-2 w-2">
              <span class="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan-400 opacity-75" />
              <span class="relative inline-flex h-2 w-2 rounded-full bg-cyan-500" />
            </span>
            <span class="text-muted-foreground">How it works</span>
          </div>
          <h2 class="mb-4 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Deploy in <span class="text-emerald-500">three steps</span>
          </h2>
          <p class="mb-8 text-muted-foreground">
            No complex configurations. No DevOps expertise required. Just connect, configure, and deploy.
          </p>

          <div class="space-y-6">
            <div
              v-for="item in steps"
              :key="item.step"
              class="group flex gap-4"
            >
              <div
                class="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg border bg-emerald-500/10 font-mono text-sm font-bold text-emerald-500 transition-colors group-hover:border-emerald-500/30"
              >
                {{ item.step }}
              </div>
              <div>
                <h3 class="mb-1 font-semibold text-foreground">
                  {{ item.title }}
                </h3>
                <p class="text-sm text-muted-foreground">
                  {{ item.description }}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div class="relative">
          <div class="absolute -inset-4 rounded-2xl bg-gradient-to-r from-emerald-500/10 via-transparent to-cyan-500/10 blur-2xl" />

          <div class="relative overflow-hidden rounded-xl border bg-card shadow-xl">
            <div class="space-y-4 p-5">
              <div class="flex items-center gap-3">
                <div class="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/10">
                  <Icon name="lucide:rocket" class="h-5 w-5 text-emerald-500" />
                </div>
                <div>
                  <div class="font-mono text-sm font-medium text-foreground">my-app</div>
                  <div class="font-mono text-xs text-muted-foreground">production</div>
                </div>
                <div class="ml-auto">
                  <span
                    class="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-0.5 font-mono text-xs text-emerald-500"
                  >
                    <span class="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
                    live
                  </span>
                </div>
              </div>

              <div class="h-px bg-border" />

              <div class="space-y-3">
                <div class="flex items-center gap-2">
                  <span class="font-mono text-xs text-emerald-500">$</span>
                  <span class="font-mono text-xs text-muted-foreground">
                    git push origin main
                  </span>
                </div>
                <div class="space-y-1.5 pl-4">
                  <div class="flex items-center gap-2 text-xs">
                    <Icon name="lucide:check" class="h-3.5 w-3.5 text-emerald-500" />
                    <span class="font-mono text-muted-foreground">Building...</span>
                  </div>
                  <div class="flex items-center gap-2 text-xs">
                    <Icon name="lucide:check" class="h-3.5 w-3.5 text-emerald-500" />
                    <span class="font-mono text-muted-foreground">Deploying...</span>
                  </div>
                  <div class="flex items-center gap-2 text-xs">
                    <Icon name="lucide:sparkles" class="h-3.5 w-3.5 text-cyan-500" />
                    <span class="font-mono text-foreground">Deployed!</span>
                  </div>
                </div>
              </div>

              <div class="h-px bg-border" />

              <div class="flex items-center gap-3">
                <div class="flex h-7 w-7 items-center justify-center rounded-md bg-emerald-500/10">
                  <Icon name="lucide:git-commit-horizontal" class="h-3.5 w-3.5 text-emerald-500" />
                </div>
                <div class="flex-1">
                  <div class="font-mono text-xs text-foreground">feat: add dashboard</div>
                  <div class="font-mono text-[10px] text-muted-foreground">
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
