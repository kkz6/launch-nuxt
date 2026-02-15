<script setup lang="ts">
import { X, AlertTriangle, AlertCircle, Info } from "lucide-vue-next";
import type { PlatformUpdate } from "~/types";
import { platformService } from "~/services/platformService";
import { usePlatformUpdateEvents } from "~/composables/useChannelEvents";

const { user } = useAuth();
const updates = ref<PlatformUpdate[]>([]);

const teamId = computed(() => user.value?.current_team_id?.toString() || "");

const severityConfig = {
  critical: {
    accent: "text-red-400",
    icon: AlertCircle,
  },
  warning: {
    accent: "text-amber-400",
    icon: AlertTriangle,
  },
  info: {
    accent: "text-blue-400",
    icon: Info,
  },
};

const pendingCount = (update: PlatformUpdate) => {
  return update.status_counts?.pending ?? 0;
};

const fetchUpdates = async () => {
  try {
    const response = await platformService.listPendingUpdates();
    if (response.success) {
      updates.value = response.data;
    }
  } catch {
    // Silently fail - banner is non-critical
  }
};

const dismiss = async (update: PlatformUpdate) => {
  try {
    await platformService.dismissUpdate(update.id);
    updates.value = updates.value.filter((u) => u.id !== update.id);
  } catch {
    // Silently fail
  }
};

usePlatformUpdateEvents(teamId, () => {
  fetchUpdates();
});

onMounted(() => {
  fetchUpdates();
});
</script>

<template>
  <div v-if="updates.length > 0" class="flex shrink-0 flex-col">
    <div
      v-for="update in updates"
      :key="update.id"
      class="flex items-center justify-center gap-4 bg-zinc-950 px-4 py-2 text-sm text-zinc-200"
    >
      <div class="flex items-center gap-2.5">
        <component
          :is="severityConfig[update.severity].icon"
          :class="['h-4 w-4 shrink-0', severityConfig[update.severity].accent]"
        />
        <span class="font-medium text-white">{{ update.title }}</span>
        <span v-if="pendingCount(update) > 0" class="text-xs text-zinc-400">
          — {{ pendingCount(update) }} server{{ pendingCount(update) !== 1 ? "s" : "" }} pending
        </span>
      </div>
      <NuxtLink
        :to="`/platform/updates/${update.id}`"
        class="text-xs font-medium text-zinc-300 underline underline-offset-2 hover:text-white"
      >
        View Details
      </NuxtLink>
      <button
        class="rounded p-0.5 text-zinc-500 hover:text-zinc-300"
        @click="dismiss(update)"
      >
        <X class="h-3.5 w-3.5" />
      </button>
    </div>
  </div>
</template>
