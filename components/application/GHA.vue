<script setup lang="ts">
import { toast } from "vue-sonner";
import { Button } from "~/components/ui/button";
import {
  dockerService,
  type DockerApplication,
} from "~/services/dockerService";

interface Props {
  application: DockerApplication;
}
const props = defineProps<Props>();
const { t } = useI18n();
const emit = defineEmits<{
  (e: "updated"): void;
}>();

// Customer-facing view of the GHA bootstrap state. Backend writes a
// few fields into source_config; we pluck them here so the template
// stays readable:
//   - source_control_id  → which connected GitHub install owns the repo
//   - repo               → "git@github.com:owner/name.git" or https form
//   - branch             → branch the workflow listens to (push trigger)
//   - gha_workflow_sha   → commit SHA of the workflow file Launch
//                          committed; populated by the bootstrap job on
//                          success. Missing = bootstrap hasn't finished
//                          (or has been failing).
//   - gha_image_repository → "ghcr.io/<owner>/<repo>" lowercased; the
//                            webhook handler gates accepted image tags
//                            on this prefix.
type SourceConfig = {
  repo?: string;
  branch?: string;
  gha_workflow_sha?: string;
  gha_image_repository?: string;
  source_control_id?: string;
  // auto_deploy: when true the committed workflow triggers on push to
  // `branch` (in addition to manual). Toggled from the switch below.
  auto_deploy?: boolean;
};

const sc = computed<SourceConfig>(
  () => (props.application.source_config || {}) as SourceConfig,
);

// repoSlug renders the customer-friendly "owner/name" from whatever
// shape the row is stored as. Mirrors the parsing the bootstrap job
// uses server-side so the value the customer sees matches the prefix
// that gates webhook auth.
const repoSlug = computed(() => {
  const raw = (sc.value.repo || "").trim();
  if (!raw) return "";
  let s = raw.replace(/\.git$/, "");
  if (s.startsWith("git@")) {
    const idx = s.indexOf(":");
    if (idx >= 0) s = s.slice(idx + 1);
  }
  const proto = s.indexOf("://");
  if (proto >= 0) {
    const rest = s.slice(proto + 3);
    const slash = rest.indexOf("/");
    if (slash >= 0) s = rest.slice(slash + 1);
  }
  const parts = s.split("/").filter(Boolean);
  if (parts.length < 2) return "";
  return parts.slice(-2).join("/");
});

const branch = computed(() => sc.value.branch || "main");

const workflowURL = computed(() => {
  if (!repoSlug.value) return "";
  return `https://github.com/${repoSlug.value}/blob/${branch.value}/.github/workflows/launch-deploy.yml`;
});

const repoActionsURL = computed(() => {
  if (!repoSlug.value) return "";
  return `https://github.com/${repoSlug.value}/actions`;
});

const repoSettingsSecretsURL = computed(() => {
  if (!repoSlug.value) return "";
  return `https://github.com/${repoSlug.value}/settings/secrets/actions`;
});

// installBroken is latched by the gha_install_broken WS event. Session-
// only — there's no persistent backend flag, so a page reload clears
// it (which is fine; the next sync attempt will re-fire the event if
// the install is still broken). When the event arrives we show a top-
// of-page banner so the customer sees what's wrong, instead of a stuck
// "Setting up…" with no explanation.
const installBroken = ref(false);

// Compact status snapshot. Drives the inline badge next to the page
// title AND the right-side CTA. Four states; only "broken" gets a
// full-width banner above the page (rendered separately).
type Status = {
  kind: "ready" | "setting-up" | "incomplete" | "broken";
  label: string;
  icon: string;
  iconClass: string;
  badgeClass: string;
  // Page-level subtitle that sets context for the whole tab. Different
  // from the status label — speaks to "what does this tab do?" rather
  // than "what's the current state?". Stable across ready/setting-up
  // so the page heading doesn't churn during the bootstrap window.
  subtitle: string;
};

const status = computed<Status>(() => {
  if (installBroken.value) {
    return {
      kind: "broken",
      label: t("workload.githubActions.status.accessLost"),
      icon: "lucide:shield-alert",
      iconClass: "text-red-600 dark:text-red-400",
      badgeClass:
        "bg-red-500/10 ring-1 ring-inset ring-red-500/40 text-red-700 dark:text-red-300",
      subtitle: t("workload.githubActions.status.accessLostSubtitle"),
    };
  }
  if (!props.application.gha_build_ready) {
    return {
      kind: "setting-up",
      label: t("workload.githubActions.status.settingUp"),
      icon: "lucide:loader-2",
      iconClass: "animate-spin text-amber-600 dark:text-amber-400",
      badgeClass:
        "bg-amber-500/10 ring-1 ring-inset ring-amber-500/40 text-amber-800 dark:text-amber-300",
      subtitle: t("workload.githubActions.status.settingUpSubtitle"),
    };
  }
  if (!sc.value.gha_workflow_sha) {
    return {
      kind: "incomplete",
      label: t("workload.githubActions.status.incomplete"),
      icon: "lucide:alert-triangle",
      iconClass: "text-amber-600 dark:text-amber-400",
      badgeClass:
        "bg-amber-500/10 ring-1 ring-inset ring-amber-500/40 text-amber-800 dark:text-amber-300",
      subtitle: t("workload.githubActions.status.incompleteSubtitle"),
    };
  }
  return {
    kind: "ready",
    label: t("workload.githubActions.status.ready"),
    icon: "lucide:check-circle-2",
    iconClass: "text-emerald-600 dark:text-emerald-400",
    badgeClass:
      "bg-emerald-500/10 ring-1 ring-inset ring-emerald-500/40 text-emerald-800 dark:text-emerald-300",
    subtitle: t("workload.githubActions.status.readySubtitle", {
      branch: branch.value,
    }),
  };
});

const isRotating = ref(false);
const isResyncing = ref(false);
const isDisabling = ref(false);

const confirmationDialog = ref<InstanceType<
  typeof import("~/components/shared/ConfirmationDialog.vue").default
> | null>(null);

const rotateToken = async () => {
  isRotating.value = true;
  try {
    await dockerService.applications.rotateGhaToken(
      props.application.server_id,
      props.application.project_id,
      props.application.id,
    );
    toast.success(t("workload.githubActions.tokenRotationQueued"));
  } catch (err: unknown) {
    const e = err as { data?: { message?: string } };
    toast.error(
      e.data?.message || t("workload.githubActions.tokenRotationFailed"),
    );
  } finally {
    isRotating.value = false;
  }
};

const resyncWorkflow = async () => {
  isResyncing.value = true;
  try {
    await dockerService.applications.resyncGhaWorkflow(
      props.application.server_id,
      props.application.project_id,
      props.application.id,
    );
    toast.success(t("workload.githubActions.resyncQueued"));
  } catch (err: unknown) {
    const e = err as { data?: { message?: string } };
    toast.error(e.data?.message || t("workload.githubActions.resyncFailed"));
  } finally {
    isResyncing.value = false;
  }
};

// Auto-deploy: mirror the saved state, with an optimistic toggle that
// reverts on failure. The save re-syncs the committed workflow so its
// `on:` trigger matches (push + dispatch when on, dispatch-only when off).
const autoDeploy = ref<boolean>(!!sc.value.auto_deploy);
watch(
  () => sc.value.auto_deploy,
  (v) => {
    autoDeploy.value = !!v;
  },
);
const isTogglingAutoDeploy = ref(false);
const setAutoDeploy = async (enabled: boolean) => {
  const prev = autoDeploy.value;
  autoDeploy.value = enabled;
  isTogglingAutoDeploy.value = true;
  try {
    await dockerService.applications.setGhaAutoDeploy(
      props.application.server_id,
      props.application.project_id,
      props.application.id,
      enabled,
    );
    toast.success(
      enabled
        ? t("workload.githubActions.autoDeployOn")
        : t("workload.githubActions.autoDeployOff"),
    );
    emit("updated");
  } catch (err: unknown) {
    autoDeploy.value = prev;
    const e = err as { data?: { message?: string } };
    toast.error(
      e.data?.message || t("workload.githubActions.autoDeployFailed"),
    );
  } finally {
    isTogglingAutoDeploy.value = false;
  }
};

const disableGHA = async () => {
  if (!confirmationDialog.value) return;
  const result = await confirmationDialog.value.show({
    title: t("workload.githubActions.disableTitle"),
    description: t("workload.githubActions.disableDescription"),
    confirmText: t("workload.actions.disable"),
    cancelText: t("workload.githubActions.keepEnabled"),
    destructive: true,
  });
  if (!result.ok) return;
  isDisabling.value = true;
  try {
    await dockerService.applications.disableGha(
      props.application.server_id,
      props.application.project_id,
      props.application.id,
    );
    toast.success(t("workload.githubActions.disabledApplication"));
    emit("updated");
  } catch (err: unknown) {
    const e = err as { data?: { message?: string } };
    toast.error(e.data?.message || t("workload.githubActions.disableFailed"));
  } finally {
    isDisabling.value = false;
  }
};

// Refetch the app when the bootstrap job's WS events fire so the
// status badge + workflow SHA + install-broken state reflect reality
// without a manual page reload. Synced clears installBroken (a
// successful sync proves the install is back).
const { user } = useAuth();
const teamId = computed(() => user.value?.current_team_id?.toString() || "");
useDockerApplicationEvents(teamId, (data, event) => {
  if (data.application_id !== props.application.id) return;
  if (event === "docker.application.gha_install_broken") {
    installBroken.value = true;
    emit("updated");
    return;
  }
  if (event === "docker.application.gha_synced") {
    installBroken.value = false;
    emit("updated");
    return;
  }
  if (event === "docker.application.gha_disabled") {
    emit("updated");
  }
});
</script>

<template>
  <div class="space-y-8">
    <SharedConfirmationDialog ref="confirmationDialog" />

    <!--
      Layout intent: typographic sections (heading + thin rule), NOT
      stacked cards. Matches GitHub's own settings pages. The only
      boxed surface is the Danger zone at the bottom — every other
      section reads as flat content under a labelled heading.

      Broken install gets a sticky banner at the very top so it's
      impossible to miss; otherwise the status is a small inline chip
      beside the page title.
    -->

    <!-- Broken-install banner — only when GitHub App access was lost. -->
    <div
      v-if="installBroken"
      class="flex flex-col gap-3 rounded-lg border border-red-500/30 bg-red-500/10 p-4 sm:flex-row sm:items-center sm:justify-between"
    >
      <div class="flex items-start gap-3">
        <Icon
          name="lucide:shield-alert"
          class="mt-0.5 h-5 w-5 shrink-0 text-red-600 dark:text-red-400"
        />
        <div class="min-w-0 space-y-1">
          <h3 class="text-sm font-semibold text-red-700 dark:text-red-300">
            {{ t("workload.githubActions.accessLostTitle") }}
          </h3>
          <p class="text-xs text-red-700/80 dark:text-red-300/80">
            {{ t("workload.githubActions.accessLostDescription") }}
          </p>
        </div>
      </div>
      <NuxtLink to="https://github.com/settings/installations" target="_blank">
        <Button
          size="sm"
          variant="outline"
          class="border-red-500/40 bg-white/60 text-red-700 hover:bg-red-500/10 hover:text-red-700 dark:bg-black/20 dark:text-red-300 dark:hover:text-red-200"
        >
          {{ t("workload.githubActions.openInstallations") }}
          <Icon name="lucide:external-link" class="ml-1.5 h-3 w-3 opacity-70" />
        </Button>
      </NuxtLink>
    </div>

    <!--
      PAGE HEADER — title + inline status chip + primary CTA. The chip
      is the compact equivalent of the old hero panel; the description
      below it is the longer-form context.
    -->
    <div
      class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"
    >
      <div class="min-w-0 space-y-1">
        <div class="flex flex-wrap items-center gap-2">
          <h2 class="text-lg font-semibold">
            {{ t("workload.githubActions.buildsTitle") }}
          </h2>
          <span
            class="inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium"
            :class="status.badgeClass"
          >
            <Icon
              :name="status.icon"
              class="h-3 w-3"
              :class="status.iconClass"
            />
            {{ status.label }}
          </span>
        </div>
        <p class="text-sm text-muted-foreground">{{ status.subtitle }}</p>
      </div>
      <NuxtLink
        v-if="status.kind === 'ready' && repoActionsURL"
        :to="repoActionsURL"
        target="_blank"
        class="shrink-0"
      >
        <Button size="sm" variant="outline">
          <Icon name="lucide:play-circle" class="mr-1.5 h-3.5 w-3.5" />
          {{ t("workload.githubActions.viewRuns") }}
          <Icon name="lucide:external-link" class="ml-1.5 h-3 w-3 opacity-70" />
        </Button>
      </NuxtLink>
    </div>

    <!--
      SECTION: CONFIGURATION
      Heading + horizontal rule. No surrounding card. The dl below has
      a 160px label column so all four rows align vertically.
    -->
    <section class="space-y-3">
      <div class="flex items-baseline justify-between gap-3 border-b pb-2">
        <h3
          class="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
        >
          {{ t("workload.githubActions.configuration") }}
        </h3>
        <span
          class="text-[10px] uppercase tracking-wider text-muted-foreground/60"
        >
          {{ t("workload.githubActions.readOnly") }}
        </span>
      </div>
      <dl
        class="grid grid-cols-1 gap-x-6 gap-y-2.5 text-sm sm:grid-cols-[160px_1fr]"
      >
        <dt class="text-xs uppercase tracking-wide text-muted-foreground">
          {{ t("workload.fields.repository") }}
        </dt>
        <dd class="font-mono">
          <NuxtLink
            v-if="repoSlug"
            :to="`https://github.com/${repoSlug}`"
            target="_blank"
            class="inline-flex items-center gap-1 hover:underline"
          >
            {{ repoSlug }}
            <Icon name="lucide:external-link" class="h-3 w-3 opacity-70" />
          </NuxtLink>
          <span v-else class="text-muted-foreground">—</span>
        </dd>

        <dt class="text-xs uppercase tracking-wide text-muted-foreground">
          {{ t("workload.fields.branch") }}
        </dt>
        <dd class="font-mono">{{ branch }}</dd>

        <dt class="text-xs uppercase tracking-wide text-muted-foreground">
          {{ t("workload.githubActions.workflowFile") }}
        </dt>
        <dd>
          <NuxtLink
            v-if="workflowURL"
            :to="workflowURL"
            target="_blank"
            class="inline-flex items-center gap-1 font-mono hover:underline"
          >
            .github/workflows/launch-deploy.yml
            <Icon name="lucide:external-link" class="h-3 w-3 opacity-70" />
          </NuxtLink>
          <span v-else class="font-mono text-muted-foreground">—</span>
          <TooltipProvider v-if="sc.gha_workflow_sha">
            <Tooltip>
              <TooltipTrigger as-child>
                <span
                  class="ml-2 inline-flex cursor-help items-center gap-1 rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground"
                >
                  <Icon name="lucide:git-commit" class="h-3 w-3" />
                  {{ sc.gha_workflow_sha.slice(0, 7) }}
                </span>
              </TooltipTrigger>
              <TooltipContent class="max-w-xs">
                {{ t("workload.githubActions.workflowShaHelp") }}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </dd>

        <dt class="text-xs uppercase tracking-wide text-muted-foreground">
          {{ t("workload.githubActions.containerImage") }}
        </dt>
        <dd class="flex items-center gap-1.5 font-mono">
          {{ sc.gha_image_repository || "—" }}
          <TooltipProvider v-if="sc.gha_image_repository">
            <Tooltip>
              <TooltipTrigger as-child>
                <span
                  class="inline-flex h-4 w-4 cursor-help items-center justify-center rounded-full bg-muted text-muted-foreground"
                >
                  <Icon name="lucide:info" class="h-3 w-3" />
                </span>
              </TooltipTrigger>
              <TooltipContent class="max-w-xs">
                {{ t("workload.githubActions.imagePrefixHelp") }}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </dd>
      </dl>
    </section>

    <!--
      SECTION: MAINTENANCE
      Heading + rule. Two action rows below, no nested boxes. Right-
      aligned buttons; descriptions stay flush-left. Disabled-state
      tooltips on the button itself (vs a separate explanation row).
    -->
    <section class="space-y-3">
      <div class="border-b pb-2">
        <h3
          class="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
        >
          {{ t("workload.githubActions.maintenance") }}
        </h3>
      </div>
      <ul class="divide-y">
        <li
          class="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between"
        >
          <div class="min-w-0 flex-1 space-y-0.5">
            <div class="flex items-center gap-2 text-sm font-medium">
              <Icon
                name="lucide:git-branch"
                class="h-3.5 w-3.5 text-muted-foreground"
              />
              {{ t("workload.githubActions.autoDeployTitle") }}
            </div>
            <p class="text-xs text-muted-foreground">
              {{ t("workload.githubActions.autoDeployBeforeBranch") }}
              <span class="font-mono">{{
                sc.branch || t("workload.githubActions.deployBranch")
              }}</span>
              {{ t("workload.githubActions.autoDeployAfterBranch") }}
            </p>
          </div>
          <Switch
            :model-value="autoDeploy"
            :disabled="isTogglingAutoDeploy || !application.gha_build_ready"
            class="shrink-0"
            @update:model-value="setAutoDeploy"
          />
        </li>
        <li
          class="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between"
        >
          <div class="min-w-0 flex-1 space-y-0.5">
            <div class="flex items-center gap-2 text-sm font-medium">
              <Icon
                name="lucide:refresh-cw"
                class="h-3.5 w-3.5 text-muted-foreground"
              />
              {{ t("workload.githubActions.resyncFileTitle") }}
            </div>
            <p class="text-xs text-muted-foreground">
              {{ t("workload.githubActions.resyncFileBefore") }}
              <span class="font-mono">launch-deploy.yml</span>
              {{ t("workload.githubActions.resyncFileAfter") }}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            :disabled="isResyncing"
            class="shrink-0"
            @click="resyncWorkflow"
          >
            <Icon
              v-if="isResyncing"
              name="lucide:loader-2"
              class="mr-1.5 h-3.5 w-3.5 animate-spin"
            />
            <Icon v-else name="lucide:refresh-cw" class="mr-1.5 h-3.5 w-3.5" />
            {{ t("workload.githubActions.resyncShort") }}
          </Button>
        </li>
        <li
          class="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between"
        >
          <div class="min-w-0 flex-1 space-y-0.5">
            <div class="flex items-center gap-2 text-sm font-medium">
              <Icon
                name="lucide:key-round"
                class="h-3.5 w-3.5 text-muted-foreground"
              />
              {{ t("workload.githubActions.rotateToken") }}
            </div>
            <p class="text-xs text-muted-foreground">
              {{ t("workload.githubActions.rotateBeforeToken") }}
              <span class="font-mono">LAUNCH_DEPLOY_TOKEN</span>
              {{ t("workload.githubActions.rotateAfterToken") }}
              <NuxtLink
                v-if="repoSettingsSecretsURL"
                :to="repoSettingsSecretsURL"
                target="_blank"
                class="ml-1 inline-flex items-center gap-0.5 underline hover:no-underline"
              >
                {{ t("workload.githubActions.viewSecrets") }}
                <Icon name="lucide:external-link" class="h-3 w-3 opacity-70" />
              </NuxtLink>
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            :disabled="isRotating || !application.gha_build_ready"
            :title="
              !application.gha_build_ready
                ? t('workload.githubActions.availableWhenLive')
                : ''
            "
            class="shrink-0"
            @click="rotateToken"
          >
            <Icon
              v-if="isRotating"
              name="lucide:loader-2"
              class="mr-1.5 h-3.5 w-3.5 animate-spin"
            />
            <Icon v-else name="lucide:key-round" class="mr-1.5 h-3.5 w-3.5" />
            {{ t("workload.githubActions.rotate") }}
          </Button>
        </li>
      </ul>
    </section>

    <!--
      DANGER ZONE — the only boxed section. Red-tinted border + heading
      keeps it visually distinct from the read-only / informational
      sections above. The action lives inside; confirmation flows
      through SharedConfirmationDialog for product-wide consistency.
    -->
    <div class="rounded-lg border border-red-500/30 bg-red-500/5">
      <div class="border-b border-red-500/20 px-4 py-2.5">
        <h3
          class="text-xs font-semibold uppercase tracking-wider text-red-700 dark:text-red-400"
        >
          {{ t("workload.danger.title") }}
        </h3>
      </div>
      <div
        class="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
      >
        <div class="min-w-0 space-y-1">
          <div class="text-sm font-medium">
            {{ t("workload.githubActions.disableBuilds") }}
          </div>
          <p class="text-xs text-muted-foreground">
            {{ t("workload.githubActions.disableApplicationBeforeFile") }}
            <span class="font-mono">launch-deploy.yml</span>
            {{ t("workload.githubActions.disableAfterFile") }}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          :disabled="isDisabling"
          class="shrink-0 border-red-500/40 text-red-700 hover:bg-red-500/10 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
          @click="disableGHA"
        >
          <Icon
            v-if="isDisabling"
            name="lucide:loader-2"
            class="mr-1.5 h-3.5 w-3.5 animate-spin"
          />
          <Icon v-else name="lucide:power-off" class="mr-1.5 h-3.5 w-3.5" />
          {{ t("workload.actions.disable") }}
        </Button>
      </div>
    </div>
  </div>
</template>
