<script setup lang="ts">
import { toast } from "vue-sonner";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import type { UserSession } from "~/types";

const sessions = ref<UserSession[]>([]);
const { locale, t } = useI18n();
const relativeTime = computed(
  () => new Intl.RelativeTimeFormat(locale.value, { numeric: "always" }),
);
const isLoading = ref(false);
const confirmationDialog = ref<InstanceType<
  typeof import("~/components/shared/ConfirmationDialog.vue").default
> | null>(null);

const fetchSessions = async () => {
  isLoading.value = true;
  try {
    const response = await $api<{ data: UserSession[] }>("/user/sessions");
    sessions.value = response.data || [];
  } catch {
    toast.error(t("settings.sessions.loadFailed"));
  } finally {
    isLoading.value = false;
  }
};

const revokeSession = async (id: string) => {
  if (!confirmationDialog.value) return;

  const result = await confirmationDialog.value.show({
    title: t("settings.sessions.revokeTitle"),
    description: t("settings.sessions.revokeDescription"),
    confirmText: t("settings.sessions.revoke"),
    cancelText: t("settings.sessions.cancel"),
    destructive: true,
  });

  if (!result.ok) return;

  try {
    await $api(`/user/sessions/${id}`, { method: "DELETE" });
    toast.success(t("settings.sessions.revoked"));
    await fetchSessions();
  } catch {
    toast.error(t("settings.sessions.revokeFailed"));
  }
};

const revokeOtherSessions = async () => {
  if (!confirmationDialog.value) return;

  const otherCount = sessions.value.filter((s) => !s.is_current_device).length;
  if (otherCount === 0) {
    toast.info(t("settings.sessions.noneToRevoke"));
    return;
  }

  const result = await confirmationDialog.value.show({
    title: t("settings.sessions.logoutOthersTitle"),
    description: t("settings.sessions.logoutOthersDescription", {
      count: otherCount,
      unit: t(
        otherCount === 1
          ? "settings.sessions.session"
          : "settings.sessions.sessions",
      ),
    }),
    confirmText: t("settings.sessions.logoutOthers"),
    cancelText: t("settings.sessions.cancel"),
    destructive: true,
  });

  if (!result.ok) return;

  try {
    await $api("/user/sessions", { method: "DELETE" });
    toast.success(t("settings.sessions.othersRevoked"));
    await fetchSessions();
  } catch {
    toast.error(t("settings.sessions.othersRevokeFailed"));
  }
};

const deviceIcon = (session: UserSession) => {
  if (!session.agent.is_desktop) return "lucide:smartphone";
  return "lucide:monitor";
};

const formatLastActive = (dateStr: string) => {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return t("settings.sessions.justNow");
  if (diffMins < 60) return relativeTime.value.format(-diffMins, "minute");
  if (diffHours < 24) return relativeTime.value.format(-diffHours, "hour");
  if (diffDays < 7) return relativeTime.value.format(-diffDays, "day");
  return date.toLocaleDateString(locale.value);
};

onMounted(fetchSessions);
</script>

<template>
  <div class="space-y-4">
    <SharedConfirmationDialog ref="confirmationDialog" />

    <div
      v-if="isLoading && sessions.length === 0"
      class="py-4 text-center text-sm text-muted-foreground"
    >
      {{ t("settings.sessions.loading") }}
    </div>

    <template v-else>
      <div v-if="sessions.length > 1" class="flex justify-end">
        <Button variant="outline" size="sm" @click="revokeOtherSessions">
          {{ t("settings.sessions.logoutOthersTitle") }}
        </Button>
      </div>

      <div v-if="sessions.length > 0" class="space-y-3">
        <div
          v-for="session in sessions"
          :key="session.id"
          class="flex items-center justify-between rounded-lg border p-3"
        >
          <div class="flex items-center gap-3">
            <Icon
              :name="deviceIcon(session)"
              class="block size-5 text-muted-foreground"
            />
            <div>
              <div class="flex items-center gap-2 text-sm font-medium">
                {{
                  t("settings.sessions.deviceLabel", {
                    browser: session.agent.browser,
                    platform: session.agent.platform,
                  })
                }}
                <Badge
                  v-if="session.is_current_device"
                  variant="secondary"
                  class="text-xs"
                >
                  {{ t("settings.sessions.thisDevice") }}
                </Badge>
              </div>
              <div class="text-xs text-muted-foreground">
                {{ session.ip_address }} &middot;
                {{ formatLastActive(session.last_active) }}
              </div>
            </div>
          </div>

          <Button
            v-if="!session.is_current_device"
            variant="ghost"
            size="sm"
            class="text-destructive hover:text-destructive"
            @click="revokeSession(session.id)"
          >
            {{ t("settings.sessions.revoke") }}
          </Button>
        </div>
      </div>

      <div v-else class="py-4 text-center text-muted-foreground">
        <Icon
          name="lucide:shield"
          class="mx-auto mb-2 block size-8 opacity-50"
        />
        <p class="text-sm">{{ t("settings.sessions.empty") }}</p>
      </div>
    </template>
  </div>
</template>
