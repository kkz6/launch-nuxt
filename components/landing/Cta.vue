<script setup lang="ts">
const { isAuthenticated } = useAuth()
</script>

<template>
  <section class="relative bg-background py-24">
    <div class="absolute inset-0 bg-gradient-to-t from-muted/50 to-background" />

    <div class="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
      <div class="relative overflow-hidden rounded-2xl border bg-card">
        <div class="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-primary/5" />

        <div class="relative px-6 py-16 text-center sm:px-12 sm:py-20">
          <h2 class="mb-4 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Ready to simplify your infrastructure?
          </h2>
          <p class="mx-auto mb-8 max-w-2xl text-lg text-muted-foreground">
            Join thousands of developers who deploy and manage their servers with launchctl.
            Start your free trial today.
          </p>

          <div class="flex flex-col items-center justify-center gap-4 sm:flex-row">
            <NuxtLink
              :to="isAuthenticated ? '/servers' : '/register'"
              class="inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-foreground px-8 text-sm font-medium text-background transition-colors hover:bg-foreground/90"
            >
              {{ isAuthenticated ? 'Go to Dashboard' : 'Start Free Trial' }}
              <Icon name="lucide:arrow-right" class="h-4 w-4" />
            </NuxtLink>
            <NuxtLink
              to="/support"
              class="inline-flex h-12 items-center justify-center gap-2 rounded-lg border bg-background px-8 text-sm font-medium text-foreground transition-colors hover:bg-muted"
            >
              <Icon name="lucide:book-open" class="h-4 w-4" />
              Read Documentation
            </NuxtLink>
          </div>

          <p class="mt-6 text-sm text-muted-foreground">
            No credit card required &bull; 14-day free trial &bull; Cancel anytime
          </p>
        </div>
      </div>
    </div>
  </section>
</template>
