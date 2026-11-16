<script setup lang="ts">
import { toast } from "vue-sonner";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Switch } from "~/components/ui/switch";
import { useSystemUpdateEvents } from "~/composables/useChannelEvents";
import {
  serverService,
  type SystemUpdateStatus,
  type ServerRestartStatus,
} from "~/services/serverService";

const props = defineProps<{ serverId: string }>();
const { t, locale } = useI18n();
const { canEdit, canDelete: canRestart } = useCan();
const { user } = useAuth();
const teamId = computed(() => user.value?.current_team_id?.toString() || "");

const status = ref<SystemUpdateStatus | null>(null);
const loading = ref(false);
const saving = ref(false);
const loadFailed = ref(false);
const enabled = ref(false);
const schedule = ref("03:00");
const notifications = ref(false);
let request = 0;
let refreshPending = false;
const confirmation = ref<InstanceType<
  typeof import("~/components/shared/ConfirmationDialog.vue").default
> | null>(null);
const restart = ref<ServerRestartStatus>({ status: "idle" });
const restartLoading = ref(false);
const restartLoadFailed = ref(false);
const operation = ref<"restart" | "repair" | "retry" | "recheck" | null>(null);
const actionError = ref("");
const logs = ref<string | null>(null);
const logsLoading = ref(false);
const logsFailed = ref(false);
const copied = ref(false);
let restartRequest = 0;
let logsRequest = 0;
const installCommand =
  "sudo apt-get update && sudo apt-get install unattended-upgrades";
const restartPending = computed(() =>
  ["queued", "restarting", "verifying"].includes(restart.value.status),
);
const controlsBusy = computed(
  () =>
    loading.value ||
    saving.value ||
    !!operation.value ||
    !!status.value?.running ||
    restartPending.value,
);
const canRunUpdates = computed(
  () =>
    canEdit.value &&
    !controlsBusy.value &&
    status.value?.updater_installed !== false,
);
const restartVisible = computed(
  () => restart.value.status !== "idle" || restartLoadFailed.value,
);
const restartCompletedLabel = computed(() =>
  restart.value.completed_at
    ? new Intl.DateTimeFormat(locale.value, {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "UTC",
      }).format(new Date(restart.value.completed_at)) + " UTC"
    : "",
);

const validSchedule = computed(() =>
  /^(?:[01][0-9]|2[0-3]):[0-5][0-9]$/.test(schedule.value),
);
const changed = computed(
  () =>
    status.value &&
    (enabled.value !== status.value.enabled ||
      schedule.value !== status.value.schedule ||
      notifications.value !== status.value.notifications),
);
const lastRun = computed(() => status.value?.last_run);
const lastRunLabel = computed(() =>
  lastRun.value
    ? new Intl.DateTimeFormat(locale.value, {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "UTC",
      }).format(new Date(lastRun.value.finished_at)) + " UTC"
    : t("server.settings.systemUpdates.neverRun"),
);

const runState = computed(() => {
  if (status.value?.running)
    return { label: "running", style: "bg-muted text-foreground" };
  if (status.value?.enabled && !status.value.timer_active) {
    return {
      label: "timerInactive",
      style: "bg-destructive/10 text-destructive",
    };
  }
  if (lastRun.value?.status === "failed") {
    return { label: "runFailed", style: "bg-destructive/10 text-destructive" };
  }
  if (status.value?.enabled)
    return {
      label: "scheduled",
      style: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
    };
  if (status.value?.native_enabled)
    return { label: "osManaged", style: "bg-muted text-foreground" };
  return { label: "off", style: "bg-muted text-muted-foreground" };
});

function applyStatus(value: SystemUpdateStatus, preserveDraft = false) {
  const keepDraft = preserveDraft && changed.value;
  status.value = value;
  if (keepDraft) return;
  enabled.value = value.enabled;
  schedule.value = value.schedule;
  notifications.value = value.notifications;
}

async function load(background = false) {
  if (saving.value || operation.value || (background && loading.value)) {
    refreshPending = true;
    return;
  }
  const version = ++request;
  if (!background) loading.value = true;
  try {
    const response = await serverService.systemUpdates.get(props.serverId);
    if (version !== request) return;
    applyStatus(response.data, background);
    loadFailed.value = false;
  } catch {
    if (version === request) loadFailed.value = true;
  } finally {
    if (version === request) {
      loading.value = false;
      reconcilePending();
    }
  }
}

const refreshStatus = useLiveRefresh(() => load(true));
function reconcilePending() {
  if (!refreshPending) return;
  refreshPending = false;
  refreshStatus();
}
useSystemUpdateEvents(
  teamId,
  (data, event) => {
    if (data.server_id !== props.serverId) return;
    if (event === "server.reboot.updated") refreshRestart();
    else refreshStatus();
  },
  {
    onReconnect: () => {
      refreshStatus();
      refreshRestart();
    },
  },
);

async function save() {
  if (
    !canEdit.value ||
    !changed.value ||
    !validSchedule.value ||
    controlsBusy.value
  )
    return;
  const version = ++request;
  saving.value = true;
  try {
    const response = await serverService.systemUpdates.save(props.serverId, {
      enabled: enabled.value,
      schedule: schedule.value,
      notifications: notifications.value,
    });
    if (version !== request) return;
    applyStatus(response.data);
    loadFailed.value = false;
    actionError.value = "";
    toast.success(t("server.settings.systemUpdates.saved"));
  } catch (error: unknown) {
    if (version !== request) return;
    const response = error as { data?: { message?: string } };
    actionError.value =
      response.data?.message || t("server.settings.systemUpdates.saveFailed");
    toast.error(actionError.value);
  } finally {
    if (version === request) {
      saving.value = false;
      reconcilePending();
    }
  }
}

async function loadRestart() {
  const version = ++restartRequest;
  restartLoading.value = true;
  try {
    const response = await serverService.rebootStatus(props.serverId);
    if (version !== restartRequest) return;
    const previous = restart.value.status;
    restart.value = response.data;
    restartLoadFailed.value = false;
    if (
      previous !== restart.value.status &&
      ["succeeded", "failed"].includes(restart.value.status)
    )
      refreshStatus();
  } catch {
    if (version === restartRequest) restartLoadFailed.value = true;
  } finally {
    if (version === restartRequest) restartLoading.value = false;
  }
}
const refreshRestart = useLiveRefresh(loadRestart);

async function restartServer() {
  if (
    !canRestart.value ||
    controlsBusy.value ||
    restartLoadFailed.value ||
    !confirmation.value
  )
    return;
  const serverId = props.serverId;
  const scope = teamId.value;
  const result = await confirmation.value.show({
    title: t("server.settings.systemUpdates.restart.confirmTitle"),
    description: t("server.settings.systemUpdates.restart.confirmDescription"),
    confirmText: t("server.settings.systemUpdates.restart.action"),
    destructive: true,
  });
  if (
    !result.ok ||
    serverId !== props.serverId ||
    scope !== teamId.value ||
    controlsBusy.value
  )
    return;
  const version = ++request;
  operation.value = "restart";
  actionError.value = "";
  try {
    await serverService.reboot(serverId);
    if (version !== request) return;
    restart.value = { status: "queued" };
    await loadRestart();
  } catch (error) {
    if (version !== request) return;
    actionError.value = errorMessage(error, "restart.requestFailed");
    await loadRestart();
    if (restartPending.value || restart.value.status === "succeeded")
      actionError.value = "";
  } finally {
    if (version === request) {
      operation.value = null;
      reconcilePending();
    }
  }
}

async function verifyRestart() {
  if (!canRestart.value || controlsBusy.value || !restart.value.can_verify)
    return;
  const version = ++request;
  operation.value = "recheck";
  actionError.value = "";
  try {
    const response = await serverService.verifyReboot(props.serverId);
    if (version !== request) return;
    restartRequest++;
    restart.value = response.data;
    restartLoadFailed.value = false;
    restartLoading.value = false;
  } catch (error) {
    if (version === request)
      actionError.value = errorMessage(error, "restart.unavailableDescription");
  } finally {
    if (version === request) {
      operation.value = null;
      reconcilePending();
    }
  }
}

function errorMessage(error: unknown, key: string) {
  return (
    (error as { data?: { message?: string } })?.data?.message ||
    t(`server.settings.systemUpdates.${key}`)
  );
}

async function remedy(action: "repair" | "retry") {
  if (!canRunUpdates.value) return;
  const version = ++request;
  operation.value = action;
  actionError.value = "";
  try {
    const response = await serverService.systemUpdates[action](props.serverId);
    if (version !== request) return;
    applyStatus(response.data, true);
    loadFailed.value = false;
    toast.success(
      t(`server.settings.systemUpdates.remedies.${action}Accepted`),
    );
  } catch (error) {
    if (version === request)
      actionError.value = errorMessage(error, "remedies.actionFailed");
  } finally {
    if (version === request) {
      operation.value = null;
      reconcilePending();
    }
  }
}

async function viewLogs() {
  if (logsLoading.value || restartPending.value) return;
  const version = ++logsRequest;
  logsLoading.value = true;
  logsFailed.value = false;
  try {
    const response = await serverService.systemUpdates.logs(props.serverId);
    if (version === logsRequest) logs.value = response.data.logs;
  } catch {
    if (version === logsRequest) logsFailed.value = true;
  } finally {
    if (version === logsRequest) logsLoading.value = false;
  }
}

async function copyInstallCommand() {
  try {
    await navigator.clipboard.writeText(installCommand);
    copied.value = true;
  } catch {
    copied.value = false;
    actionError.value = t("server.settings.systemUpdates.remedies.copyFailed");
  }
}

function enableUpdates() {
  if (!canEdit.value || controlsBusy.value) return;
  enabled.value = true;
  document.getElementById("system-updates-schedule")?.focus();
}

onMounted(() => {
  void load();
  void loadRestart();
});
watch([() => props.serverId, teamId], () => {
  status.value = null;
  restart.value = { status: "idle" };
  operation.value = null;
  saving.value = false;
  loadFailed.value = false;
  restartLoadFailed.value = false;
  actionError.value = "";
  logs.value = null;
  logsFailed.value = false;
  logsLoading.value = false;
  logsRequest++;
  refreshPending = false;
  void load();
  void loadRestart();
});
onBeforeUnmount(() => {
  request++;
  restartRequest++;
  logsRequest++;
});
</script>

<template>
  <section class="space-y-6" aria-labelledby="system-updates-title">
    <SharedConfirmationDialog ref="confirmation" />
    <header class="flex flex-wrap items-start justify-between gap-4">
      <div class="min-w-0">
        <h2 id="system-updates-title" class="text-lg font-medium">
          {{ t("server.settings.systemUpdates.title") }}
        </h2>
        <p v-if="status?.supported" class="text-sm text-muted-foreground">
          {{
            lastRun
              ? t("server.settings.systemUpdates.lastRun", {
                  time: lastRunLabel,
                })
              : lastRunLabel
          }}
        </p>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <span
          v-if="status?.supported"
          class="rounded-full px-2.5 py-1 text-xs font-medium"
          :class="runState.style"
          role="status"
        >
          {{ t(`server.settings.systemUpdates.state.${runState.label}`) }}
        </span>
        <Button
          variant="outline"
          size="sm"
          :disabled="loading || saving || !!operation"
          @click="
            load(true);
            loadRestart();
          "
        >
          <Icon
            name="lucide:refresh-cw"
            class="mr-2 size-3.5"
            :class="{ 'animate-spin': loading }"
            aria-hidden="true"
          />
          {{ t("server.settings.systemUpdates.refresh") }}
        </Button>
      </div>
    </header>

    <div
      v-if="loading && !status"
      class="rounded-lg border bg-muted/50 p-4 text-sm text-muted-foreground"
      role="status"
    >
      {{ t("server.settings.systemUpdates.loading") }}
    </div>
    <div
      v-if="loadFailed && !restartPending && !restartLoading"
      class="rounded-lg border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive"
      role="alert"
    >
      <p>{{ t("server.settings.systemUpdates.loadFailed") }}</p>
      <p class="mt-1">
        {{ t("server.settings.systemUpdates.remedies.connection") }}
      </p>
      <Button
        variant="outline"
        size="sm"
        class="mt-3"
        :disabled="loading || saving || !!operation"
        @click="
          load(true);
          loadRestart();
        "
        >{{
          t("server.settings.systemUpdates.remedies.retryConnection")
        }}</Button
      >
    </div>
    <div
      v-if="actionError"
      class="rounded-lg border border-destructive/20 bg-destructive/5 p-4 text-sm"
      role="alert"
    >
      <p class="text-destructive">{{ actionError }}</p>
      <p class="mt-1 text-muted-foreground">
        {{ t("server.settings.systemUpdates.remedies.actionGuidance") }}
      </p>
      <Button
        variant="outline"
        size="sm"
        class="mt-3"
        :disabled="loading || saving || !!operation"
        @click="
          load(true);
          loadRestart();
        "
        >{{ t("server.settings.systemUpdates.refresh") }}</Button
      >
    </div>
    <div
      v-if="restartVisible"
      class="rounded-lg border bg-card p-4 text-sm"
      aria-live="polite"
      data-testid="restart-progress"
    >
      <div class="flex items-center gap-2 font-medium">
        <Icon
          :name="
            restartPending
              ? 'lucide:loader-circle'
              : restart.status === 'succeeded'
                ? 'lucide:circle-check'
                : 'lucide:circle-alert'
          "
          class="size-4"
          :class="{
            'animate-spin': restartPending,
            'text-emerald-600': restart.status === 'succeeded',
            'text-destructive': restart.status === 'failed',
          }"
          aria-hidden="true"
        />
        <span>{{
          t(
            `server.settings.systemUpdates.restart.${restart.status === "idle" ? "unavailable" : restart.status}`,
          )
        }}</span>
      </div>
      <p class="mt-1 text-muted-foreground">
        {{
          t(
            `server.settings.systemUpdates.restart.${restart.status === "idle" ? "unavailable" : restart.status === "failed" && !restart.can_verify ? "requestRejected" : restart.status}Description`,
          )
        }}
      </p>
      <p
        v-if="restart.status === 'failed' && restart.message"
        class="mt-2 text-destructive"
      >
        {{ restart.message }}
      </p>
      <p
        v-if="restartCompletedLabel"
        class="mt-2 text-xs text-muted-foreground"
      >
        {{ restartCompletedLabel }}
      </p>
      <p
        v-if="restart.status === 'failed' && !canRestart"
        class="mt-2 text-muted-foreground"
      >
        {{ t("server.settings.systemUpdates.restart.askAdmin") }}
      </p>
      <p v-if="restartLoadFailed" class="mt-2 text-muted-foreground">
        {{ t("server.settings.systemUpdates.restart.unavailableDescription") }}
      </p>
      <div class="mt-3 flex flex-wrap items-center gap-2">
        <Button
          v-if="restart.status === 'failed' && restart.can_verify && canRestart"
          variant="outline"
          size="sm"
          :disabled="controlsBusy"
          @click="verifyRestart"
          >{{ t("server.settings.systemUpdates.restart.verifyAgain") }}</Button
        >
        <Button
          v-else
          variant="outline"
          size="sm"
          :disabled="restartLoading"
          @click="loadRestart()"
          >{{ t("server.settings.systemUpdates.restart.checkStatus") }}</Button
        >
        <Button
          v-if="
            restart.status === 'failed' && !restart.can_verify && canRestart
          "
          variant="outline"
          size="sm"
          :disabled="controlsBusy || restartLoadFailed"
          @click="restartServer"
          >{{ t("server.settings.systemUpdates.restart.retry") }}</Button
        >
      </div>
    </div>
    <div
      v-if="status && !status.supported"
      class="rounded-lg border bg-muted/50 p-4 text-sm text-muted-foreground"
    >
      <p>{{ t("server.settings.systemUpdates.unsupported") }}</p>
      <p class="mt-1">
        {{ t("server.settings.systemUpdates.remedies.unsupported") }}
      </p>
    </div>

    <div v-if="status?.supported" class="space-y-6">
      <dl class="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div class="rounded-lg border bg-muted/50 p-4">
          <dt class="text-sm font-medium text-muted-foreground">
            {{ t("server.settings.systemUpdates.securityPatches") }}
          </dt>
          <dd class="mt-1 text-xl font-semibold tabular-nums">
            {{ status.security_patches_this_month }}
          </dd>
          <dd class="text-xs text-muted-foreground">
            {{ t("server.settings.systemUpdates.thisMonth") }}
          </dd>
        </div>
        <div class="rounded-lg border bg-muted/50 p-4">
          <dt class="text-sm font-medium text-muted-foreground">
            {{ t("server.settings.systemUpdates.pendingReboot") }}
          </dt>
          <dd
            class="mt-1 text-xl font-semibold"
            :class="
              status.reboot_required
                ? 'text-amber-700 dark:text-amber-400'
                : 'text-emerald-700 dark:text-emerald-400'
            "
          >
            {{
              t(
                status.reboot_required
                  ? "server.settings.systemUpdates.rebootRequired"
                  : "server.settings.systemUpdates.noReboot",
              )
            }}
          </dd>
          <dd v-if="status.reboot_required" class="mt-2 space-y-2 text-sm">
            <p class="text-muted-foreground">
              {{
                t("server.settings.systemUpdates.restart.requiredDescription")
              }}
            </p>
            <Button
              v-if="
                canRestart &&
                !(restart.status === 'failed' && restart.can_verify)
              "
              variant="outline"
              size="sm"
              :disabled="controlsBusy || restartLoadFailed || restartLoading"
              @click="restartServer"
              >{{ t("server.settings.systemUpdates.restart.action") }}</Button
            >
            <p v-if="!canRestart" class="text-xs text-muted-foreground">
              {{ t("server.settings.systemUpdates.restart.askAdmin") }}
            </p>
            <p
              v-else-if="restart.status === 'failed' && restart.can_verify"
              class="text-xs text-muted-foreground"
            >
              {{ t("server.settings.systemUpdates.restart.failedDescription") }}
            </p>
          </dd>
        </div>
      </dl>

      <div
        v-if="status.running && !restartPending"
        class="rounded-lg border bg-muted/50 p-4 text-sm"
        role="status"
      >
        <p class="font-medium">
          {{ t("server.settings.systemUpdates.remedies.updateRunning") }}
        </p>
        <p class="mt-1 text-muted-foreground">
          {{ t("server.settings.systemUpdates.remedies.waitForUpdates") }}
        </p>
        <Button
          variant="outline"
          size="sm"
          class="mt-3"
          :disabled="logsLoading"
          @click="viewLogs"
          >{{ t("server.settings.systemUpdates.remedies.viewLogs") }}</Button
        >
      </div>
      <div
        v-if="status.updater_installed === false"
        class="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 text-sm"
        role="alert"
      >
        <p class="font-medium">
          {{ t("server.settings.systemUpdates.remedies.updaterMissing") }}
        </p>
        <p class="mt-1 text-muted-foreground">
          {{ t("server.settings.systemUpdates.remedies.installGuidance") }}
        </p>
        <details v-if="canEdit" class="mt-3">
          <summary class="cursor-pointer font-medium">
            {{
              t("server.settings.systemUpdates.remedies.installInstructions")
            }}
          </summary>
          <code
            class="mt-3 block overflow-x-auto rounded bg-muted p-3 text-xs"
            >{{ installCommand }}</code
          >
          <div class="mt-3 flex flex-wrap gap-2">
            <Button variant="outline" size="sm" @click="copyInstallCommand">{{
              t(
                `server.settings.systemUpdates.remedies.${copied ? "copied" : "copyCommand"}`,
              )
            }}</Button>
            <Button
              variant="outline"
              size="sm"
              :disabled="controlsBusy"
              @click="load(true)"
              >{{ t("server.settings.systemUpdates.refresh") }}</Button
            >
          </div>
        </details>
        <p v-else class="mt-2 text-muted-foreground">
          {{ t("server.settings.systemUpdates.remedies.askEditor") }}
        </p>
      </div>
      <div
        v-if="status.enabled && !status.timer_active && !status.running"
        class="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 text-sm"
        role="alert"
      >
        <p class="font-medium">
          {{ t("server.settings.systemUpdates.state.timerInactive") }}
        </p>
        <p class="mt-1 text-muted-foreground">
          {{ t("server.settings.systemUpdates.remedies.repairDescription") }}
        </p>
        <Button
          v-if="canEdit"
          variant="outline"
          size="sm"
          class="mt-3"
          :disabled="!canRunUpdates"
          @click="remedy('repair')"
          >{{ t("server.settings.systemUpdates.remedies.repair") }}</Button
        >
        <p v-else class="mt-2 text-muted-foreground">
          {{ t("server.settings.systemUpdates.remedies.askEditor") }}
        </p>
      </div>
      <div
        v-if="lastRun?.status === 'failed' && !status.running"
        class="rounded-lg border border-destructive/20 bg-destructive/5 p-4 text-sm"
        role="alert"
      >
        <p class="font-medium">
          {{ t("server.settings.systemUpdates.state.runFailed") }}
        </p>
        <p class="mt-1 text-muted-foreground">
          {{ t("server.settings.systemUpdates.remedies.failedDescription") }}
        </p>
        <div class="mt-3 flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            :disabled="logsLoading || restartPending"
            @click="viewLogs"
            >{{ t("server.settings.systemUpdates.remedies.viewLogs") }}</Button
          >
          <Button
            v-if="canEdit"
            variant="outline"
            size="sm"
            :disabled="!canRunUpdates"
            @click="remedy('retry')"
            >{{ t("server.settings.systemUpdates.remedies.retry") }}</Button
          >
        </div>
        <p v-if="!canEdit" class="mt-2 text-muted-foreground">
          {{ t("server.settings.systemUpdates.remedies.askEditor") }}
        </p>
      </div>
      <div
        v-if="!status.enabled && !status.native_enabled && !status.running"
        class="rounded-lg border bg-muted/50 p-4 text-sm"
      >
        <p>{{ t("server.settings.systemUpdates.remedies.offDescription") }}</p>
        <Button
          v-if="canEdit"
          variant="outline"
          size="sm"
          class="mt-3"
          :disabled="controlsBusy || status.updater_installed === false"
          @click="enableUpdates"
          >{{ t("server.settings.systemUpdates.remedies.enable") }}</Button
        >
        <p v-else class="mt-2 text-muted-foreground">
          {{ t("server.settings.systemUpdates.remedies.askEditor") }}
        </p>
      </div>
      <div
        v-if="logs !== null || logsLoading || logsFailed"
        class="rounded-lg border bg-card p-4 text-sm"
        aria-live="polite"
      >
        <div class="flex items-center justify-between gap-3">
          <h3 class="font-medium">
            {{ t("server.settings.systemUpdates.remedies.logsTitle") }}
          </h3>
          <Button
            variant="outline"
            size="sm"
            :disabled="logsLoading || restartPending"
            @click="viewLogs"
            >{{ t("server.settings.systemUpdates.refresh") }}</Button
          >
        </div>
        <p v-if="logsLoading" class="mt-2 text-muted-foreground">
          {{ t("server.settings.systemUpdates.remedies.logsLoading") }}
        </p>
        <p v-if="logsFailed" class="mt-2 text-destructive">
          {{ t("server.settings.systemUpdates.remedies.logsFailed") }}
        </p>
        <pre
          v-if="logs"
          class="mt-3 max-h-80 overflow-auto whitespace-pre-wrap break-all rounded bg-muted p-3 text-xs"
          >{{ logs }}</pre
        >
        <p
          v-else-if="logs !== null && !logsLoading"
          class="mt-2 text-muted-foreground"
        >
          {{ t("server.settings.systemUpdates.remedies.logsEmpty") }}
        </p>
      </div>

      <form class="divide-y rounded-lg border bg-card" @submit.prevent="save">
        <div class="flex items-center justify-between gap-4 p-4">
          <div class="space-y-1">
            <Label for="system-updates-enabled">{{
              t("server.settings.systemUpdates.automatic")
            }}</Label>
            <p
              id="system-updates-description"
              class="text-sm text-muted-foreground"
            >
              {{
                t(
                  status.native_enabled
                    ? "server.settings.systemUpdates.nativeDescription"
                    : "server.settings.systemUpdates.automaticDescription",
                )
              }}
            </p>
          </div>
          <Switch
            id="system-updates-enabled"
            v-model="enabled"
            aria-describedby="system-updates-description"
            :disabled="!canEdit || controlsBusy"
          />
        </div>
        <div class="flex flex-wrap items-center justify-between gap-3 p-4">
          <div class="space-y-1">
            <Label for="system-updates-schedule">{{
              t("server.settings.systemUpdates.maintenance")
            }}</Label>
            <p
              id="system-updates-schedule-description"
              class="text-sm text-muted-foreground"
            >
              {{ t("server.settings.systemUpdates.maintenanceDescription") }}
            </p>
          </div>
          <Input
            id="system-updates-schedule"
            v-model="schedule"
            type="time"
            required
            class="w-36"
            aria-describedby="system-updates-schedule-description"
            :disabled="!canEdit || !enabled || controlsBusy"
          />
        </div>
        <div class="flex items-center justify-between gap-4 p-4">
          <div class="space-y-1">
            <Label for="system-updates-notify">{{
              t("server.settings.systemUpdates.notifications")
            }}</Label>
            <p
              id="system-updates-notify-description"
              class="text-sm text-muted-foreground"
            >
              {{ t("server.settings.systemUpdates.notificationsDescription") }}
            </p>
          </div>
          <Switch
            id="system-updates-notify"
            v-model="notifications"
            aria-describedby="system-updates-notify-description"
            :disabled="!canEdit || controlsBusy"
          />
        </div>
        <div v-if="canEdit" class="flex justify-end p-4">
          <Button
            type="submit"
            :disabled="!changed || !validSchedule || controlsBusy"
          >
            {{
              t(
                saving
                  ? "server.settings.systemUpdates.saving"
                  : "server.settings.systemUpdates.save",
              )
            }}
          </Button>
        </div>
      </form>

      <details v-if="lastRun" class="rounded-lg border bg-card text-sm">
        <summary class="cursor-pointer px-4 py-3 font-medium">
          {{ t("server.settings.systemUpdates.latestReport") }}
        </summary>
        <div class="space-y-2 border-t p-4">
          <p>
            {{
              t(
                lastRun.status === "failed"
                  ? "server.settings.systemUpdates.runFailedDetails"
                  : "server.settings.systemUpdates.runSucceededDetails",
              )
            }}
          </p>
          <ul
            v-if="lastRun.packages?.length"
            class="list-inside list-disc space-y-1 break-all font-mono text-muted-foreground"
          >
            <li
              v-for="pkg in lastRun.packages"
              :key="`${pkg.name}@${pkg.version}`"
            >
              {{ pkg.name }} {{ pkg.version }}
            </li>
          </ul>
          <p v-else class="text-muted-foreground">
            {{ t("server.settings.systemUpdates.noPackagesUpgraded") }}
          </p>
        </div>
      </details>

      <div class="space-y-2">
        <h3 class="text-sm font-semibold">
          {{ t("server.settings.systemUpdates.recentlyUpdated") }}
        </h3>
        <ul
          v-if="status.recently_updated?.length"
          class="divide-y rounded-lg border bg-card"
        >
          <li
            v-for="pkg in status.recently_updated"
            :key="`${pkg.name}@${pkg.version}`"
            class="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-4 py-3 text-sm"
          >
            <span class="flex min-w-0 items-center gap-2 font-mono">
              <Icon
                name="lucide:check"
                class="size-4 shrink-0 text-emerald-600 dark:text-emerald-400"
                aria-hidden="true"
              />
              <span class="break-all">{{ pkg.name }}</span>
            </span>
            <span class="break-all font-mono text-muted-foreground">{{
              pkg.version
            }}</span>
          </li>
        </ul>
        <p
          v-else
          class="rounded-lg border border-dashed p-4 text-sm text-muted-foreground"
        >
          {{ t("server.settings.systemUpdates.emptyHistory") }}
        </p>
      </div>
    </div>
  </section>
</template>
