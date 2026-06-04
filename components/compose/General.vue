<script setup lang="ts">
import { toast } from "vue-sonner";
import type { DockerCompose } from "~/services/dockerService";

interface Props {
  compose: DockerCompose;
}
const props = defineProps<Props>();

// Source-config rendering helpers. Compose stacks have two source
// types: git (sourceConfig has repo + branch) or raw_yaml (inlined
// in compose.raw_yaml). The API returns sourceConfig as a generic
// Record<string, unknown> so we read defensively.
const sourceCfg = computed(
  () => (props.compose.source_config ?? {}) as Record<string, unknown>,
);
const gitRepo = computed(() => sourceCfg.value.repo as string | undefined);
const gitBranch = computed(() => sourceCfg.value.branch as string | undefined);

// Source-type metadata mirrors components/application/General.vue's
// sourceMeta — same icon/colour vocabulary so a user switching
// between workloads sees the same visual grammar.
const sourceMeta = computed(() => {
  switch (props.compose.compose_source_type) {
    case "git":
      return {
        label: "Git Repository",
        icon: "lucide:git-branch",
        iconBg: "bg-violet-500/10",
        iconColor: "text-violet-500",
      };
    case "raw_yaml":
      return {
        label: "Inline YAML",
        icon: "lucide:file-code",
        iconBg: "bg-sky-500/10",
        iconColor: "text-sky-500",
      };
    default:
      return {
        label: props.compose.compose_source_type,
        icon: "lucide:box",
        iconBg: "bg-zinc-500/10",
        iconColor: "text-zinc-500",
      };
  }
});

// Status metadata — same dot/colour mapping the workload navbar
// breadcrumb uses, so the General header status doesn't disagree
// with the breadcrumb's status indicator.
const statusMeta = computed(() => {
  switch (props.compose.status) {
    case "running":
      return {
        label: "Running",
        icon: "lucide:activity",
        iconBg: "bg-emerald-500/10",
        iconColor: "text-emerald-500",
      };
    case "building":
      // Compose's DockerApplicationStatus uses "building" while a
      // deploy is in flight (matches application status semantics).
      // There's no separate "deploying" value in the enum.
      return {
        label: "Deploying",
        icon: "lucide:loader",
        iconBg: "bg-amber-500/10",
        iconColor: "text-amber-500",
      };
    case "failed":
      return {
        label: "Failed",
        icon: "lucide:circle-x",
        iconBg: "bg-rose-500/10",
        iconColor: "text-rose-500",
      };
    case "stopped":
      return {
        label: "Stopped",
        icon: "lucide:circle-pause",
        iconBg: "bg-zinc-500/10",
        iconColor: "text-zinc-500",
      };
    default:
      return {
        label: props.compose.status || "—",
        icon: "lucide:circle",
        iconBg: "bg-zinc-500/10",
        iconColor: "text-zinc-500",
      };
  }
});

const formatDate = (iso?: string | null): string => {
  if (!iso) return "Never";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return "—";
  }
};

const copyValue = async (label: string, value: string | null | undefined) => {
  if (!value) return;
  try {
    await navigator.clipboard.writeText(value);
    toast.success(`${label} copied`);
  } catch {
    toast.error(`Couldn't copy ${label}`);
  }
};

// Compose-project name on the host — same `<project-slug>-<compose-
// slug>` shape the deploy + remove jobs use for --project-name. We
// don't have direct access to the project slug here, but the API
// returns `name` and the project-slug is the parent project's name
// slug; for the General read-only view we just show the compose's
// own name and let the operator infer.
const stackName = computed(() => props.compose.name);
</script>

<template>
  <!--
    Mirrors components/application/General.vue: no on-page heading
    (the breadcrumb above already names the workload), just a 4-up
    info-card grid. Rename + delete live on the Advanced subtab so
    this page stays read-only — a glance, not a form. Same icon
    vocabulary as application + database General so a user switching
    workloads sees one consistent visual grammar.
  -->
  <div class="space-y-8">
    <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <!-- Source type -->
      <div class="flex items-start gap-3 rounded-lg border bg-card p-4">
        <div
          class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"
          :class="sourceMeta.iconBg"
        >
          <Icon
            :name="sourceMeta.icon"
            class="h-5 w-5"
            :class="sourceMeta.iconColor"
          />
        </div>
        <div class="min-w-0 flex-1">
          <p class="text-sm text-muted-foreground">Source</p>
          <p class="text-sm font-medium text-foreground">
            {{ sourceMeta.label }}
          </p>
        </div>
      </div>

      <!-- Status -->
      <div class="flex items-start gap-3 rounded-lg border bg-card p-4">
        <div
          class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"
          :class="statusMeta.iconBg"
        >
          <Icon
            :name="statusMeta.icon"
            class="h-5 w-5"
            :class="statusMeta.iconColor"
          />
        </div>
        <div class="min-w-0 flex-1">
          <p class="text-sm text-muted-foreground">Status</p>
          <p class="text-sm font-medium capitalize text-foreground">
            {{ statusMeta.label }}
          </p>
        </div>
      </div>

      <!-- Compose file path (git source only — defaults to
           docker-compose.yml when unset). Shown as "—" on raw_yaml
           so the grid stays balanced. -->
      <div class="flex items-start gap-3 rounded-lg border bg-card p-4">
        <div
          class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-500/10"
        >
          <Icon name="lucide:file-code-2" class="h-5 w-5 text-amber-500" />
        </div>
        <div class="min-w-0 flex-1">
          <p class="text-sm text-muted-foreground">Compose File</p>
          <p class="truncate font-mono text-xs font-medium text-foreground">
            {{
              compose.compose_source_type === "git"
                ? compose.compose_file_path || "docker-compose.yml"
                : "—"
            }}
          </p>
        </div>
      </div>

      <!-- Last Deployed -->
      <div class="flex items-start gap-3 rounded-lg border bg-card p-4">
        <div
          class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10"
        >
          <Icon name="lucide:clock" class="h-5 w-5 text-emerald-500" />
        </div>
        <div class="min-w-0 flex-1">
          <p class="text-sm text-muted-foreground">Last Deployed</p>
          <p class="text-sm font-medium text-foreground">
            {{ formatDate(compose.last_deployed_at) }}
          </p>
        </div>
      </div>

      <!-- Git source row: repo + branch. Matches the application
           General git layout (repo gets the wide tile, branch a
           single column). -->
      <template v-if="compose.compose_source_type === 'git'">
        <div
          class="flex items-start gap-3 rounded-lg border bg-card p-4 sm:col-span-2 lg:col-span-3"
        >
          <div
            class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-zinc-500/10"
          >
            <Icon name="lucide:git-branch" class="h-5 w-5 text-zinc-500" />
          </div>
          <div class="flex min-w-0 flex-1 items-center justify-between gap-3">
            <div class="min-w-0">
              <p class="text-sm text-muted-foreground">Repository</p>
              <p class="truncate font-mono text-xs font-medium text-foreground">
                {{ gitRepo || "—" }}
              </p>
            </div>
            <button
              v-if="gitRepo"
              type="button"
              class="shrink-0 rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
              title="Copy repository URL"
              @click="copyValue('Repository', gitRepo)"
            >
              <Icon name="lucide:copy" class="h-4 w-4" />
            </button>
          </div>
        </div>
        <div class="flex items-start gap-3 rounded-lg border bg-card p-4">
          <div
            class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-violet-500/10"
          >
            <Icon
              name="lucide:git-commit-vertical"
              class="h-5 w-5 text-violet-500"
            />
          </div>
          <div class="min-w-0 flex-1">
            <p class="text-sm text-muted-foreground">Branch</p>
            <p class="font-mono text-sm font-medium text-foreground">
              {{ gitBranch || "—" }}
            </p>
          </div>
        </div>
      </template>

      <!-- Stack name — full-width tile on the bottom row, with copy.
           Mirrors the Container Name card on application General. -->
      <div
        class="flex items-start gap-3 rounded-lg border bg-card p-4 sm:col-span-2 lg:col-span-4"
      >
        <div
          class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-orange-500/10"
        >
          <Icon name="lucide:layers" class="h-5 w-5 text-orange-500" />
        </div>
        <div class="flex min-w-0 flex-1 items-center justify-between gap-3">
          <div class="min-w-0">
            <p class="text-sm text-muted-foreground">Stack Name</p>
            <p class="truncate font-mono text-sm font-medium text-foreground">
              {{ stackName }}
            </p>
          </div>
          <button
            v-if="stackName"
            type="button"
            class="shrink-0 rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
            title="Copy stack name"
            @click="copyValue('Stack name', stackName)"
          >
            <Icon name="lucide:copy" class="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>

    <!--
      docker-compose.yml read-only view moved out of General — it now
      lives in the Navbar's Actions dropdown ("View YAML") to keep
      General to the same info-card grid shape application + database
      General use. The compose detail page mounts the dialog
      (see pages/.../composes/[composeId]/index.vue) and the navbar
      flips a shared useState flag to open it.
    -->
  </div>
</template>
