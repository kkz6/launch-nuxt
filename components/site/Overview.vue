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
      <CardContent class="sm:divide-y sm:divide-border">
        <SharedDefinitionListItem label="Address">
          <span class="text-foreground">{{ site.url }}</span>
          <a :href="site.url" target="_blank" rel="noreferrer" class="ml-1">
            <Icon name="lucide:arrow-right-circle" class="h-5 w-5 text-muted-foreground" />
          </a>
        </SharedDefinitionListItem>

        <SharedDefinitionListItem label="Server">
          <NuxtLink :to="`/servers/${server.id}`" class="text-foreground underline hover:text-foreground/80">
            {{ server.name }}
          </NuxtLink>
        </SharedDefinitionListItem>

        <SharedDefinitionListItem label="Path">
          <span class="break-all pr-4 text-foreground">{{ site.path }}</span>
        </SharedDefinitionListItem>

        <SharedDefinitionListItem v-if="site.php_version" label="PHP Version">
          <span class="text-foreground">{{ phpVersions[site.php_version] || site.php_version }}</span>
        </SharedDefinitionListItem>

        <SharedDefinitionListItem label="Type">
          <span class="text-foreground">{{ applicationTypes[site.type] }}</span>
        </SharedDefinitionListItem>

        <SharedDefinitionListItem label="SSL">
          <span class="text-foreground">{{ site.tls_setting }}</span>
        </SharedDefinitionListItem>

        <SharedDefinitionListItem v-if="site.source_control_repository?.html_url" label="Repository">
          <span class="text-foreground">{{ site.source_control_repository.html_url }}</span>
          <a :href="site.source_control_repository.html_url" target="_blank" rel="noreferrer" class="ml-1">
            <Icon name="lucide:arrow-right-circle" class="h-5 w-5 text-muted-foreground" />
          </a>
        </SharedDefinitionListItem>
      </CardContent>
    </Card>
  </div>
</template>
