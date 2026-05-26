<script setup lang="ts">
import { toast } from "vue-sonner";
import type { DockerApplication } from "~/services/dockerService";

interface Props {
  application: DockerApplication;
}
const props = defineProps<Props>();

// Source-config rendering helpers. Each source type has its own shape;
// the API returns a generic Record<string, unknown> so we read defensively.
const sourceCfg = computed(
  () => (props.application.source_config ?? {}) as Record<string, unknown>,
);

const imageRef = computed(() => sourceCfg.value.image as string | undefined);
const gitRepo = computed(() => sourceCfg.value.repo as string | undefined);
const gitBranch = computed(() => sourceCfg.value.branch as string | undefined);
const dockerfileContents = computed(
  () => sourceCfg.value.contents as string | undefined,
);

const buildConfig = computed(
  () => (props.application.build_config ?? {}) as Record<string, unknown>,
);
const dockerfilePath = computed(
  () => buildConfig.value.dockerfile_path as string | undefined,
);

// Source-type metadata — same single-source-of-truth shape the
// database General uses for engine info.
const sourceMeta = computed(() => {
  switch (props.application.source_type) {
    case "image":
      return {
        label: "Docker Image",
        icon: "simple-icons:docker",
        iconBg: "bg-sky-500/10",
        iconColor: "text-sky-500",
      };
    case "git":
      return {
        label: "Git Repository",
        icon: "lucide:git-branch",
        iconBg: "bg-violet-500/10",
        iconColor: "text-violet-500",
      };
    case "dockerfile":
      return {
        label: "Dockerfile",
        icon: "lucide:file-code",
        iconBg: "bg-amber-500/10",
        iconColor: "text-amber-500",
      };
    default:
      return {
        label: props.application.source_type,
        icon: "lucide:box",
        iconBg: "bg-zinc-500/10",
        iconColor: "text-zinc-500",
      };
  }
});

// Container name on the host — same slug pattern the worker uses
// (see tasks.ContainerNameFor server-side). The backend also stamps
// this onto the response (resp.container_name) once the app has
// deployed; we fall back to a placeholder for pre-deploy.
const containerName = computed(
  () => props.application.container_name || "—",
);

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
</script>

<template>
  <!--
    Mirrors components/database/General.vue: no page-body heading
    (the breadcrumb above already names the workload), just a 4-up
    info-card grid. Rename + delete live on the Advanced subtab so
    this page stays read-only — a glance, not a form.
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

      <!-- Internal Port -->
      <div class="flex items-start gap-3 rounded-lg border bg-card p-4">
        <div
          class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-500/10"
        >
          <Icon name="lucide:plug-zap" class="h-5 w-5 text-blue-500" />
        </div>
        <div class="min-w-0 flex-1">
          <p class="text-sm text-muted-foreground">Internal Port</p>
          <p class="font-mono text-sm font-medium text-foreground">
            {{ application.internal_port }}
          </p>
        </div>
      </div>

      <!-- Build type (only meaningful for git/dockerfile sources;
           shown as "—" for plain image source to keep the grid balanced) -->
      <div class="flex items-start gap-3 rounded-lg border bg-card p-4">
        <div
          class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-500/10"
        >
          <Icon name="lucide:hammer" class="h-5 w-5 text-amber-500" />
        </div>
        <div class="min-w-0 flex-1">
          <p class="text-sm text-muted-foreground">Build</p>
          <p class="text-sm font-medium capitalize text-foreground">
            {{
              application.source_type === "image"
                ? "—"
                : application.build_type || "auto-detect"
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
            {{ formatDate(application.last_deployed_at) }}
          </p>
        </div>
      </div>

      <!-- Image / Git repo — full-width tile, branch shown alongside on git -->
      <div
        v-if="application.source_type === 'image'"
        class="flex items-start gap-3 rounded-lg border bg-card p-4 sm:col-span-2 lg:col-span-4"
      >
        <div
          class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-zinc-500/10"
        >
          <Icon name="simple-icons:docker" class="h-5 w-5 text-zinc-500" />
        </div>
        <div class="flex min-w-0 flex-1 items-center justify-between gap-3">
          <div class="min-w-0">
            <p class="text-sm text-muted-foreground">Image</p>
            <p class="truncate font-mono text-sm font-medium text-foreground">
              {{ imageRef || "—" }}
            </p>
          </div>
          <button
            v-if="imageRef"
            type="button"
            class="shrink-0 rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
            title="Copy image reference"
            @click="copyValue('Image', imageRef)"
          >
            <Icon name="lucide:copy" class="h-4 w-4" />
          </button>
        </div>
      </div>

      <template v-if="application.source_type === 'git'">
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
        <div
          v-if="dockerfilePath"
          class="flex items-start gap-3 rounded-lg border bg-card p-4 sm:col-span-2 lg:col-span-4"
        >
          <div
            class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-500/10"
          >
            <Icon name="lucide:file-code" class="h-5 w-5 text-amber-500" />
          </div>
          <div class="min-w-0 flex-1">
            <p class="text-sm text-muted-foreground">Dockerfile Path</p>
            <p class="truncate font-mono text-xs font-medium text-foreground">
              {{ dockerfilePath }}
            </p>
          </div>
        </div>
      </template>

      <!-- Container name + Container ID — full-width row, two cards -->
      <div
        class="flex items-start gap-3 rounded-lg border bg-card p-4 sm:col-span-2"
      >
        <div
          class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-orange-500/10"
        >
          <Icon name="lucide:container" class="h-5 w-5 text-orange-500" />
        </div>
        <div class="flex min-w-0 flex-1 items-center justify-between gap-3">
          <div class="min-w-0">
            <p class="text-sm text-muted-foreground">Container Name</p>
            <p class="truncate font-mono text-xs font-medium text-foreground">
              {{ containerName }}
            </p>
          </div>
          <button
            v-if="application.container_name"
            type="button"
            class="shrink-0 rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
            title="Copy container name"
            @click="copyValue('Container name', application.container_name)"
          >
            <Icon name="lucide:copy" class="h-4 w-4" />
          </button>
        </div>
      </div>
      <div
        class="flex items-start gap-3 rounded-lg border bg-card p-4 sm:col-span-2"
      >
        <div
          class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-zinc-500/10"
        >
          <Icon name="lucide:fingerprint" class="h-5 w-5 text-zinc-500" />
        </div>
        <div class="flex min-w-0 flex-1 items-center justify-between gap-3">
          <div class="min-w-0">
            <p class="text-sm text-muted-foreground">Container ID</p>
            <p class="truncate font-mono text-xs font-medium text-foreground">
              {{ application.container_id || "—" }}
            </p>
          </div>
          <button
            v-if="application.container_id"
            type="button"
            class="shrink-0 rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
            title="Copy container id"
            @click="copyValue('Container ID', application.container_id)"
          >
            <Icon name="lucide:copy" class="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>

    <!--
      Dockerfile contents (only for source_type=dockerfile). Read-only
      pre block matches the way ServerTraefik's read-only YAML view
      renders — no editor chrome needed since this is a snapshot of
      what gets built.
    -->
    <div
      v-if="application.source_type === 'dockerfile' && dockerfileContents"
      class="rounded-lg border bg-card"
    >
      <div class="border-b px-5 py-3">
        <p class="text-sm font-medium text-foreground">Dockerfile</p>
        <p class="mt-0.5 text-xs text-muted-foreground">
          Built on every deploy. Edit it via the Advanced tab.
        </p>
      </div>
      <pre
        class="max-h-72 overflow-auto p-5 font-mono text-xs leading-relaxed text-foreground"
      >{{ dockerfileContents }}</pre>
    </div>
  </div>
</template>
