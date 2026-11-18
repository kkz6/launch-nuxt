<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { toast } from "vue-sonner";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";
import { Avatar, AvatarFallback } from "~/components/ui/avatar";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Checkbox } from "~/components/ui/checkbox";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { ScrollArea } from "~/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
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
const reviewedConnectionId = ref<string | null>();
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
  reviewedConnectionId.value = undefined;
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
const visibleConnections = computed(() =>
  connections.value.filter(
    (connection) => connection.status !== "disconnected",
  ),
);
const disconnectedCleanupAccounts = computed(() => [
  ...new Set(
    connections.value
      .filter(
        (connection) =>
          connection.status === "disconnected" && connection.cleanup_pending,
      )
      .map((connection) => connection.login),
  ),
]);
const visibleCandidates = computed(() => {
  const value = search.value.trim().toLowerCase();
  return candidates.value.filter((repo) =>
    repo.full_name.toLowerCase().includes(value),
  );
});
const selectedCountLabel = (count: number) =>
  t(
    `settings.connections.gitAccess.${count === 1 ? "selectedCountOne" : "selectedCount"}`,
    { count },
  );

const selectInstallation = (value: unknown) => {
  if (busy.value || typeof value !== "string" || value === installationId.value)
    return;
  installationId.value = value;
  search.value = "";
  void loadCandidates();
};

const toggleRepository = (
  repo: GitHubRepositoryChoice,
  checked: boolean | "indeterminate",
) => {
  if (busy.value || !candidatesLoaded.value || repo.unavailable) return;
  const id = repo.github_repository_id;
  selectedIds.value =
    checked === true
      ? [...new Set([...selectedIds.value, id])]
      : selectedIds.value.filter((selected) => selected !== id);
};

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
  reviewedConnectionId.value = undefined;
  generation.value = undefined;
  selectionVersion.value = undefined;
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
    const hasReviewedConnection = response.data.source_control_id !== undefined;
    reviewedConnectionId.value = hasReviewedConnection
      ? response.data.source_control_id
      : currentAttempt.source_control_id;
    // A current candidate response is authoritative, including an explicit new
    // connection (null). Only older responses use the initial attempt snapshot.
    generation.value = hasReviewedConnection
      ? response.data.connection_generation
      : (response.data.connection_generation ??
        currentAttempt.connection_generation);
    selectionVersion.value = hasReviewedConnection
      ? response.data.selection_version
      : (response.data.selection_version ?? currentAttempt.selection_version);
    if (generation.value === undefined || selectionVersion.value === undefined)
      throw new Error("Repository review is missing its concurrency snapshot");
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
  if (generation.value === undefined || selectionVersion.value === undefined) {
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
      const affected = [
        ...new Set(
          removed
            .flatMap((repo) => repo.affected_workloads ?? [])
            .map(
              (workload) =>
                `${t(`settings.connections.gitAccess.kind.${workload.kind}`)}: ${workload.name}`,
            ),
        ),
      ];
      const result = await confirmationDialog.value.show({
        title: t("settings.connections.gitAccess.removeTitle"),
        description:
          t("settings.connections.gitAccess.removeDescription", {
            repositories: removed.map((repo) => repo.full_name).join(", "),
            team: teamName.value,
          }) +
          (affected.length
            ? `\n\n${t("settings.connections.gitAccess.affectedWorkloads", { workloads: affected.join(", ") })}`
            : ""),
        confirmText: t("settings.connections.gitAccess.removeConfirm"),
        cancelText: t("settings.connections.cancel"),
        destructive: true,
      });
      if (!result.ok || !request.isCurrent()) return;
    }
    if (
      !canManageTeam.value ||
      !scope.ready.value ||
      attempt.value?.attempt_id !== currentAttempt.attempt_id
    )
      return;
    await githubConnectionService.select(
      currentAttempt.attempt_id,
      installationId.value,
      [...selectedIds.value],
      generation.value,
      selectionVersion.value,
      request.signal,
      reviewedConnectionId.value,
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
  if (
    !canManageTeam.value ||
    !scope.ready.value ||
    !confirmationDialog.value ||
    busy.value
  )
    return;
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
    <div
      class="mb-5 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"
    >
      <div class="min-w-0 space-y-1">
        <h3 id="git-connections-title" class="text-base font-semibold">
          {{ t("settings.connections.git.title") }}
        </h3>
        <p class="break-words text-sm text-muted-foreground">
          {{
            t("settings.connections.gitAccess.destination", { team: teamName })
          }}
        </p>
      </div>
      <Button
        v-if="canManageTeam && teamId && !attempt"
        variant="outline"
        class="shrink-0"
        :disabled="busy || loading"
        @click="openAuthorization()"
      >
        <Icon name="lucide:plus" class="mr-2 h-4 w-4" aria-hidden="true" />
        {{ t("settings.connections.gitAccess.connect") }}
      </Button>
    </div>
    <Alert v-if="callbackError || error" variant="destructive" class="mb-4">
      <Icon name="lucide:circle-alert" class="h-4 w-4" aria-hidden="true" />
      <AlertDescription>{{ error || callbackError }}</AlertDescription>
    </Alert>
    <p v-if="!teamId" class="text-sm text-muted-foreground">
      {{ t("settings.connections.gitAccess.chooseWorkspace") }}
    </p>
    <div
      v-else-if="loading"
      role="status"
      class="flex items-center gap-2 py-4 text-sm text-muted-foreground"
    >
      <Icon
        name="lucide:loader-circle"
        class="h-4 w-4 animate-spin"
        aria-hidden="true"
      />
      {{ t("settings.connections.gitAccess.loading") }}
    </div>
    <div v-else-if="!attempt" class="space-y-3">
      <Card v-if="!visibleConnections.length" class="shadow-none">
        <CardContent
          class="flex flex-col items-center gap-3 px-5 py-8 text-center"
        >
          <Avatar shape="square"
            ><AvatarFallback
              ><Icon
                name="simple-icons:github"
                class="h-5 w-5"
                aria-hidden="true" /></AvatarFallback
          ></Avatar>
          <p class="text-sm font-medium">
            {{ t("settings.connections.gitAccess.empty") }}
          </p>
        </CardContent>
      </Card>
      <Card
        v-for="connection in visibleConnections"
        :key="connection.id"
        class="shadow-none"
        data-testid="github-connection"
      >
        <CardHeader
          class="flex flex-col gap-4 space-y-0 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5"
        >
          <div class="flex min-w-0 items-center gap-3">
            <Avatar shape="square"
              ><AvatarFallback
                ><Icon
                  name="simple-icons:github"
                  class="h-5 w-5"
                  aria-hidden="true" /></AvatarFallback
            ></Avatar>
            <div class="min-w-0 space-y-1.5">
              <div class="flex flex-wrap items-center gap-x-2 gap-y-1">
                <CardTitle class="break-all text-sm font-medium leading-5">{{
                  connection.login
                }}</CardTitle>
                <Badge
                  v-if="connection.status"
                  :variant="
                    connection.status === 'active' ? 'secondary' : 'outline'
                  "
                  class="shrink-0 font-normal"
                >
                  {{
                    t(
                      `settings.connections.gitAccess.status.${connection.status}`,
                    )
                  }}
                </Badge>
              </div>
              <CardDescription class="text-xs">{{
                selectedCountLabel(connection.repository_count)
              }}</CardDescription>
            </div>
          </div>
          <div v-if="canManageTeam" class="flex shrink-0 items-center gap-2">
            <Button
              size="sm"
              :variant="connection.status === 'active' ? 'outline' : 'default'"
              :disabled="busy"
              class="flex-1 sm:flex-none"
              @click="openAuthorization(connection.id)"
            >
              {{
                t(
                  `settings.connections.gitAccess.${connection.status === "active" ? "manageSelection" : "reconnect"}`,
                )
              }}
            </Button>
            <DropdownMenu v-if="connection.status !== 'disconnected'">
              <DropdownMenuTrigger as-child>
                <Button
                  variant="ghost"
                  size="icon"
                  :disabled="busy"
                  :aria-label="
                    t('settings.connections.gitAccess.moreActions', {
                      account: connection.login,
                    })
                  "
                >
                  <Icon
                    name="lucide:ellipsis"
                    class="h-4 w-4"
                    aria-hidden="true"
                  />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  :disabled="busy"
                  class="text-destructive focus:text-destructive"
                  @select="disconnect(connection)"
                >
                  <Icon
                    name="lucide:unplug"
                    class="h-4 w-4"
                    aria-hidden="true"
                  />
                  {{ t("settings.connections.gitAccess.disconnect") }}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardHeader>
        <CardContent
          v-if="connection.cleanup_pending"
          class="px-4 pb-4 pt-0 sm:px-5 sm:pb-5"
        >
          <Alert>
            <Icon name="lucide:info" class="h-4 w-4" aria-hidden="true" />
            <AlertDescription>{{
              t("settings.connections.gitAccess.cleanupPending")
            }}</AlertDescription>
          </Alert>
        </CardContent>
      </Card>
      <Alert v-if="disconnectedCleanupAccounts.length">
        <Icon name="lucide:info" class="h-4 w-4" aria-hidden="true" />
        <AlertTitle>{{
          t("settings.connections.gitAccess.disconnectedCleanupTitle")
        }}</AlertTitle>
        <AlertDescription>{{
          t("settings.connections.gitAccess.disconnectedCleanup", {
            accounts: disconnectedCleanupAccounts.join(", "),
          })
        }}</AlertDescription>
      </Alert>
      <p class="pt-1 text-xs leading-relaxed text-muted-foreground">
        {{ t("settings.connections.gitAccess.isolationHelp") }}
      </p>
    </div>

    <Card
      v-if="attempt && canManageTeam"
      class="shadow-none"
      data-testid="github-selection"
    >
      <CardHeader class="space-y-2 p-4 sm:p-5">
        <CardTitle class="break-words text-base leading-6">
          {{
            t("settings.connections.gitAccess.selectTitle", { team: teamName })
          }}
        </CardTitle>
        <CardDescription class="leading-relaxed">
          {{ t("settings.connections.gitAccess.selectionHelp") }}
        </CardDescription>
      </CardHeader>
      <CardContent class="space-y-4 px-4 pb-4 sm:px-5 sm:pb-5">
        <p
          v-if="attempt.status !== 'authorized'"
          role="status"
          class="text-sm text-muted-foreground"
        >
          {{ t("settings.connections.gitAccess.awaitingAuthorization") }}
        </p>
        <template v-else>
          <div class="space-y-2">
            <Label for="github-installation">{{
              t("settings.connections.gitAccess.githubAccount")
            }}</Label>
            <Select
              :model-value="installationId"
              :disabled="busy"
              @update:model-value="selectInstallation"
            >
              <SelectTrigger id="github-installation">
                <SelectValue
                  :placeholder="
                    t('settings.connections.gitAccess.selectInstallation')
                  "
                />
              </SelectTrigger>
              <SelectContent>
                <SelectItem
                  v-for="installation in attempt.installations"
                  :key="installation.id"
                  :value="String(installation.id)"
                >
                  {{ installation.account_login }}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <template v-if="installationId">
            <div class="space-y-2">
              <Label for="github-repository-search" class="sr-only">{{
                t("settings.connections.gitAccess.search")
              }}</Label>
              <Input
                id="github-repository-search"
                v-model="search"
                type="search"
                :placeholder="t('settings.connections.gitAccess.search')"
              />
              <div
                v-if="candidatesLoading"
                role="status"
                class="flex items-center gap-2 py-6 text-sm text-muted-foreground"
              >
                <Icon
                  name="lucide:loader-circle"
                  class="h-4 w-4 animate-spin"
                  aria-hidden="true"
                />
                {{ t("settings.connections.gitAccess.loading") }}
              </div>
              <Button
                v-else-if="!candidatesLoaded"
                variant="outline"
                :disabled="busy"
                @click="loadCandidates"
              >
                {{ t("settings.connections.gitAccess.retryCandidates") }}
              </Button>
              <ScrollArea
                v-else-if="visibleCandidates.length"
                class="h-64 rounded-md border"
              >
                <div class="divide-y">
                  <div
                    v-for="repo in visibleCandidates"
                    :key="repo.github_repository_id"
                    class="flex items-start gap-3 p-3 transition-colors hover:bg-muted/50"
                  >
                    <Checkbox
                      :id="`github-repository-${repo.github_repository_id}`"
                      :model-value="
                        selectedIds.includes(repo.github_repository_id)
                      "
                      :value="repo.github_repository_id"
                      :disabled="busy || repo.unavailable"
                      :aria-label="repo.full_name"
                      class="mt-0.5 shrink-0"
                      @update:model-value="toggleRepository(repo, $event)"
                    />
                    <Label
                      :for="`github-repository-${repo.github_repository_id}`"
                      class="min-w-0 flex-1 cursor-pointer space-y-1 leading-5 peer-disabled:cursor-not-allowed"
                    >
                      <span class="flex items-center gap-2">
                        <span class="break-all font-normal">{{
                          repo.full_name
                        }}</span>
                        <Icon
                          v-if="repo.private"
                          name="lucide:lock-keyhole"
                          class="h-3.5 w-3.5 shrink-0 text-muted-foreground"
                          :aria-label="
                            t(
                              'settings.connections.gitAccess.privateRepository',
                            )
                          "
                          role="img"
                        />
                      </span>
                      <span
                        v-if="repo.unavailable"
                        class="block text-xs font-normal text-muted-foreground"
                        >{{
                          t("settings.connections.gitAccess.unavailable")
                        }}</span
                      >
                    </Label>
                  </div>
                </div>
              </ScrollArea>
              <p
                v-else-if="candidatesLoaded"
                class="py-6 text-center text-sm text-muted-foreground"
              >
                {{ t("settings.connections.gitAccess.noCandidates") }}
              </p>
              <p class="text-xs text-muted-foreground" role="status">
                {{ selectedCountLabel(selectedIds.length) }}
              </p>
            </div>
            <Alert v-if="!selectedIds.length && candidatesLoaded">
              <Icon name="lucide:info" class="h-4 w-4" aria-hidden="true" />
              <AlertDescription>{{
                t("settings.connections.gitAccess.zeroAccess")
              }}</AlertDescription>
            </Alert>
          </template>
        </template>
      </CardContent>
      <CardFooter
        class="flex flex-col-reverse gap-2 border-t p-4 sm:flex-row sm:justify-end sm:p-5"
      >
        <Button
          variant="ghost"
          class="w-full sm:w-auto"
          :disabled="busy"
          @click="
            resetSelection();
            clearAttemptQuery();
          "
        >
          {{ t("settings.connections.cancel") }}
        </Button>
        <Button
          class="w-full sm:w-auto"
          :disabled="busy || candidatesLoading || !candidatesLoaded"
          @click="saveSelection"
        >
          {{ t("settings.connections.gitAccess.save") }}
        </Button>
      </CardFooter>
    </Card>
    <Alert v-if="attempt?.install_url && canManageTeam" class="mt-4">
      <Icon name="lucide:info" class="h-4 w-4" aria-hidden="true" />
      <AlertDescription class="space-y-3">
        <p class="text-xs leading-relaxed">
          {{ t("settings.connections.gitAccess.githubAccessHelp") }}
        </p>
        <Button
          variant="outline"
          size="sm"
          class="h-auto max-w-full whitespace-normal py-2 text-left"
          :disabled="busy"
          @click="visitGitHub(attempt.install_url)"
        >
          {{ t("settings.connections.gitAccess.manageGitHub") }}
          <Icon
            name="lucide:external-link"
            class="ml-2 h-3.5 w-3.5 shrink-0"
            aria-hidden="true"
          />
        </Button>
      </AlertDescription>
    </Alert>

    <Dialog
      :open="authorizeConnection !== undefined"
      @update:open="
        (open) => {
          if (!open && !busy) authorizeConnection = undefined;
        }
      "
    >
      <DialogContent class="w-[calc(100%-2rem)] rounded-lg">
        <DialogHeader>
          <DialogTitle>{{
            t("settings.connections.gitAccess.confirmDestination")
          }}</DialogTitle>
          <DialogDescription class="leading-relaxed">
            {{
              t("settings.connections.gitAccess.destinationHelp", {
                team: teamName,
              })
            }}
          </DialogDescription>
        </DialogHeader>
        <div class="flex items-start gap-3 py-2">
          <Checkbox
            id="github-share-acknowledgment"
            :model-value="acknowledged"
            :disabled="busy"
            class="mt-0.5 shrink-0"
            @update:model-value="acknowledged = $event === true"
          />
          <Label
            for="github-share-acknowledgment"
            class="cursor-pointer text-sm font-normal leading-relaxed"
          >
            {{
              t("settings.connections.gitAccess.acknowledge", {
                team: teamName,
              })
            }}
          </Label>
        </div>
        <DialogFooter>
          <Button
            :disabled="busy || !acknowledged || !teamId"
            @click="beginAuthorization"
          >
            {{ t("settings.connections.gitAccess.continueGitHub") }}
            <Icon
              name="lucide:arrow-up-right"
              class="ml-2 h-4 w-4"
              aria-hidden="true"
            />
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </section>
</template>
