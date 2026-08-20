<script setup lang="ts">
const chartHeights = [40, 65, 45, 80, 55, 70, 90, 60, 75, 85, 50, 95];
const { t } = useI18n();

const databases = [
  { name: "MySQL", active: true },
  { name: "PostgreSQL", active: true },
  { name: "Redis", active: true },
  { name: "MongoDB", active: false },
];
</script>

<template>
  <section class="relative bg-background py-24">
    <div
      class="absolute inset-0 bg-gradient-to-b from-muted/30 to-background"
    />

    <div class="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
      <!-- Section Header -->
      <div class="mb-16 text-center">
        <h2
          class="mb-4 text-3xl font-bold tracking-tight text-foreground sm:text-4xl"
        >
          {{ t("public.bento.heading") }}
        </h2>
        <p class="mx-auto max-w-2xl text-lg text-muted-foreground">
          {{ t("public.bento.description") }}
        </p>
      </div>

      <!-- Bento Grid -->
      <div class="grid grid-cols-1 gap-4 lg:grid-cols-3 lg:gap-6">
        <!-- Left Column - Terminal + One Click Deploy -->
        <div class="space-y-4 lg:row-span-2 lg:space-y-6">
          <!-- Terminal Card -->
          <div class="h-full overflow-hidden rounded-xl border bg-card">
            <div class="flex h-full flex-col p-6">
              <!-- Terminal Window -->
              <div class="flex-1 overflow-hidden rounded-lg border bg-muted/50">
                <div class="flex items-center gap-2 border-b px-4 py-3">
                  <div class="flex gap-1.5">
                    <div class="h-2.5 w-2.5 rounded-full bg-red-400" />
                    <div class="h-2.5 w-2.5 rounded-full bg-yellow-400" />
                    <div class="h-2.5 w-2.5 rounded-full bg-green-400" />
                  </div>
                  <span class="ml-2 font-mono text-[10px] text-muted-foreground"
                    >terminal</span
                  >
                </div>

                <div class="space-y-3 p-4 font-mono text-xs">
                  <div class="flex items-center gap-2">
                    <span class="text-primary">$</span>
                    <span class="text-foreground">git add .</span>
                  </div>
                  <div class="flex items-center gap-2">
                    <span class="text-primary">$</span>
                    <span class="text-foreground">git commit -m "deploy"</span>
                  </div>
                  <div class="flex items-center gap-2">
                    <span class="text-primary">$</span>
                    <span class="text-foreground">git push</span>
                  </div>
                  <div class="mt-4 border-t pt-3">
                    <div class="flex items-center gap-2 text-primary">
                      <Icon name="lucide:sparkles" class="h-4 w-4" />
                      <span>{{ t("public.bento.siteLive") }}</span>
                    </div>
                  </div>
                </div>
              </div>

              <!-- One Click Deploy -->
              <div class="mt-6">
                <h3 class="mb-2 text-lg font-semibold text-foreground">
                  {{ t("public.bento.oneClick.title") }}
                </h3>
                <p class="text-sm text-muted-foreground">
                  {{ t("public.bento.oneClick.description") }}
                </p>
              </div>
            </div>
          </div>
        </div>

        <!-- Right Top - Intuitive Workflow -->
        <div class="overflow-hidden rounded-xl border bg-card lg:col-span-2">
          <div class="h-full p-6">
            <div class="flex h-full flex-col gap-6 lg:flex-row">
              <div class="flex flex-col justify-center lg:w-1/2">
                <h3 class="mb-2 text-lg font-semibold text-foreground">
                  {{ t("public.bento.workflow.title") }}
                </h3>
                <p class="text-sm text-muted-foreground">
                  {{ t("public.bento.workflow.description") }}
                </p>
              </div>
              <div class="lg:w-1/2">
                <!-- Dashboard Preview -->
                <div class="h-full rounded-lg border bg-muted/50 p-4">
                  <div class="space-y-3">
                    <!-- Stats Row -->
                    <div class="grid grid-cols-3 gap-2">
                      <div class="rounded-md border bg-background p-2">
                        <div
                          class="font-mono text-[10px] text-muted-foreground"
                        >
                          {{ t("public.bento.deployments") }}
                        </div>
                        <div class="text-sm font-semibold text-foreground">
                          247
                        </div>
                      </div>
                      <div class="rounded-md border bg-background p-2">
                        <div
                          class="font-mono text-[10px] text-muted-foreground"
                        >
                          {{ t("public.bento.uptime") }}
                        </div>
                        <div
                          class="text-sm font-semibold text-emerald-600 dark:text-emerald-400"
                        >
                          99.9%
                        </div>
                      </div>
                      <div class="rounded-md border bg-background p-2">
                        <div
                          class="font-mono text-[10px] text-muted-foreground"
                        >
                          {{ t("public.bento.servers") }}
                        </div>
                        <div class="text-sm font-semibold text-foreground">
                          12
                        </div>
                      </div>
                    </div>

                    <!-- Mini Chart -->
                    <div class="rounded-md border bg-background p-3">
                      <div class="flex h-12 items-end gap-1">
                        <div
                          v-for="(height, i) in chartHeights"
                          :key="i"
                          class="flex-1 rounded-t bg-primary/60"
                          :style="{ height: `${height}%` }"
                        />
                      </div>
                      <div
                        class="mt-2 font-mono text-[10px] text-muted-foreground"
                      >
                        {{ t("public.bento.deploymentsThisWeek") }}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Bottom Left - SSL Certificates -->
        <div class="overflow-hidden rounded-xl border bg-card">
          <div class="flex h-full flex-col p-6">
            <!-- SSL Visualization -->
            <div class="flex-1">
              <div class="h-full rounded-lg border bg-muted/50 p-4">
                <div class="space-y-4">
                  <!-- Header -->
                  <div class="flex items-center justify-between">
                    <span class="font-mono text-[10px] text-muted-foreground">{{
                      t("public.bento.sslCertificates")
                    }}</span>
                    <span
                      class="inline-flex items-center gap-1 rounded-full border bg-background px-2 py-0.5 font-mono text-[10px] text-foreground"
                    >
                      <Icon name="lucide:zap" class="h-3 w-3 text-primary" />
                      {{ t("public.bento.autoRenew") }}
                    </span>
                  </div>

                  <!-- Lock Icon -->
                  <div class="flex items-center justify-center py-6">
                    <div class="relative">
                      <div
                        class="absolute -inset-4 rounded-full bg-primary/10 blur-xl"
                      />
                      <div
                        class="relative flex h-20 w-20 items-center justify-center rounded-full border bg-primary/5"
                      >
                        <Icon
                          name="lucide:shield-check"
                          class="h-10 w-10 text-primary"
                        />
                      </div>
                    </div>
                  </div>

                  <!-- Certificate Info -->
                  <div class="space-y-2">
                    <div
                      class="flex items-center justify-between rounded-md border bg-background p-2"
                    >
                      <div class="flex items-center gap-2">
                        <Icon
                          name="lucide:lock"
                          class="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400"
                        />
                        <span class="font-mono text-[10px] text-foreground"
                          >myapp.com</span
                        >
                      </div>
                      <span
                        class="font-mono text-[10px] text-emerald-600 dark:text-emerald-400"
                        >{{ t("public.bento.active") }}</span
                      >
                    </div>
                    <div
                      class="flex items-center justify-between rounded-md border bg-background p-2"
                    >
                      <div class="flex items-center gap-2">
                        <Icon
                          name="lucide:lock"
                          class="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400"
                        />
                        <span class="font-mono text-[10px] text-foreground"
                          >api.myapp.com</span
                        >
                      </div>
                      <span
                        class="font-mono text-[10px] text-emerald-600 dark:text-emerald-400"
                        >{{ t("public.bento.active") }}</span
                      >
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Description -->
            <div class="mt-4">
              <h3 class="mb-2 text-lg font-semibold text-foreground">
                {{ t("public.bento.ssl.title") }}
              </h3>
              <p class="text-sm text-muted-foreground">
                {{ t("public.bento.ssl.description") }}
              </p>
            </div>
          </div>
        </div>

        <!-- Bottom Right - Database Management -->
        <div class="overflow-hidden rounded-xl border bg-card">
          <div class="flex h-full flex-col p-6">
            <!-- Database Visualization -->
            <div class="flex-1">
              <div class="h-full rounded-lg border bg-muted/50 p-4">
                <div class="space-y-3">
                  <!-- Database Header -->
                  <div class="flex items-center justify-between">
                    <span class="font-mono text-[10px] text-muted-foreground">{{
                      t("public.bento.databases")
                    }}</span>
                    <span class="font-mono text-xs text-primary">{{
                      t("public.bento.managed")
                    }}</span>
                  </div>

                  <!-- Database Types -->
                  <div class="grid grid-cols-2 gap-2">
                    <div
                      v-for="db in databases"
                      :key="db.name"
                      :class="[
                        'flex items-center gap-2 rounded-md border p-2',
                        db.active
                          ? 'border-primary/20 bg-primary/5'
                          : 'border-dashed bg-background',
                      ]"
                    >
                      <Icon
                        name="lucide:database"
                        :class="[
                          'h-3.5 w-3.5',
                          db.active ? 'text-primary' : 'text-muted-foreground',
                        ]"
                      />
                      <span
                        :class="[
                          'font-mono text-[10px]',
                          db.active
                            ? 'text-foreground'
                            : 'text-muted-foreground',
                        ]"
                      >
                        {{ db.name }}
                      </span>
                    </div>
                  </div>

                  <!-- Storage Indicator -->
                  <div class="space-y-1">
                    <div class="flex justify-between font-mono text-[10px]">
                      <span class="text-muted-foreground">{{
                        t("public.bento.storage")
                      }}</span>
                      <span class="text-foreground">2.4 GB</span>
                    </div>
                    <div class="h-1.5 overflow-hidden rounded-full bg-muted">
                      <div
                        class="h-full rounded-full bg-primary"
                        style="width: 24%"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Description -->
            <div class="mt-4">
              <h3 class="mb-2 text-lg font-semibold text-foreground">
                {{ t("public.bento.database.title") }}
              </h3>
              <p class="text-sm text-muted-foreground">
                {{ t("public.bento.database.description") }}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
