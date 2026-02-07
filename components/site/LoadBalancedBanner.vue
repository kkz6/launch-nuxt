<script setup lang="ts">
import type { Site } from '~/types'

interface Props {
  site: Site
}

defineProps<Props>()
</script>

<template>
  <div
    v-if="site.load_balanced_upstream_id"
    class="flex items-start gap-3 rounded-lg border border-indigo-200 bg-indigo-50 p-4 dark:border-indigo-800 dark:bg-indigo-950/30"
  >
    <div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-500/10">
      <Icon name="lucide:git-fork" class="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
    </div>
    <div class="min-w-0 flex-1">
      <p class="text-sm font-medium text-indigo-900 dark:text-indigo-300">
        Load Balanced Site
      </p>
      <p class="mt-0.5 text-sm text-indigo-700 dark:text-indigo-400/80">
        This site is behind a load balancer. Traffic is routed through the upstream on port 8080 with HTTP only.
        Deploy changes to all backends simultaneously to keep them in sync.
      </p>
    </div>
  </div>
</template>
