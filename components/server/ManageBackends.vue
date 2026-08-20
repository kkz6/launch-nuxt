<script setup lang="ts">
import { toast } from "vue-sonner";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "~/components/ui/sheet";
import type { LoadBalancerUpstream, LoadBalancerBackend } from "~/types";
import { serverService } from "~/services/serverService";

interface Props {
  serverId: string;
  upstream: LoadBalancerUpstream;
}

const props = defineProps<Props>();
const { t, locale } = useI18n();
const emit = defineEmits<{
  updated: [];
}>();

const isOpen = ref(false);
const backends = ref<LoadBalancerBackend[]>(props.upstream.backends || []);
const isLoading = ref(false);
const isAdding = ref(false);
const confirmationDialog = ref<InstanceType<
  typeof import("~/components/shared/ConfirmationDialog.vue").default
> | null>(null);

// Add backend form
const newSiteId = ref("");
const newPort = ref("8080");

const fetchBackends = async () => {
  isLoading.value = true;
  try {
    const response = await serverService.loadBalancer.backends.list(
      props.serverId,
      props.upstream.id,
    );
    backends.value = response.data;
  } catch {
    toast.error(t("server.backends.loadFailed"));
  } finally {
    isLoading.value = false;
  }
};

const addBackend = async () => {
  if (!newSiteId.value.trim()) {
    toast.error(t("server.backends.siteIdRequired"));
    return;
  }

  isAdding.value = true;
  try {
    await serverService.loadBalancer.backends.add(
      props.serverId,
      props.upstream.id,
      {
        site_id: newSiteId.value.trim(),
        port: parseInt(newPort.value, 10) || 8080,
      },
    );
    toast.success(t("server.backends.addSuccess"));
    newSiteId.value = "";
    newPort.value = "8080";
    await fetchBackends();
    emit("updated");
  } catch (error: unknown) {
    const err = error as { data?: { message?: string } };
    toast.error(err.data?.message || t("server.backends.addFailed"));
  } finally {
    isAdding.value = false;
  }
};

const toggleDown = async (backend: LoadBalancerBackend) => {
  try {
    const response = await serverService.loadBalancer.backends.toggleDown(
      props.serverId,
      props.upstream.id,
      backend.id,
    );
    const idx = backends.value.findIndex((b) => b.id === backend.id);
    if (idx !== -1) {
      backends.value[idx] = response.data;
    }
    toast.success(
      response.data.is_down
        ? t("server.backends.markedDown")
        : t("server.backends.markedUp"),
    );
    emit("updated");
  } catch {
    toast.error(t("server.backends.toggleFailed"));
  }
};

const removeBackend = async (backend: LoadBalancerBackend) => {
  if (!confirmationDialog.value) return;

  const result = await confirmationDialog.value.show({
    title: t("server.backends.removeTitle"),
    description: t("server.backends.removeDescription"),
    confirmText: t("server.common.remove"),
    cancelText: t("server.common.cancel"),
    destructive: true,
  });

  if (result.ok) {
    try {
      await serverService.loadBalancer.backends.remove(
        props.serverId,
        props.upstream.id,
        backend.id,
      );
      backends.value = backends.value.filter((b) => b.id !== backend.id);
      toast.success(t("server.backends.removeSuccess"));
      emit("updated");
    } catch {
      toast.error(t("server.backends.removeFailed"));
    }
  }
};

const getStatusColor = (backend: LoadBalancerBackend) => {
  if (backend.is_down) return "bg-gray-400";
  if (backend.health_status === "healthy") return "bg-emerald-500";
  if (backend.health_status === "unhealthy") return "bg-red-500";
  return "bg-amber-500";
};

const getStatusLabel = (backend: LoadBalancerBackend) => {
  if (backend.is_down) return t("server.backends.downManual");
  if (backend.health_status === "healthy") return t("server.backends.healthy");
  if (backend.health_status === "unhealthy")
    return t("server.backends.unhealthy");
  return t("server.common.unknown");
};

const formatCheckTime = (value: string) =>
  new Date(value).toLocaleTimeString(locale.value === "ja" ? "ja-JP" : "en-US");

watch(isOpen, (open) => {
  if (open) fetchBackends();
});
</script>

<template>
  <Sheet v-model:open="isOpen">
    <SheetTrigger as-child>
      <Button variant="ghost" size="icon" class="h-8 w-8">
        <Icon name="lucide:server" class="h-4 w-4" />
      </Button>
    </SheetTrigger>
    <SheetContent class="w-full sm:max-w-lg">
      <SharedConfirmationDialog ref="confirmationDialog" />
      <SheetHeader>
        <SheetTitle>{{
          t("server.backends.title", { name: upstream.name })
        }}</SheetTitle>
      </SheetHeader>

      <div class="mt-4 space-y-6">
        <!-- Add Backend Form -->
        <div class="rounded-lg border bg-muted/30 p-4">
          <h4 class="mb-3 text-sm font-medium">
            {{ t("server.backends.add") }}
          </h4>
          <div class="space-y-3">
            <div class="space-y-1.5">
              <Label for="backend-site-id" class="text-xs">{{
                t("server.backends.siteId")
              }}</Label>
              <Input
                id="backend-site-id"
                v-model="newSiteId"
                :placeholder="t('server.backends.siteIdPlaceholder')"
                class="h-9 text-sm"
              />
            </div>
            <div class="space-y-1.5">
              <Label for="backend-port" class="text-xs">{{
                t("server.backends.port")
              }}</Label>
              <Input
                id="backend-port"
                v-model="newPort"
                placeholder="8080"
                class="h-9 text-sm"
              />
            </div>
            <Button
              size="sm"
              :disabled="isAdding || !newSiteId.trim()"
              @click="addBackend"
            >
              <Icon
                v-if="isAdding"
                name="lucide:loader-2"
                class="mr-2 h-3.5 w-3.5 animate-spin"
              />
              <Icon v-else name="lucide:plus" class="mr-2 h-3.5 w-3.5" />
              {{ t("server.common.add") }}
            </Button>
          </div>
        </div>

        <!-- Backend List -->
        <div>
          <h4 class="mb-3 text-sm font-medium">
            {{ t("server.backends.active", { count: backends.length }) }}
          </h4>

          <div v-if="isLoading" class="flex items-center justify-center py-6">
            <Icon
              name="lucide:loader-2"
              class="h-5 w-5 animate-spin text-muted-foreground"
            />
          </div>

          <div
            v-else-if="backends.length === 0"
            class="rounded-lg border border-dashed py-6 text-center"
          >
            <Icon
              name="lucide:server"
              class="mx-auto mb-2 h-8 w-8 text-muted-foreground/50"
            />
            <p class="text-sm text-muted-foreground">
              {{ t("server.backends.empty") }}
            </p>
          </div>

          <div v-else class="space-y-2">
            <div
              v-for="backend in backends"
              :key="backend.id"
              class="flex items-center justify-between rounded-lg border bg-card p-3"
            >
              <div class="min-w-0 flex-1">
                <div class="flex items-center gap-2">
                  <span
                    class="h-2 w-2 shrink-0 rounded-full"
                    :class="getStatusColor(backend)"
                  />
                  <span class="truncate text-sm font-medium">
                    {{ backend.server_id.slice(0, 8) }}
                  </span>
                  <span class="text-xs text-muted-foreground"
                    >:{{ backend.port }}</span
                  >
                </div>
                <div
                  class="mt-1 flex items-center gap-2 text-xs text-muted-foreground"
                >
                  <span>{{ getStatusLabel(backend) }}</span>
                  <span
                    v-if="backend.last_health_check_at"
                    class="text-muted-foreground/60"
                  >
                    {{
                      t("server.backends.lastChecked", {
                        time: formatCheckTime(backend.last_health_check_at),
                      })
                    }}
                  </span>
                </div>
              </div>
              <div class="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  class="h-7 w-7"
                  :title="
                    backend.is_down
                      ? t('server.backends.markUp')
                      : t('server.backends.markDown')
                  "
                  @click="toggleDown(backend)"
                >
                  <Icon
                    :name="backend.is_down ? 'lucide:play' : 'lucide:pause'"
                    class="h-3.5 w-3.5"
                  />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  class="h-7 w-7 text-muted-foreground hover:text-destructive"
                  @click="removeBackend(backend)"
                >
                  <Icon name="lucide:trash-2" class="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </SheetContent>
  </Sheet>
</template>
