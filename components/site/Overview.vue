<script setup lang="ts">
import type { Server, Site } from '~/types'

interface Props {
  server: Server
  site: Site
}

const props = defineProps<Props>()

const applicationTypes: Record<string, string> = {
  laravel: 'Laravel',
  wordpress: 'WordPress',
  generic: 'Generic PHP',
}

const phpVersions: Record<string, string> = {
  php74: 'PHP 7.4',
  php80: 'PHP 8.0',
  php81: 'PHP 8.1',
  php82: 'PHP 8.2',
  php83: 'PHP 8.3',
}

const applicationIcons: Record<string, string> = {
  laravel: 'logos:laravel',
  wordpress: 'logos:wordpress-icon',
  generic: 'logos:php',
}
</script>

<template>
  <div>
    <h3 class="mb-4 text-lg font-semibold">Site Details</h3>
    <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <!-- Address -->
      <div class="flex items-start gap-3 rounded-lg border bg-card p-4">
        <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
          <Icon name="lucide:globe" class="h-5 w-5 text-primary" />
        </div>
        <div class="min-w-0 flex-1">
          <p class="text-sm text-muted-foreground">Address</p>
          <a
            :href="site.url"
            target="_blank"
            rel="noreferrer"
            class="flex items-center gap-1 text-sm font-medium text-foreground hover:underline"
          >
            <span class="truncate">{{ site.address }}</span>
            <Icon name="lucide:external-link" class="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          </a>
        </div>
      </div>

      <!-- Application Type -->
      <div class="flex items-start gap-3 rounded-lg border bg-card p-4">
        <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-orange-500/10">
          <Icon :name="applicationIcons[site.type] || 'lucide:code'" class="h-5 w-5" />
        </div>
        <div class="min-w-0 flex-1">
          <p class="text-sm text-muted-foreground">Application</p>
          <p class="text-sm font-medium text-foreground">{{ applicationTypes[site.type] }}</p>
        </div>
      </div>

      <!-- PHP Version -->
      <div v-if="site.php_version" class="flex items-start gap-3 rounded-lg border bg-card p-4">
        <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-violet-500/10">
          <Icon name="logos:php" class="h-5 w-5" />
        </div>
        <div class="min-w-0 flex-1">
          <p class="text-sm text-muted-foreground">PHP Version</p>
          <p class="text-sm font-medium text-foreground">{{ phpVersions[site.php_version] || site.php_version }}</p>
        </div>
      </div>

      <!-- SSL -->
      <div class="flex items-start gap-3 rounded-lg border bg-card p-4">
        <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-green-500/10">
          <Icon name="lucide:shield-check" class="h-5 w-5 text-green-500" />
        </div>
        <div class="min-w-0 flex-1">
          <p class="text-sm text-muted-foreground">SSL</p>
          <p class="text-sm font-medium capitalize text-foreground">{{ site.tls_setting || 'None' }}</p>
        </div>
      </div>

      <!-- Path -->
      <div class="flex items-start gap-3 rounded-lg border bg-card p-4">
        <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-500/10">
          <Icon name="lucide:folder" class="h-5 w-5 text-amber-500" />
        </div>
        <div class="min-w-0 flex-1">
          <p class="text-sm text-muted-foreground">Path</p>
          <p class="truncate text-sm font-medium text-foreground" :title="site.path">{{ site.path }}</p>
        </div>
      </div>

      <!-- Repository -->
      <div v-if="site.source_control_repository?.html_url" class="flex items-start gap-3 rounded-lg border bg-card p-4 sm:col-span-2 lg:col-span-3">
        <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gray-500/10">
          <Icon name="lucide:git-branch" class="h-5 w-5 text-gray-500" />
        </div>
        <div class="min-w-0 flex-1">
          <p class="text-sm text-muted-foreground">Repository</p>
          <a
            :href="site.source_control_repository.html_url"
            target="_blank"
            rel="noreferrer"
            class="flex items-center gap-1 text-sm font-medium text-foreground hover:underline"
          >
            <span class="truncate">{{ site.source_control_repository.html_url }}</span>
            <Icon name="lucide:external-link" class="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          </a>
        </div>
      </div>
    </div>
  </div>
</template>
