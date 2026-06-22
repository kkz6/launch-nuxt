<script setup lang="ts">
import { toast } from "vue-sonner";
import type { DockerApplication } from "~/services/dockerService";

interface Props {
  application: DockerApplication;
}
const props = defineProps<Props>();

const sourceCfg = computed(
  () => (props.application.source_config ?? {}) as Record<string, unknown>,
);
const imageRef = computed(() => sourceCfg.value.image as string | undefined);
const gitRepo = computed(() => sourceCfg.value.repo as string | undefined);
const gitBranch = computed(() => sourceCfg.value.branch as string | undefined);
const dockerfileContents = computed(() => sourceCfg.value.contents as string | undefined);

const buildConfig = computed(
  () => (props.application.build_config ?? {}) as Record<string, unknown>,
);
const dockerfilePath = computed(() => buildConfig.value.dockerfile_path as string | undefined);

const containerName = computed(() => props.application.container_name || "—");

// Live status → a single calm status chip (the one accent that earns
// its colour). Everything else stays neutral.
const statusMeta = computed(() => {
  const s = (props.application.status || "").toLowerCase();
  const map: Record<string, { label: string; dot: string; chip: string }> = {
    running: { label: "Running", dot: "bg-emerald-500", chip: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" },
    building: { label: "Building", dot: "bg-amber-500", chip: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400" },
    deploying: { label: "Deploying", dot: "bg-amber-500", chip: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400" },
    failed: { label: "Failed", dot: "bg-red-500", chip: "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-400" },
    stopped: { label: "Stopped", dot: "bg-muted-foreground/50", chip: "border-border/70 bg-muted/50 text-muted-foreground" },
    idle: { label: "Idle", dot: "bg-muted-foreground/40", chip: "border-border/70 bg-muted/50 text-muted-foreground" },
  };
  return map[s] || { label: props.application.status || "Unknown", dot: "bg-muted-foreground/40", chip: "border-border/70 bg-muted/50 text-muted-foreground" };
});

const sourceLabel = computed(() => {
  switch (props.application.source_type) {
    case "image": return "Docker image";
    case "git": return "Git repository";
    case "dockerfile": return "Dockerfile";
    default: return props.application.source_type;
  }
});
const isGHA = computed(() => props.application.build_location === "github_actions");
const buildLocationLabel = computed(() => (isGHA.value ? "GitHub Actions" : "On server"));

const formatShort = (iso?: string | null) => {
  if (!iso) return "Never";
  try {
    return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  } catch {
    return "—";
  }
};
const formatDate = (iso?: string | null) => {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return "—";
  }
};

const titleCase = (s?: string | null) =>
  s ? s.charAt(0).toUpperCase() + s.slice(1) : s;

const buildValue = computed(() => {
  if (props.application.source_type === "image") return "Pre-built image";
  return titleCase(props.application.build_type) || "Auto-detect";
});

const statusBadge = computed(() => {
  const s = (props.application.status || "").toLowerCase();
  if (s === "running") return "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400";
  if (s === "building" || s === "deploying") return "bg-amber-500/10 text-amber-600 dark:text-amber-400";
  if (s === "failed") return "bg-red-500/10 text-red-600 dark:text-red-400";
  return "bg-muted text-muted-foreground";
});

const sourceIcon = computed(() => {
  switch (props.application.source_type) {
    case "image": return "lucide:container";
    case "git": return "lucide:git-branch";
    case "dockerfile": return "lucide:file-code";
    default: return "lucide:box";
  }
});

interface OverviewCard {
  label: string;
  value: string;
  icon: string;
  badge: string;
}

// Just a few key facts as cards — kept deliberately small so it reads
// at a glance rather than as a wall of badges. Everything else goes in
// the plain Details list below.
const keyCards = computed<OverviewCard[]>(() => [
  { label: "Status", value: statusMeta.value.label, icon: "lucide:activity", badge: statusBadge.value },
  { label: "Source", value: sourceLabel.value || "—", icon: sourceIcon.value, badge: "bg-blue-500/10 text-blue-600 dark:text-blue-400" },
  { label: "Internal port", value: String(props.application.internal_port ?? "—"), icon: "lucide:plug-zap", badge: "bg-sky-500/10 text-sky-600 dark:text-sky-400" },
  { label: "Last deployed", value: formatShort(props.application.last_deployed_at), icon: "lucide:rocket", badge: "bg-violet-500/10 text-violet-600 dark:text-violet-400" },
]);

// Plain key/value rows — no icons, no badges. Empty values are skipped.
const details = computed(() => {
  const rows: { label: string; value: string; mono?: boolean; copy?: string }[] = [];
  rows.push({ label: "Build", value: buildValue.value });
  rows.push({ label: "Build runs", value: buildLocationLabel.value });
  if (props.application.source_type === "image" && imageRef.value) {
    rows.push({ label: "Image", value: imageRef.value, mono: true, copy: imageRef.value });
  }
  if (props.application.source_type === "git") {
    if (gitRepo.value) rows.push({ label: "Repository", value: gitRepo.value, mono: true, copy: gitRepo.value });
    if (gitBranch.value) rows.push({ label: "Branch", value: gitBranch.value, mono: true });
  }
  if (dockerfilePath.value) rows.push({ label: "Dockerfile path", value: dockerfilePath.value, mono: true });
  rows.push({ label: "Container name", value: containerName.value, mono: true, copy: props.application.container_name || undefined });
  if (props.application.container_id) {
    rows.push({ label: "Container ID", value: props.application.container_id, mono: true, copy: props.application.container_id });
  }
  rows.push({ label: "Created", value: formatDate(props.application.created_at) });
  return rows;
});

const copyValue = async (label: string, value?: string | null) => {
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
  <div class="space-y-6">
    <!-- Tab header — same title/subtitle pattern as Deployments,
         Redirects, Schedulers, etc. -->
    <div>
      <h3 class="text-lg font-semibold">Overview</h3>
      <p class="text-sm text-muted-foreground">
        Live status, build source, and where this application runs.
      </p>
    </div>

    <!-- A few key facts as cards (kept small — like the PHP site
         Overview), with a tinted icon badge each. -->
    <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <div
        v-for="c in keyCards"
        :key="c.label"
        class="flex items-start gap-3 rounded-lg border bg-card p-4"
      >
        <div
          class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"
          :class="c.badge"
        >
          <Icon :name="c.icon" class="h-5 w-5" />
        </div>
        <div class="min-w-0 flex-1">
          <p class="text-sm text-muted-foreground">{{ c.label }}</p>
          <p
            class="truncate text-sm font-medium text-foreground"
            :title="c.value"
          >
            {{ c.value }}
          </p>
        </div>
      </div>
    </div>

    <!-- Everything else — a plain key/value list, no icons or badges. -->
    <div class="space-y-3">
      <h4 class="text-sm font-semibold">Details</h4>
      <dl
        class="grid grid-cols-1 gap-x-10 gap-y-4 rounded-lg border border-border/60 p-5 sm:grid-cols-2"
      >
        <div v-for="d in details" :key="d.label" class="flex items-baseline gap-4">
          <dt class="w-32 shrink-0 text-[13px] text-muted-foreground">{{ d.label }}</dt>
          <dd class="flex min-w-0 flex-1 items-center gap-1.5">
            <span
              class="truncate text-[13px] font-medium"
              :class="d.mono ? 'font-mono' : ''"
              :title="d.value"
            >
              {{ d.value }}
            </span>
            <button
              v-if="d.copy"
              type="button"
              class="shrink-0 rounded p-1 text-muted-foreground/70 transition-colors hover:bg-muted hover:text-foreground active:scale-95"
              :title="`Copy ${d.label.toLowerCase()}`"
              @click="copyValue(d.label, d.copy)"
            >
              <Icon name="lucide:copy" class="h-3.5 w-3.5" />
            </button>
          </dd>
        </div>
      </dl>
    </div>

    <!-- Dockerfile snapshot (dockerfile source only) -->
    <div
      v-if="application.source_type === 'dockerfile' && dockerfileContents"
      class="space-y-3"
    >
      <div>
        <h4 class="text-sm font-semibold">Dockerfile</h4>
        <p class="text-[13px] text-muted-foreground">
          Built on every deploy — edit it in the Advanced tab.
        </p>
      </div>
      <pre
        class="max-h-72 overflow-auto rounded-lg border border-border/60 bg-muted/30 p-4 font-mono text-[13px] leading-relaxed text-foreground"
      >{{ dockerfileContents }}</pre>
    </div>
  </div>
</template>
