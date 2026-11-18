<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { toast } from "vue-sonner";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { sourceControlService } from "~/services/sourceControlService";
import {
  githubConnectionService,
  type GitHubConnectionAttempt,
  type GitHubRepositoryChoice,
} from "~/services/githubConnectionService";
import { useGitRequestScope } from "~/composables/useGitRequestScope";
import type { SourceControl } from "~/types";

const { t } = useI18n();
const route = useRoute();
const router = useRouter();
const { canManageTeam } = useCan();
const connections = ref<SourceControl[]>([]);
const loading = ref(true);
const busy = ref(false);
const error = ref("");
const attempt = ref<GitHubConnectionAttempt | null>(null);
const installationId = ref("");
const candidates = ref<GitHubRepositoryChoice[]>([]);
const selectedIds = ref<string[]>([]);
const generation = ref<number>();
const selectionVersion = ref<number>();
const search = ref("");
const candidatesLoading = ref(false);
const candidatesLoaded = ref(false);
const authorizeConnection = ref<string | null | undefined>(undefined);
const acknowledged = ref(false);
const disconnectConnection = ref<SourceControl | null>(null);
const confirmationDialog = ref<InstanceType<
  typeof import("~/components/shared/ConfirmationDialog.vue").default
> | null>(null);

const clearAttemptQuery = () => {
  if (!route.query.github_attempt && !route.query.github_error) return;
  const query = { ...route.query };
  delete query.github_attempt;
  delete query.github_error;
  void router.replace({ query });
};

const resetSelection = () => {
  attemptRequest.cancel();
  candidateRequest.cancel();
  attempt.value = null;
  installationId.value = "";
  candidates.value = [];
  selectedIds.value = [];
  generation.value = undefined;
  selectionVersion.value = undefined;
  candidatesLoaded.value = false;
  candidatesLoading.value = false;
  search.value = "";
};

const scope = useGitRequestScope(() => {
  connections.value = [];
  resetSelection();
  authorizeConnection.value = undefined;
  acknowledged.value = false;
  disconnectConnection.value = null;
  busy.value = false;
  error.value = "";
  clearAttemptQuery();
  void loadConnections();
});
const { user } = scope;
const listRequest = scope.channel();
const attemptRequest = scope.channel();
const candidateRequest = scope.channel(() => installationId.value);
const mutationRequest = scope.channel();
const teamId = computed(() => String(user.value?.current_team_id ?? ""));
const teamName = computed(
  () =>
    user.value?.current_team?.name ||
    t("settings.connections.gitAccess.chooseWorkspace"),
);
const visibleCandidates = computed(() => {
  const value = search.value.trim().toLowerCase();
  return candidates.value.filter((repo) =>
    repo.full_name.toLowerCase().includes(value),
  );
});

const showError = (fallback: string) => {
  error.value = t(`settings.connections.gitAccess.${fallback}`);
};

const loadConnections = async () => {
  const request = listRequest.start();
  loading.value = true;
  if (!teamId.value || !scope.ready.value) {
    connections.value = [];
    loading.value = false;
    return;
  }
  try {
    const response = await sourceControlService.list(request.signal);
    if (request.isCurrent())
      connections.value = response.data.filter(
        (item) => item.provider === "github",
      );
  } catch {
    if (request.isCurrent()) showError("loadFailed");
  } finally {
    if (request.isCurrent()) loading.value = false;
  }
};

const openAuthorization = (connectionId?: string) => {
  if (!canManageTeam.value || !scope.ready.value) return;
  error.value = "";
  acknowledged.value = false;
  authorizeConnection.value = connectionId ?? null;
};

const visitGitHub = async (value: string) => {
  const url = new URL(value);
  if (url.origin !== "https://github.com" || url.username || url.password)
    throw new Error("Invalid GitHub destination");
  await navigateTo(url.toString(), { external: true });
};

const beginAuthorization = async () => {
  if (
    !canManageTeam.value ||
    !acknowledged.value ||
    !scope.ready.value ||
    authorizeConnection.value === undefined ||
    busy.value
  )
    return;
  const request = mutationRequest.start();
  busy.value = true;
  error.value = "";
  try {
    const response = await githubConnectionService.start(
      authorizeConnection.value ?? undefined,
      true,
      request.signal,
    );
    if (!request.isCurrent()) return;
    if (String(response.data.team_id) !== teamId.value)
      throw new Error("Workspace changed");
    await visitGitHub(response.data.url);
  } catch {
    if (request.isCurrent()) showError("authorizeFailed");
  } finally {
    if (request.isCurrent()) busy.value = false;
  }
};

const loadAttempt = async (id: string) => {
  resetSelection();
  if (!canManageTeam.value || !scope.ready.value) return;
  const request = attemptRequest.start();
  busy.value = true;
  error.value = "";
  try {
    const response = await githubConnectionService.attempt(id, request.signal);
    if (!request.isCurrent()) return;
    if (String(response.data.team_id) !== teamId.value)
      throw new Error("Workspace changed");
    if (response.data.status === "completed") {
      clearAttemptQuery();
      await loadConnections();
      return;
    }
    attempt.value = response.data;
    generation.value = response.data.connection_generation;
    selectionVersion.value = response.data.selection_version;
    // A single installation is still explicitly reviewed before its selection is saved.
    if (response.data.installations?.length === 1) {
      installationId.value = String(response.data.installations[0]!.id);
      await loadCandidates();
    }
  } catch {
    if (request.isCurrent()) showError("attemptFailed");
  } finally {
    if (request.isCurrent()) busy.value = false;
  }
};

const loadCandidates = async () => {
  const currentAttempt = attempt.value;
  candidates.value = [];
  selectedIds.value = [];
  candidatesLoaded.value = false;
  const request = candidateRequest.start();
  if (
    !currentAttempt ||
    currentAttempt.status !== "authorized" ||
    !installationId.value
  )
    return;
  candidatesLoading.value = true;
  error.value = "";
  try {
    const response = await githubConnectionService.candidates(
      currentAttempt.attempt_id,
      installationId.value,
      request.signal,
    );
    if (
      !request.isCurrent() ||
      attempt.value?.attempt_id !== currentAttempt.attempt_id
    )
      return;
    candidates.value = response.data.repositories;
    selectedIds.value = response.data.repositories
      .filter((repo) => repo.selected && !repo.unavailable)
      .map((repo) => repo.github_repository_id);
    generation.value =
      response.data.connection_generation ??
      currentAttempt.connection_generation;
    selectionVersion.value = response.data.selection_version ?? currentAttempt.selection_version;
    candidatesLoaded.value = true;
  } catch {
    if (request.isCurrent()) showError("candidatesFailed");
  } finally {
    if (request.isCurrent()) candidatesLoading.value = false;
  }
};

const saveSelection = async () => {
  if (
    !canManageTeam.value ||
    !scope.ready.value ||
    !attempt.value ||
    !candidatesLoaded.value ||
    candidatesLoading.value ||
    busy.value
  )
    return;
  const request = mutationRequest.start();
  const currentAttempt = attempt.value;
  if (currentAttempt.source_control_id && (generation.value === undefined || selectionVersion.value === undefined)) {
    showError("attemptFailed");
    return;
  }
  busy.value = true;
  error.value = "";
  try {
    const removed = candidates.value.filter(
      (repo) =>
        repo.selected && !selectedIds.value.includes(repo.github_repository_id),
    );
    if (removed.length) {
      if (!confirmationDialog.value) return;
      const affected = [...new Set(removed.flatMap((repo) => repo.affected_workloads ?? []).map((workload) => `${t(`settings.connections.gitAccess.kind.${workload.kind}`)}: ${workload.name}`))];
      const result = await confirmationDialog.value.show({
        title: t("settings.connections.gitAccess.removeTitle"),
        description: t("settings.connections.gitAccess.removeDescription", {
          repositories: removed.map((repo) => repo.full_name).join(", "),
          team: teamName.value,
        }) + (affected.length ? `\n\n${t("settings.connections.gitAccess.affectedWorkloads", { workloads: affected.join(", ") })}` : ""),
        confirmText: t("settings.connections.gitAccess.removeConfirm"),
        cancelText: t("settings.connections.cancel"),
        destructive: true,
      });
      if (!result.ok || !request.isCurrent()) return;
    }
    if (!canManageTeam.value || !scope.ready.value || attempt.value?.attempt_id !== currentAttempt.attempt_id) return;
    await githubConnectionService.select(
      currentAttempt.attempt_id,
      installationId.value,
      [...selectedIds.value],
      generation.value,
      selectionVersion.value,
      request.signal,
    );
    if (!request.isCurrent()) return;
    resetSelection();
    clearAttemptQuery();
    toast.success(t("settings.connections.gitAccess.saved"));
    await loadConnections();
  } catch {
    if (request.isCurrent()) showError("saveFailed");
  } finally {
    if (request.isCurrent()) busy.value = false;
  }
};

const disconnect = async (connection: SourceControl) => {
  if (!canManageTeam.value || !scope.ready.value || !confirmationDialog.value || busy.value) return;
  const currentContext = scope.contextKey.value;
  disconnectConnection.value = connection;
  const result = await confirmationDialog.value.show({
    title: t("settings.connections.gitAccess.disconnect"),
    description: t("settings.connections.gitAccess.disconnectDescription", {
      account: connection.login,
      team: teamName.value,
    }),
    confirmText: t("settings.connections.gitAccess.disconnect"),
    cancelText: t("settings.connections.cancel"),
    destructive: true,
  });
  if (
    !result.ok ||
    !canManageTeam.value ||
    !scope.ready.value ||
    currentContext !== scope.contextKey.value ||
    disconnectConnection.value?.id !== connection.id
  )
    return;
  const request = mutationRequest.start();
  busy.value = true;
  try {
    await githubConnectionService.disconnect(connection.id, request.signal);
    if (!request.isCurrent()) return;
    resetSelection();
    clearAttemptQuery();
    toast.success(t("settings.connections.gitAccess.disconnected"));
    await loadConnections();
  } catch {
    if (request.isCurrent()) showError("disconnectFailed");
  } finally {
    if (request.isCurrent()) busy.value = false;
  }
};

const callbackError = computed(() => {
  const code = route.query.github_error;
  if (!code) return "";
  const known = [
    "access_denied",
    "session_required",
    "invalid_callback",
    "connection_failed",
  ];
  return t(
    `settings.connections.gitAccess.callback.${typeof code === "string" && known.includes(code) ? code : "connection_failed"}`,
  );
});

watch(
  () => route.query.github_attempt,
  (id) => {
    if (typeof id === "string" && id) void loadAttempt(id);
  },
);
onMounted(() => {
  void loadConnections();
  if (typeof route.query.github_attempt === "string")
    void loadAttempt(route.query.github_attempt);
});
</script>

<template>
  <section class="px-6 pb-6" aria-labelledby="git-connections-title">
    <SharedConfirmationDialog ref="confirmationDialog" />
    <h3 id="git-connections-title" class="text-base font-semibold">
      {{ t("settings.connections.git.title") }}
    </h3>
    <p class="mt-1 text-sm font-medium">
      {{ t("settings.connections.gitAccess.destination", { team: teamName }) }}
    </p>
    <p class="mb-4 mt-1 text-sm text-muted-foreground">
      {{ t("settings.connections.gitAccess.isolationHelp") }}
    </p>
    <p
      v-if="callbackError || error"
      role="alert"
      class="mb-3 rounded-md border border-destructive/40 p-3 text-sm text-destructive"
    >
      {{ error || callbackError }}
    </p>
    <p v-if="!teamId" class="text-sm text-muted-foreground">
      {{ t("settings.connections.gitAccess.chooseWorkspace") }}
    </p>
    <div
      v-else-if="loading"
      role="status"
      class="py-4 text-sm text-muted-foreground"
    >
      {{ t("settings.connections.gitAccess.loading") }}
    </div>
    <div v-else class="space-y-3">
      <p
        v-if="!connections.length"
        class="rounded-lg border p-4 text-sm text-muted-foreground"
      >
        {{ t("settings.connections.gitAccess.empty") }}
      </p>
      <article
        v-for="connection in connections"
        :key="connection.id"
        class="rounded-lg border p-4"
      >
        <div class="flex flex-wrap items-center gap-2">
          <Icon name="simple-icons:github" class="h-4 w-4" />
          <span class="text-sm font-medium">{{ connection.login }}</span>
          <Badge variant="outline">{{
            t("settings.connections.gitAccess.selectedCount", {
              count: connection.repository_count,
            })
          }}</Badge>
          <Badge
            v-if="connection.status && connection.status !== 'active'"
            variant="secondary"
            >{{
              t(`settings.connections.gitAccess.status.${connection.status}`)
            }}</Badge
          >
        </div>
        <p
          v-if="connection.cleanup_pending"
          class="mt-2 text-sm text-muted-foreground"
        >
          {{ t("settings.connections.gitAccess.cleanupPending") }}
        </p>
        <div v-if="canManageTeam" class="mt-3 flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            :disabled="busy"
            @click="openAuthorization(connection.id)"
            >{{ t("settings.connections.gitAccess.manageSelection") }}</Button
          >
          <Button
            v-if="connection.status !== 'disconnected'"
            variant="ghost"
            size="sm"
            :disabled="busy"
            @click="disconnect(connection)"
            >{{ t("settings.connections.gitAccess.disconnect") }}</Button
          >
        </div>
      </article>
      <Button
        v-if="canManageTeam"
        variant="outline"
        :disabled="busy"
        @click="openAuthorization()"
        ><Icon name="simple-icons:github" class="mr-2 h-4 w-4" />{{
          t("settings.connections.gitAccess.connect")
        }}</Button
      >
    </div>

    <div
      v-if="attempt && canManageTeam"
      class="mt-5 space-y-4 rounded-lg border p-4"
      data-testid="github-selection"
    >
      <h4 class="text-sm font-semibold">
        {{
          t("settings.connections.gitAccess.selectTitle", { team: teamName })
        }}
      </h4>
      <p class="text-sm text-muted-foreground">
        {{ t("settings.connections.gitAccess.selectionHelp") }}
      </p>
      <p v-if="attempt.status !== 'authorized'" role="status" class="text-sm">
        {{ t("settings.connections.gitAccess.awaitingAuthorization") }}
      </p>
      <template v-else>
        <label class="block text-sm font-medium" for="github-installation">{{
          t("settings.connections.gitAccess.githubAccount")
        }}</label>
        <select
          id="github-installation"
          v-model="installationId"
          class="h-10 w-full rounded-md border bg-background px-3 text-sm"
          :disabled="busy"
          @change="loadCandidates"
        >
          <option value="">
            {{ t("settings.connections.gitAccess.selectInstallation") }}
          </option>
          <option
            v-for="installation in attempt.installations"
            :key="installation.id"
            :value="String(installation.id)"
          >
            {{ installation.account_login }}
          </option>
        </select>
        <template v-if="installationId">
          <label for="github-repository-search" class="sr-only">{{
            t("settings.connections.gitAccess.search")
          }}</label>
          <input
            id="github-repository-search"
            v-model="search"
            type="search"
            :placeholder="t('settings.connections.gitAccess.search')"
            class="h-9 w-full rounded-md border bg-background px-3 text-sm"
          >
          <p v-if="candidatesLoading" role="status" class="text-sm">
            {{ t("settings.connections.gitAccess.loading") }}
          </p>
          <div v-else class="max-h-64 space-y-1 overflow-y-auto">
            <label
              v-for="repo in visibleCandidates"
              :key="repo.github_repository_id"
              class="flex items-center gap-3 rounded-md p-2 text-sm hover:bg-muted"
            >
              <input
                v-model="selectedIds"
                type="checkbox"
                :value="repo.github_repository_id"
                :disabled="busy || repo.unavailable"
                :aria-label="repo.full_name"
              >
              <span class="break-all">{{ repo.full_name }}</span>
              <span v-if="repo.unavailable" class="text-xs text-muted-foreground">{{ t("settings.connections.gitAccess.unavailable") }}</span>
              <Icon
                v-if="repo.private"
                name="lucide:lock-keyhole"
                class="h-3.5 w-3.5 shrink-0 text-muted-foreground"
              />
            </label>
            <p
              v-if="candidatesLoaded && !visibleCandidates.length"
              class="text-sm text-muted-foreground"
            >
              {{ t("settings.connections.gitAccess.noCandidates") }}
            </p>
          </div>
          <p class="text-sm text-muted-foreground">
            {{
              t("settings.connections.gitAccess.selectedCount", {
                count: selectedIds.length,
              })
            }}
          </p>
          <p v-if="!selectedIds.length && candidatesLoaded" class="text-sm">
            {{ t("settings.connections.gitAccess.zeroAccess") }}
          </p>
        </template>
      </template>
      <div class="flex flex-wrap gap-2">
        <Button
          :disabled="busy || candidatesLoading || !candidatesLoaded"
          @click="saveSelection"
          >{{ t("settings.connections.gitAccess.save") }}</Button
        >
        <Button
          v-if="attempt.install_url"
          variant="outline"
          :disabled="busy"
          @click="visitGitHub(attempt.install_url)"
          >{{ t("settings.connections.gitAccess.manageGitHub") }}</Button
        >
        <Button
          variant="ghost"
          :disabled="busy"
          @click="
            resetSelection();
            clearAttemptQuery();
          "
          >{{ t("settings.connections.cancel") }}</Button
        >
      </div>
      <p v-if="attempt.install_url" class="text-xs text-muted-foreground">
        {{ t("settings.connections.gitAccess.githubAccessHelp") }}
      </p>
    </div>

    <Dialog
      :open="authorizeConnection !== undefined"
      @update:open="
        (open) => {
          if (!open && !busy) authorizeConnection = undefined;
        }
      "
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{{
            t("settings.connections.gitAccess.confirmDestination")
          }}</DialogTitle>
          <DialogDescription>{{
            t("settings.connections.gitAccess.destinationHelp", {
              team: teamName,
            })
          }}</DialogDescription>
        </DialogHeader>
        <label class="flex items-start gap-3 text-sm"
          ><input
            v-model="acknowledged"
            type="checkbox"
            class="mt-1"
            :disabled="busy"
          >{{
            t("settings.connections.gitAccess.acknowledge", { team: teamName })
          }}</label
        >
        <DialogFooter
          ><Button
            :disabled="busy || !acknowledged || !teamId"
            @click="beginAuthorization"
            >{{ t("settings.connections.gitAccess.continueGitHub") }}</Button
          ></DialogFooter
        >
      </DialogContent>
    </Dialog>
  </section>
</template>
