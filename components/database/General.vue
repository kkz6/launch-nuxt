<script setup lang="ts">
import type { DockerDatabase } from "~/services/dockerService";

interface Props {
  database: DockerDatabase;
}
const props = defineProps<Props>();
const { t } = useI18n();

// General is now a clean info-card grid (engine / version / ports /
// image / container). The Connection card moved into the navbar
// Actions dropdown as "Connection info" — opens a dialog so
// credentials aren't always on the page. See
// components/database/ConnectionDialog.vue.

// Engine catalog — drives icon + tint + default port for the
// per-engine display. Single source of truth so future engines just
// add a row here.
const engineInfo = computed(() => {
  switch (props.database.engine) {
    case "postgres":
      return {
        label: "Postgres",
        icon: "simple-icons:postgresql",
        iconBg: "bg-sky-500/10",
        iconColor: "text-sky-500",
        defaultPort: 5432,
      };
    case "mysql":
      return {
        label: "MySQL",
        icon: "simple-icons:mysql",
        iconBg: "bg-amber-500/10",
        iconColor: "text-amber-500",
        defaultPort: 3306,
      };
    case "mariadb":
      return {
        label: "MariaDB",
        icon: "simple-icons:mariadb",
        iconBg: "bg-amber-500/10",
        iconColor: "text-amber-500",
        defaultPort: 3306,
      };
    case "redis":
      return {
        label: "Redis",
        icon: "simple-icons:redis",
        iconBg: "bg-rose-500/10",
        iconColor: "text-rose-500",
        defaultPort: 6379,
      };
    case "mongo":
      return {
        label: "MongoDB",
        icon: "simple-icons:mongodb",
        iconBg: "bg-emerald-500/10",
        iconColor: "text-emerald-500",
        defaultPort: 27017,
      };
    default:
      return {
        label: props.database.engine,
        icon: "lucide:database",
        iconBg: "bg-muted",
        iconColor: "text-muted-foreground",
        defaultPort: 0,
      };
  }
});

const internalPort = computed(() => engineInfo.value.defaultPort);

// Container name on the host — used by the navbar Terminal action
// and shown in the info-card grid below. We prefer the backend-
// computed value (`launch-db-<project>-<db>`) and fall back to a
// best-effort guess if the field is missing on older rows.
const containerName = computed(
  () => props.database.container_name || `launch-db-${props.database.name}`,
);
</script>

<template>
  <!--
    Status + lifecycle actions live in the navbar (workload action
    buttons next to Terminal). Connection credentials live in the
    navbar Actions dropdown ("Connection info") so they're not
    always visible on the page. The body is a 4-up info-card grid
    of identity (engine / version / ports / image / container).
  -->
  <div class="space-y-8">
    <!-- ── Database Details (no heading, header is in the page) ── -->
    <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <!-- Engine -->
      <div class="flex items-start gap-3 rounded-lg border bg-card p-4">
        <div
          class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"
          :class="engineInfo.iconBg"
        >
          <Icon
            :name="engineInfo.icon"
            class="h-5 w-5"
            :class="engineInfo.iconColor"
          />
        </div>
        <div class="min-w-0 flex-1">
          <p class="text-sm text-muted-foreground">
            {{ t("workload.fields.engine") }}
          </p>
          <p class="text-sm font-medium text-foreground">
            {{ engineInfo.label }}
          </p>
        </div>
      </div>

      <!-- Version -->
      <div class="flex items-start gap-3 rounded-lg border bg-card p-4">
        <div
          class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-violet-500/10"
        >
          <Icon name="lucide:tag" class="h-5 w-5 text-violet-500" />
        </div>
        <div class="min-w-0 flex-1">
          <p class="text-sm text-muted-foreground">
            {{ t("workload.fields.version") }}
          </p>
          <p class="text-sm font-medium text-foreground">
            {{ database.engine_version }}
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
          <p class="text-sm text-muted-foreground">
            {{ t("workload.fields.internalPort") }}
          </p>
          <p class="font-mono text-sm font-medium text-foreground">
            {{ internalPort }}
          </p>
        </div>
      </div>

      <!-- External Port -->
      <div class="flex items-start gap-3 rounded-lg border bg-card p-4">
        <div
          class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"
          :class="
            database.external_port ? 'bg-emerald-500/10' : 'bg-zinc-500/10'
          "
        >
          <Icon
            name="lucide:globe"
            class="h-5 w-5"
            :class="
              database.external_port ? 'text-emerald-500' : 'text-zinc-500'
            "
          />
        </div>
        <div class="min-w-0 flex-1">
          <p class="text-sm text-muted-foreground">
            {{ t("workload.database.general.externalPort") }}
          </p>
          <p class="font-mono text-sm font-medium text-foreground">
            {{
              database.external_port ??
              t("workload.database.general.notExposed")
            }}
          </p>
        </div>
      </div>

      <!-- Image (full width on sm, 2-col on lg) -->
      <div
        class="flex items-start gap-3 rounded-lg border bg-card p-4 sm:col-span-2"
      >
        <div
          class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-zinc-500/10"
        >
          <Icon name="simple-icons:docker" class="h-5 w-5 text-zinc-500" />
        </div>
        <div class="min-w-0 flex-1">
          <p class="text-sm text-muted-foreground">
            {{ t("workload.fields.image") }}
          </p>
          <p class="truncate font-mono text-sm font-medium text-foreground">
            {{ database.image_tag || "—" }}
          </p>
        </div>
      </div>

      <!-- Container name on host -->
      <div
        class="flex items-start gap-3 rounded-lg border bg-card p-4 sm:col-span-2"
      >
        <div
          class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-orange-500/10"
        >
          <Icon name="lucide:container" class="h-5 w-5 text-orange-500" />
        </div>
        <div class="min-w-0 flex-1">
          <p class="text-sm text-muted-foreground">
            {{ t("workload.database.general.container") }}
          </p>
          <p class="truncate font-mono text-xs font-medium text-foreground">
            {{ containerName }}
          </p>
        </div>
      </div>
    </div>
  </div>
</template>
