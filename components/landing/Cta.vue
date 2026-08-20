<script setup lang="ts">
const { isAuthenticated } = useAuth();
const { t } = useI18n();
</script>

<template>
  <section class="relative bg-background py-24">
    <div
      class="absolute inset-0 bg-gradient-to-t from-muted/50 to-background"
    />

    <div class="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
      <div class="relative overflow-hidden rounded-2xl border bg-card">
        <div
          class="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-primary/5"
        />

        <div class="relative px-6 py-16 text-center sm:px-12 sm:py-20">
          <h2
            class="mb-4 text-3xl font-bold tracking-tight text-foreground sm:text-4xl"
          >
            {{ t("public.cta.heading") }}
          </h2>
          <p class="mx-auto mb-8 max-w-2xl text-lg text-muted-foreground">
            {{ t("public.cta.description") }}
          </p>

          <div
            class="flex flex-col items-center justify-center gap-4 sm:flex-row"
          >
            <NuxtLink
              :to="isAuthenticated ? '/servers' : '/register'"
              class="inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-foreground px-8 text-sm font-medium text-background transition-colors hover:bg-foreground/90"
            >
              {{
                isAuthenticated
                  ? t("public.navigation.dashboard")
                  : t("public.cta.startTrial")
              }}
              <Icon name="lucide:arrow-right" class="h-4 w-4" />
            </NuxtLink>
            <NuxtLink
              to="/support"
              class="inline-flex h-12 items-center justify-center gap-2 rounded-lg border bg-background px-8 text-sm font-medium text-foreground transition-colors hover:bg-muted"
            >
              <Icon name="lucide:book-open" class="h-4 w-4" />
              {{ t("public.cta.readDocumentation") }}
            </NuxtLink>
          </div>

          <p class="mt-6 text-sm text-muted-foreground">
            {{ t("public.cta.trialNote") }}
          </p>
        </div>
      </div>
    </div>
  </section>
</template>
