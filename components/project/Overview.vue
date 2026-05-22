<script setup lang="ts">
import type { DockerProject } from "~/services/dockerService";

interface Props {
  project: DockerProject;
}
defineProps<Props>();
</script>

<template>
  <div class="space-y-6">
    <!-- Phase 1: a simple totals card. Once workloads exist we'll add a
         "recent deployments" panel and a status timeline here. -->
    <div class="grid gap-4 sm:grid-cols-3">
      <div class="rounded-lg border bg-card p-5">
        <div class="flex items-center gap-2 text-muted-foreground">
          <Icon name="lucide:box" class="h-4 w-4" />
          <span class="text-sm">Applications</span>
        </div>
        <p class="mt-2 text-3xl font-semibold">
          {{ project.applications_count }}
        </p>
      </div>
      <div class="rounded-lg border bg-card p-5">
        <div class="flex items-center gap-2 text-muted-foreground">
          <Icon name="lucide:layers" class="h-4 w-4" />
          <span class="text-sm">Compose stacks</span>
        </div>
        <p class="mt-2 text-3xl font-semibold">
          {{ project.composes_count }}
        </p>
      </div>
      <div class="rounded-lg border bg-card p-5">
        <div class="flex items-center gap-2 text-muted-foreground">
          <Icon name="lucide:database" class="h-4 w-4" />
          <span class="text-sm">Databases</span>
        </div>
        <p class="mt-2 text-3xl font-semibold">
          {{ project.databases_count }}
        </p>
      </div>
    </div>

    <div
      class="flex flex-col items-center justify-center rounded-lg border border-dashed py-16 text-center"
    >
      <Icon name="lucide:rocket" class="h-12 w-12 text-muted-foreground" />
      <h3 class="mt-4 text-lg font-medium">Nothing deployed yet</h3>
      <p class="mt-1 max-w-md text-sm text-muted-foreground">
        Head over to <span class="font-medium">Applications</span>,
        <span class="font-medium">Compose</span>, or
        <span class="font-medium">Databases</span> to ship your first
        workload to this project.
      </p>
    </div>
  </div>
</template>
