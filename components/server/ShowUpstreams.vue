<script setup lang="ts">
import { toast } from "vue-sonner";
import { useLoadBalancerEvents } from "~/composables/useChannelEvents";
import type { LoadBalancerUpstream, Server } from "~/types";
import { serverService } from "~/services/serverService";

interface Props {
  server: Server;
}

const props = defineProps<Props>();
const { t } = useI18n();

const upstreams = ref<LoadBalancerUpstream[]>([]);
const isLoading = ref(true);
const confirmationDialog = ref<InstanceType<
  typeof import("~/components/shared/ConfirmationDialog.vue").default
> | null>(null);

const { user } = useAuth();
const teamId = computed(() => user.value?.current_team_id?.toString() || "");

// Debounced refetch for WebSocket events
let upstreamFetchTimeout: ReturnType<typeof setTimeout> | null = null;

useLoadBalancerEvents(teamId, (data) => {
  if (data.server_id === props.server.id) {
    if (upstreamFetchTimeout) clearTimeout(upstreamFetchTimeout);
    upstreamFetchTimeout = setTimeout(() => fetchUpstreams(), 300);
  }
});

const fetchUpstreams = async () => {
  try {
    const response = await serverService.loadBalancer.upstreams.list(
      props.server.id,
    );
    upstreams.value = response.data;
  } catch {
    toast.error(t("server.upstreams.loadFailed"));
  } finally {
    isLoading.value = false;
  }
};

const deleteUpstream = async (upstream: LoadBalancerUpstream) => {
  if (!confirmationDialog.value) return;

  const result = await confirmationDialog.value.show({
    title: t("server.upstreams.deleteTitle"),
    description: t("server.upstreams.deleteDescription", {
      name: upstream.name,
    }),
    confirmText: t("server.common.delete"),
    cancelText: t("server.common.cancel"),
    destructive: true,
  });

  if (result.ok) {
    try {
      await serverService.loadBalancer.upstreams.delete(
        props.server.id,
        upstream.id,
      );
      upstreams.value = upstreams.value.filter((u) => u.id !== upstream.id);
      toast.success(t("server.upstreams.deleteSuccess"));
    } catch {
      toast.error(t("server.upstreams.deleteFailed"));
    }
  }
};

const getHealthBadge = (upstream: LoadBalancerUpstream) => {
  if (!upstream.backends || upstream.backends.length === 0) {
    return {
      label: t("server.upstreams.noBackends"),
      class:
        "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
    };
  }

  const healthy = upstream.backends.filter(
    (b) => b.health_status === "healthy" && !b.is_down,
  ).length;
  const total = upstream.backends.length;

  if (healthy === total) {
    return {
      label: t("server.upstreams.healthyCount", { healthy, total }),
      class:
        "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400",
    };
  }

  if (healthy === 0) {
    return {
      label: t("server.upstreams.healthyCount", { healthy, total }),
      class: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
    };
  }

  return {
    label: t("server.upstreams.healthyCount", { healthy, total }),
    class:
      "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
  };
};

const formatBackendCount = (count: number) =>
  t(
    count === 1
      ? "server.upstreams.backendCount"
      : "server.upstreams.backendsCount",
    { count },
  );

onMounted(fetchUpstreams);
</script>

<template>
  <div>
    <SharedConfirmationDialog ref="confirmationDialog" />

    <div class="mb-4 flex items-start justify-between gap-4">
      <div>
        <h3 class="text-lg font-semibold">{{ t("server.upstreams.title") }}</h3>
        <p class="text-sm text-muted-foreground">
          {{ t("server.upstreams.description") }}
        </p>
      </div>
      <ServerCreateUpstream
        v-if="upstreams.length > 0"
        :server-id="server.id"
        @created="fetchUpstreams"
      />
    </div>

    <div v-if="isLoading" class="flex items-center justify-center py-8">
      <Icon
        name="lucide:loader-2"
        class="h-6 w-6 animate-spin text-muted-foreground"
      />
    </div>

    <template v-else>
      <!-- Empty state -->
      <div
        v-if="upstreams.length === 0"
        class="flex flex-col items-center justify-center rounded-lg border border-dashed py-12"
      >
        <Icon
          name="lucide:network"
          class="mb-3 h-10 w-10 text-muted-foreground/50"
        />
        <h4 class="mb-1 text-sm font-medium">
          {{ t("server.upstreams.empty") }}
        </h4>
        <p class="mb-4 text-sm text-muted-foreground">
          {{ t("server.upstreams.emptyDescription") }}
        </p>
        <ServerCreateUpstream
          :server-id="server.id"
          @created="fetchUpstreams"
        />
      </div>

      <!-- Upstream cards -->
      <div v-else class="grid gap-4">
        <div
          v-for="upstream in upstreams"
          :key="upstream.id"
          class="rounded-lg border bg-card p-4 transition-colors hover:bg-accent/50"
        >
          <div class="flex items-start justify-between gap-4">
            <div class="min-w-0 flex-1">
              <div class="flex items-center gap-2">
                <h4 class="truncate text-sm font-semibold">
                  {{ upstream.name }}
                </h4>
                <span
                  class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
                  :class="getHealthBadge(upstream).class"
                >
                  {{ getHealthBadge(upstream).label }}
                </span>
              </div>
              <p class="mt-1 text-sm text-muted-foreground">
                {{ upstream.address }}
              </p>
              <div
                class="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground"
              >
                <span class="flex items-center gap-1">
                  <Icon name="lucide:shuffle" class="h-3.5 w-3.5" />
                  {{ upstream.lb_policy_label }}
                </span>
                <span class="flex items-center gap-1">
                  <Icon name="lucide:server" class="h-3.5 w-3.5" />
                  {{ formatBackendCount(upstream.backends?.length || 0) }}
                </span>
                <span
                  v-if="upstream.health_check_path"
                  class="flex items-center gap-1"
                >
                  <Icon name="lucide:heart-pulse" class="h-3.5 w-3.5" />
                  {{ upstream.health_check_path }}
                </span>
                <span
                  v-if="upstream.installed_at"
                  class="flex items-center gap-1"
                >
                  <Icon
                    name="lucide:check-circle"
                    class="h-3.5 w-3.5 text-emerald-500"
                  />
                  {{ t("server.upstreams.installed") }}
                </span>
                <span v-else class="flex items-center gap-1">
                  <Icon
                    name="lucide:clock"
                    class="h-3.5 w-3.5 text-amber-500"
                  />
                  {{ t("server.upstreams.pending") }}
                </span>
              </div>
            </div>
            <div class="flex items-center gap-1">
              <ServerManageBackends
                :server-id="server.id"
                :upstream="upstream"
                @updated="fetchUpstreams"
              />
              <ServerEditUpstream
                :server-id="server.id"
                :upstream="upstream"
                @updated="fetchUpstreams"
              />
              <Button
                variant="ghost"
                size="icon"
                class="h-8 w-8 text-muted-foreground hover:text-destructive"
                @click="deleteUpstream(upstream)"
              >
                <Icon name="lucide:trash-2" class="h-4 w-4" />
              </Button>
            </div>
          </div>

          <!-- Backend list preview -->
          <div
            v-if="upstream.backends && upstream.backends.length > 0"
            class="mt-3 border-t pt-3"
          >
            <div class="flex flex-wrap gap-2">
              <div
                v-for="backend in upstream.backends"
                :key="backend.id"
                class="flex items-center gap-1.5 rounded-md bg-muted px-2.5 py-1 text-xs"
              >
                <span
                  class="h-1.5 w-1.5 rounded-full"
                  :class="[
                    backend.is_down
                      ? 'bg-gray-400'
                      : backend.health_status === 'healthy'
                        ? 'bg-emerald-500'
                        : backend.health_status === 'unhealthy'
                          ? 'bg-red-500'
                          : 'bg-amber-500',
                  ]"
                />
                <span class="text-muted-foreground"
                  >{{ backend.server_id.slice(0, 8) }}:{{ backend.port }}</span
                >
                <span v-if="backend.is_down" class="text-muted-foreground/60">{{
                  t("server.upstreams.down")
                }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>
