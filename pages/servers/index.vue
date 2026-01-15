<script setup lang="ts">
import { Server as ServerIcon, LoaderCircle } from "lucide-vue-next";
import { Card, CardFooter, CardHeader, CardTitle } from "~/components/ui/card";
import type { Server } from "~/types";
import { serverService } from "~/services/serverService";

definePageMeta({
  layout: "default",
  middleware: "auth",
});

useHead({
  title: "Servers",
});

const servers = ref<Server[]>([]);
const isLoading = ref(true);

const serviceProviders: Record<string, string> = {
  digitalocean: "DigitalOcean",
  hetzner: "Hetzner",
  linode: "Linode",
  vultr: "Vultr",
  aws: "AWS",
  custom_server: "Custom",
};

const serverStatus: Record<string, string> = {
  running: "Running",
  provisioning: "Provisioning",
  new: "Creating",
  starting: "Starting",
  failed: "Failed",
  deleting: "Deleting",
  unknown: "Unknown",
};

const formatDate = (dateString: string) => {
  if (!dateString) return "";
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "today";
  if (diffDays === 1) return "yesterday";
  if (diffDays < 30) return `${diffDays} days ago`;
  if (diffDays < 365) {
    const months = Math.floor(diffDays / 30);
    return `${months} ${months === 1 ? "month" : "months"} ago`;
  }
  const years = Math.floor(diffDays / 365);
  return `${years} ${years === 1 ? "year" : "years"} ago`;
};

onMounted(async () => {
  try {
    const response = await serverService.list();
    servers.value = response.data;
  } catch {
    // Handle error silently
  } finally {
    isLoading.value = false;
  }
});
</script>

<template>
  <div>
    <div v-if="isLoading" class="flex items-center justify-center py-12">
      <Icon
        name="lucide:loader-2"
        class="h-8 w-8 animate-spin text-muted-foreground"
      />
    </div>

    <div
      v-else-if="servers.length === 0"
      class="mt-6 flex h-[50vh] w-full flex-col items-center justify-center space-y-4"
    >
      <ServerIcon class="size-10 text-muted-foreground md:size-28" />
      <span>No servers added yet. Click on Create server.</span>
    </div>

    <div
      v-else
      class="mt-6 grid w-full flex-wrap gap-5 sm:grid-cols-2 lg:grid-cols-3"
    >
            <NuxtLink
              v-for="server in servers"
              :key="server.id"
              :to="server.status === 'running' ? `/servers/${server.id}` : '#'"
              class="w-full lg:max-w-md"
              :class="{ 'pointer-events-none': server.status !== 'running' }"
            >
              <Card
                class="group relative w-full transition-colors"
                :class="[
                  server.status === 'failed' || server.status === 'unknown'
                    ? 'bg-gray-700/10'
                    : 'bg-transparent hover:bg-card',
                ]"
              >
                <!-- Provisioning progress bar -->
                <div
                  v-if="server.status === 'provisioning'"
                  class="pointer-events-none absolute inset-0 animate-pulse rounded-lg bg-green-500/20 opacity-20 transition-all ease-in-out"
                  :style="{ width: `${server.progress || 0}%` }"
                />

                <CardHeader>
                  <CardTitle
                    class="relative flex items-center justify-between gap-2"
                  >
                    <span class="flex flex-col gap-1.5">
                      <div class="flex items-center gap-2">
                        <ServerIcon class="size-4 text-muted-foreground" />
                        <span class="text-base font-medium leading-none">
                          {{ server.name }}
                        </span>
                      </div>
                      <span class="text-sm font-medium text-muted-foreground">
                        {{ server.provider_label || serviceProviders[server.provider] || server.provider }}
                      </span>
                      <span class="text-sm font-medium text-muted-foreground">
                        {{ server.public_ipv4 }}
                      </span>
                    </span>
                  </CardTitle>
                </CardHeader>

                <CardFooter class="relative pt-4">
                  <div
                    class="flex w-full flex-row justify-between gap-2 text-sm max-sm:flex-wrap sm:gap-4"
                  >
                    <!-- Provisioning/Creating/Failed status -->
                    <template
                      v-if="
                        server.status === 'provisioning' ||
                        server.status === 'new' ||
                        server.status === 'failed' ||
                        server.status === 'deleting'
                      "
                    >
                      <div
                        class="flex w-full flex-col justify-between gap-1 text-sm max-sm:flex-wrap"
                      >
                        <div class="flex items-center space-x-2">
                          <LoaderCircle
                            v-if="server.status !== 'failed'"
                            class="h-4 w-4 animate-spin"
                          />
                          <span>{{
                            serverStatus[server.status] || server.status
                          }}</span>
                        </div>
                        <span class="text-muted-foreground">
                          Created {{ formatDate(server.created_at) }}
                        </span>
                      </div>
                    </template>

                    <!-- Running status -->
                    <template v-else-if="server.status === 'running'">
                      <div
                        class="flex w-full flex-row justify-between gap-2 text-sm max-sm:flex-wrap sm:gap-4"
                      >
                        <div class="flex flex-col">
                          <span>{{ server.status_label || serverStatus[server.status] }}</span>
                          <span class="text-muted-foreground">
                            Provisioned {{ formatDate(server.provisioned_at) }}
                          </span>
                        </div>
                        <span>
                          {{ server.services_count ?? server.sites_count ?? 0 }}
                          {{ (server.services_count ?? server.sites_count ?? 0) === 1 ? "site" : "sites" }}
                        </span>
                      </div>
                    </template>

                    <!-- Other status -->
                    <template v-else>
                      <div class="flex flex-col">
                        <span>{{ server.status_label || serverStatus[server.status] || server.status }}</span>
                      </div>
                      <span>
                        {{ server.services_count ?? server.sites_count ?? 0 }}
                        {{ (server.services_count ?? server.sites_count ?? 0) === 1 ? "site" : "sites" }}
                      </span>
                    </template>
                  </div>
                </CardFooter>
              </Card>
            </NuxtLink>
    </div>
  </div>
</template>
