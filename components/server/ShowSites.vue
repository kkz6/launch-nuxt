<script setup lang="ts">
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/card'
import { Badge } from '~/components/ui/badge'
import type { Server, Site } from '~/types'

interface Props {
  sites: Site[]
  server: Server
}

defineProps<Props>()

const applicationTypes: Record<string, string> = {
  laravel: 'Laravel',
  wordpress: 'WordPress',
  generic: 'Generic PHP',
}
</script>

<template>
  <div class="space-y-4">
    <Card class="bg-background">
      <CardHeader>
        <CardTitle class="text-xl">Sites</CardTitle>
        <CardDescription>Manage your sites on {{ server.name }}</CardDescription>
      </CardHeader>
      <CardContent class="flex flex-col gap-4">
        <div v-if="sites?.length === 0" class="flex flex-col items-center gap-3">
          <Icon name="lucide:globe-2" class="h-8 w-8 self-center text-muted-foreground" />
          <span class="text-base text-muted-foreground">No sites found</span>
          <ServerAddSite :server-id="server.id" />
        </div>

        <div v-else class="mt-4">
          <div class="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            <NuxtLink
              v-for="site in sites"
              :key="site.id"
              :to="`/servers/${server.id}/sites/${site.id}`"
              class="block"
            >
              <Card class="group relative w-full bg-transparent transition-colors hover:bg-card">
                <CardHeader>
                  <CardTitle class="flex items-center justify-between gap-2">
                    <span class="flex flex-col gap-1.5">
                      <div class="flex items-center gap-2">
                        <Icon name="lucide:globe" class="h-4 w-4 text-muted-foreground" />
                        <span class="text-base font-medium leading-none">
                          {{ site.address }}
                        </span>
                      </div>
                      <span class="text-sm font-medium text-muted-foreground">
                        {{ applicationTypes[site.type] }}
                      </span>
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent class="pt-4">
                  <div class="flex w-full flex-row justify-between gap-2 space-y-1 text-sm sm:gap-4">
                    <SharedDateTooltip :date="site.created_at">
                      <SharedInstallationStatus
                        class="mr-2"
                        :installed_at="site.installed_at"
                        :installation_failed_at="site.installation_failed_at"
                        :uninstallation_requested_at="site.uninstallation_requested_at"
                        :uninstallation_failed_at="site.uninstallation_failed_at"
                      />
                    </SharedDateTooltip>
                  </div>
                </CardContent>
              </Card>
            </NuxtLink>
          </div>
          <div class="mt-4">
            <ServerAddSite :server-id="server.id" />
          </div>
        </div>
      </CardContent>
    </Card>
  </div>
</template>
