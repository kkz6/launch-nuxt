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
      <CardContent class="sm:divide-y sm:divide-gray-200">
        <SharedDefinitionListItem label="Address">
          <span>{{ site.url }}</span>
          <a :href="site.url" target="_blank" rel="noreferrer" class="ml-1">
            <Icon name="lucide:arrow-right-circle" class="h-5 w-5 text-gray-700 dark:text-gray-100" />
          </a>
        </SharedDefinitionListItem>

        <SharedDefinitionListItem label="Server">
          <NuxtLink :to="`/servers/${server.id}`" class="underline">
            {{ server.name }}
          </NuxtLink>
        </SharedDefinitionListItem>

        <SharedDefinitionListItem label="Path">
          <span class="break-all pr-4">{{ site.path }}</span>
        </SharedDefinitionListItem>

        <SharedDefinitionListItem v-if="site.php_version" label="PHP Version">
          {{ phpVersions[site.php_version] || site.php_version }}
        </SharedDefinitionListItem>

        <SharedDefinitionListItem label="Type">
          {{ applicationTypes[site.type] }}
        </SharedDefinitionListItem>

        <SharedDefinitionListItem label="SSL">
          {{ site.tls_setting }}
        </SharedDefinitionListItem>

        <SharedDefinitionListItem v-if="site.source_control_repository?.html_url" label="Repository">
          {{ site.source_control_repository.html_url }}
          <a :href="site.source_control_repository.html_url" target="_blank" rel="noreferrer" class="ml-1">
            <Icon name="lucide:arrow-right-circle" class="h-5 w-5 text-gray-700 dark:text-gray-100" />
          </a>
        </SharedDefinitionListItem>
      </CardContent>
    </Card>
  </div>
</template>
