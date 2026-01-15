<script setup lang="ts">
import { Globe2 } from "lucide-vue-next";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import type { Server, Site } from "~/types";

interface Props {
  sites: Site[];
  server: Server;
}

defineProps<Props>();

const applicationTypes: Record<string, string> = {
  laravel: "Laravel",
  wordpress: "WordPress",
  generic: "Generic PHP",
};

const isAccessible = (site: Site) => {
  return Boolean(site.installed_at) && !site.uninstallation_requested_at;
};

const getStatusDate = (site: Site) => {
  // Use installed_at for installed sites, otherwise use created_at
  return site.installed_at || site.created_at;
};
</script>

<template>
  <div>
    <div class="mb-4 flex items-center justify-between">
      <ServerAddSite :server-id="server.id" />
    </div>

    <div
      v-if="sites?.length === 0"
      class="flex h-[50vh] w-full flex-col items-center justify-center space-y-4"
    >
      <Globe2 class="size-10 text-muted-foreground md:size-28" />
      <span>No sites found. Click on Add Site.</span>
    </div>

    <div v-else class="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      <template v-for="site in sites" :key="site.id">
        <NuxtLink
          v-if="isAccessible(site)"
          :to="`/servers/${server.id}/sites/${site.id}`"
          class="block"
        >
          <Card
            class="group relative w-full bg-transparent transition-colors hover:bg-card"
          >
            <CardHeader>
              <CardTitle class="flex items-center justify-between gap-2">
                <span class="flex flex-col gap-1.5">
                  <div class="flex items-center gap-2">
                    <Icon
                      name="lucide:globe"
                      class="h-4 w-4 text-muted-foreground"
                    />
                    <span class="text-base font-medium leading-none">
                      {{ site.address }}
                    </span>
                  </div>
                  <span class="text-sm font-medium text-muted-foreground">
                    {{ applicationTypes[site.type] || site.type }}
                  </span>
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent class="pt-4">
              <div
                class="flex w-full flex-row justify-between gap-2 text-sm sm:gap-4"
              >
                <SharedDateTooltip :date="getStatusDate(site)">
                  <SharedInstallationStatus
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

        <!-- Non-accessible site (installing or uninstalling) -->
        <div v-else class="block">
          <Card
            class="group relative w-full cursor-not-allowed bg-transparent opacity-60"
          >
            <CardHeader>
              <CardTitle class="flex items-center justify-between gap-2">
                <span class="flex flex-col gap-1.5">
                  <div class="flex items-center gap-2">
                    <Icon
                      name="lucide:globe"
                      class="h-4 w-4 text-muted-foreground"
                    />
                    <span class="text-base font-medium leading-none">
                      {{ site.address }}
                    </span>
                  </div>
                  <span class="text-sm font-medium text-muted-foreground">
                    {{ applicationTypes[site.type] || site.type }}
                  </span>
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent class="pt-4">
              <div
                class="flex w-full flex-row justify-between gap-2 text-sm sm:gap-4"
              >
                <SharedDateTooltip :date="getStatusDate(site)">
                  <SharedInstallationStatus
                    :installed_at="site.installed_at"
                    :installation_failed_at="site.installation_failed_at"
                    :uninstallation_requested_at="site.uninstallation_requested_at"
                    :uninstallation_failed_at="site.uninstallation_failed_at"
                  />
                </SharedDateTooltip>
              </div>
            </CardContent>
          </Card>
        </div>
      </template>
    </div>
  </div>
</template>
