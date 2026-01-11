<script setup lang="ts">
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card'
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
</script>

<template>
  <div class="space-y-4">
    <Card class="space-y-2 bg-background">
      <CardHeader class="pb-0">
        <CardTitle>Site Overview</CardTitle>
      </CardHeader>
      <CardContent class="divide-y divide-border">
        <div class="flex flex-col gap-1 py-4 sm:flex-row sm:items-center sm:justify-between">
          <span class="text-sm font-medium text-muted-foreground">Address</span>
          <div class="flex items-center gap-1">
            <span>{{ site.url }}</span>
            <a :href="site.url" target="_blank" rel="noreferrer" class="ml-1">
              <Icon name="lucide:arrow-right-circle" class="h-5 w-5 text-gray-700 dark:text-gray-100" />
            </a>
          </div>
        </div>

        <div class="flex flex-col gap-1 py-4 sm:flex-row sm:items-center sm:justify-between">
          <span class="text-sm font-medium text-muted-foreground">Server</span>
          <NuxtLink :to="`/servers/${server.id}`" class="underline">
            {{ server.name }}
          </NuxtLink>
        </div>

        <div class="flex flex-col gap-1 py-4 sm:flex-row sm:items-center sm:justify-between">
          <span class="text-sm font-medium text-muted-foreground">Path</span>
          <span class="break-all pr-4">{{ site.path }}</span>
        </div>

        <div v-if="site.php_version" class="flex flex-col gap-1 py-4 sm:flex-row sm:items-center sm:justify-between">
          <span class="text-sm font-medium text-muted-foreground">PHP Version</span>
          <span>{{ phpVersions[site.php_version] || site.php_version }}</span>
        </div>

        <div class="flex flex-col gap-1 py-4 sm:flex-row sm:items-center sm:justify-between">
          <span class="text-sm font-medium text-muted-foreground">Type</span>
          <span>{{ applicationTypes[site.type] }}</span>
        </div>

        <div class="flex flex-col gap-1 py-4 sm:flex-row sm:items-center sm:justify-between">
          <span class="text-sm font-medium text-muted-foreground">SSL</span>
          <span>{{ site.tls_setting }}</span>
        </div>

        <div v-if="site.source_control_repository?.html_url" class="flex flex-col gap-1 py-4 sm:flex-row sm:items-center sm:justify-between">
          <span class="text-sm font-medium text-muted-foreground">Repository</span>
          <div class="flex items-center gap-1">
            <span class="break-all">{{ site.source_control_repository.html_url }}</span>
            <a :href="site.source_control_repository.html_url" target="_blank" rel="noreferrer" class="ml-1">
              <Icon name="lucide:arrow-right-circle" class="h-5 w-5 text-gray-700 dark:text-gray-100" />
            </a>
          </div>
        </div>
      </CardContent>
    </Card>
  </div>
</template>
