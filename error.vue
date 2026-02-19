<script setup lang="ts">
import { Button } from '~/components/ui/button'

const props = defineProps<{
  error: {
    statusCode: number
    statusMessage?: string
    message?: string
  }
}>()

useHead({ title: props.error.statusCode === 404 ? 'Page Not Found' : 'Error' })

const is404 = computed(() => props.error.statusCode === 404)

const handleGoBack = () => {
  if (window.history.length > 1) {
    window.history.back()
  } else {
    clearError({ redirect: '/' })
  }
}
</script>

<template>
  <div class="flex min-h-screen items-center justify-center bg-background px-4">
    <div class="flex max-w-md flex-col items-center text-center">
      <!-- Status Code -->
      <p class="text-8xl font-bold tracking-tighter text-foreground/10">
        {{ error.statusCode }}
      </p>

      <!-- Icon -->
      <div class="mt-2 mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-muted">
        <Icon
          v-if="is404"
          name="lucide:map-pin-off"
          class="h-7 w-7 text-muted-foreground"
        />
        <Icon
          v-else
          name="lucide:alert-triangle"
          class="h-7 w-7 text-muted-foreground"
        />
      </div>

      <!-- Message -->
      <h1 class="text-xl font-semibold">
        {{ is404 ? 'Page not found' : 'Something went wrong' }}
      </h1>
      <p class="mt-2 text-sm text-muted-foreground">
        <template v-if="is404">
          The page you're looking for doesn't exist or has been moved.
        </template>
        <template v-else>
          {{ error.statusMessage || error.message || 'An unexpected error occurred.' }}
        </template>
      </p>

      <!-- Actions -->
      <div class="mt-8 flex items-center gap-3">
        <Button variant="outline" @click="handleGoBack">
          <Icon name="lucide:arrow-left" class="mr-1.5 h-4 w-4" />
          Go Back
        </Button>
        <Button @click="clearError({ redirect: '/' })">
          <Icon name="lucide:home" class="mr-1.5 h-4 w-4" />
          Home
        </Button>
      </div>
    </div>
  </div>
</template>
