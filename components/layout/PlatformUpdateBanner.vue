<script setup lang="ts">
import { X, AlertTriangle, AlertCircle, Info } from "lucide-vue-next";
import type { PlatformUpdate } from "~/types";
import { platformService } from "~/services/platformService";
import { usePlatformUpdateEvents } from "~/composables/useChannelEvents";

const { user } = useAuth();
const { t } = useI18n();
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

const localizedUpdateTitle = (update: PlatformUpdate) => {
  const key = `common.platformUpdate.updates.${update.key}.title`;
  const translated = t(key);
  return translated === key ? update.title : translated;
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
    <!-- On mobile we stack the message and the action row so the title can
         wrap freely and nothing gets clipped. On sm+ screens we go back to
         the single-line centered layout. -->
    <div
      v-for="update in updates"
      :key="update.id"
      class="flex flex-col gap-1 bg-zinc-950 px-4 py-2 text-sm text-zinc-200 sm:flex-row sm:items-center sm:justify-center sm:gap-4"
    >
      <div class="flex items-start gap-2.5 sm:items-center">
        <component
          :is="severityConfig[update.severity].icon"
          :class="[
            'mt-0.5 h-4 w-4 shrink-0 sm:mt-0',
            severityConfig[update.severity].accent,
          ]"
        />
        <div class="min-w-0 flex-1 sm:flex sm:items-center sm:gap-2">
          <span class="block break-words font-medium text-white">{{
            localizedUpdateTitle(update)
          }}</span>
          <span v-if="pendingCount(update) > 0" class="text-xs text-zinc-400">
            —
            {{
              t(
                pendingCount(update) === 1
                  ? "common.platformUpdate.pendingOne"
                  : "common.platformUpdate.pendingMany",
                { count: pendingCount(update) },
              )
            }}
          </span>
        </div>
      </div>
      <div class="flex items-center justify-end gap-3 sm:gap-4">
        <NuxtLink
          :to="`/platform/updates/${update.id}`"
          class="text-xs font-medium text-zinc-300 underline underline-offset-2 hover:text-white"
        >
          {{ t("common.platformUpdate.viewDetails") }}
        </NuxtLink>
        <button
          class="rounded p-0.5 text-zinc-500 hover:text-zinc-300"
          :aria-label="t('common.platformUpdate.dismiss')"
          @click="dismiss(update)"
        >
          <X class="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  </div>
</template>
