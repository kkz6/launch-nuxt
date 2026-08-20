<script setup lang="ts">
import { toast } from "vue-sonner";
import {
  dockerService,
  type DockerContainerInspect,
  type DockerHostContainer,
} from "~/services/dockerService";

interface Props {
  serverId: string;
  container: DockerHostContainer | null;
}
const props = defineProps<Props>();
const { t, locale } = useI18n();

// Controlled open state — same v-model:open contract the other docker
// dialogs use.
const open = defineModel<boolean>("open", { required: true });

const inspect = ref<DockerContainerInspect | null>(null);
const isLoading = ref(false);
const error = ref<string | null>(null);

// Refetch whenever the dialog opens against a new container. Skipping
// the load when the same container is reopened keeps the dialog feeling
// snappy and avoids hammering SSH if the user toggles repeatedly.
const lastFetchedID = ref<string | null>(null);

const fetchInspect = async () => {
  if (!props.container) return;
  // The /containers/:id/inspect endpoint requires a hex-only ID. The
  // table populates `Names` and `ID`; we send `ID` (short hash) which
  // matches the backend's containerIDPattern.
  const id = props.container.ID;
  if (!id) {
    error.value = t("server.docker.inspect.idMissing");
    return;
  }
  if (lastFetchedID.value === id && inspect.value) return;

  isLoading.value = true;
  error.value = null;
  try {
    const res = await dockerService.host.inspectContainer(props.serverId, id);
    inspect.value = res.data;
    lastFetchedID.value = id;
  } catch (err: unknown) {
    const e = err as { data?: { message?: string } };
    error.value = e.data?.message || t("server.docker.inspect.failed");
    toast.error(error.value);
  } finally {
    isLoading.value = false;
  }
};

watch([open, () => props.container?.ID], ([isOpen]) => {
  if (isOpen) void fetchInspect();
});

// --- format helpers -------------------------------------------------------

const formatBytes = (b: number): string => {
  if (!b || b <= 0) return "—";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let i = 0;
  let v = b;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(v >= 100 ? 0 : v >= 10 ? 1 : 2)} ${units[i]}`;
};

// nano_cpus reports CPU limit in nanoseconds-per-second; 1_000_000_000 == 1 vCPU.
const formatCPUs = (n: number): string => {
  if (!n || n <= 0) return "—";
  return `${(n / 1_000_000_000).toFixed(2)} vCPU`;
};

const formatTime = (iso?: string): string => {
  if (!iso) return "—";
  // Docker writes "0001-01-01T00:00:00Z" for unset timestamps; treat
  // those as "—" so the dialog doesn't say "container finished 2000
  // years ago".
  if (iso.startsWith("0001-01-01")) return "—";
  try {
    return new Date(iso).toLocaleString(
      locale.value === "ja" ? "ja-JP" : "en-US",
    );
  } catch {
    return iso;
  }
};

const formatUptime = (startedAt?: string): string => {
  if (!startedAt || startedAt.startsWith("0001-01-01")) return "—";
  try {
    const start = new Date(startedAt).getTime();
    const ms = Date.now() - start;
    if (ms < 0) return "—";
    const sec = Math.floor(ms / 1000);
    if (sec < 60)
      return t("server.docker.inspect.durationSeconds", { seconds: sec });
    const min = Math.floor(sec / 60);
    if (min < 60)
      return t("server.docker.inspect.durationMinutes", {
        minutes: min,
        seconds: sec % 60,
      });
    const hr = Math.floor(min / 60);
    if (hr < 24)
      return t("server.docker.inspect.durationHours", {
        hours: hr,
        minutes: min % 60,
      });
    const days = Math.floor(hr / 24);
    return t("server.docker.inspect.durationDays", { days, hours: hr % 24 });
  } catch {
    return "—";
  }
};

// Color for the state badge inside the dialog. Mirrors the table's
// stateBadge function. Kept separate so a UI tweak to one doesn't
// silently shift the other.
const stateColor = (status: string): string => {
  switch (status?.toLowerCase()) {
    case "running":
      return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400";
    case "exited":
    case "stopped":
      return "bg-zinc-500/15 text-zinc-700 dark:text-zinc-300";
    case "dead":
    case "failed":
      return "bg-rose-500/15 text-rose-700 dark:text-rose-400";
    default:
      return "bg-amber-500/15 text-amber-700 dark:text-amber-400";
  }
};

const healthColor = (status?: string): string => {
  switch (status) {
    case "healthy":
      return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400";
    case "unhealthy":
      return "bg-rose-500/15 text-rose-700 dark:text-rose-400";
    case "starting":
      return "bg-amber-500/15 text-amber-700 dark:text-amber-400";
    default:
      return "bg-zinc-500/15 text-zinc-700 dark:text-zinc-300";
  }
};

const localizedDockerValue = (
  group: "state" | "health" | "mountType",
  value?: string,
): string => {
  if (!value) return "—";
  const normalizedValue = value.toLowerCase().replaceAll("-", "_");
  const key = `server.docker.inspect.values.${group}.${normalizedValue}`;
  const translated = t(key);
  return translated === key ? value : translated;
};

// --- Command rendering ----------------------------------------------------
//
// docker's "command" isn't a single field. We render:
//   - Entrypoint (from the image, often a shell script wrapper)
//   - CMD (image default or runtime override)
//   - Runtime exec: Path + Args (what docker actually exec'd)
// Each goes in its own SharedCodeEditor block so the user sees the
// structural shape AND the runtime shape.

// shellish + joinShellArgs live in useDockerHelpers so the quoting
// rules are pinned by unit tests — bash escaping is famously easy
// to get subtly wrong.
const entrypointStr = computed(() => joinShellArgs(inspect.value?.entrypoint));
const cmdStr = computed(() => joinShellArgs(inspect.value?.cmd));
const execStr = computed(() => {
  if (!inspect.value?.path) return "";
  return joinShellArgs([inspect.value.path, ...(inspect.value.args ?? [])]);
});
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
      <DialogHeader>
        <DialogTitle class="flex items-center gap-3">
          <span class="font-mono text-base">
            {{
              inspect?.name ||
              container?.Names ||
              t("server.docker.inspect.container")
            }}
          </span>
          <span
            v-if="inspect"
            class="rounded-full px-2 py-0.5 text-xs font-medium capitalize"
            :class="stateColor(inspect.state.status)"
          >
            {{ localizedDockerValue("state", inspect.state.status) }}
          </span>
        </DialogTitle>
        <DialogDescription>
          {{ t("server.docker.inspect.descriptionPrefix") }}
          <code>docker inspect</code>
          {{ t("server.docker.inspect.descriptionSuffix") }}
        </DialogDescription>
      </DialogHeader>

      <div v-if="isLoading" class="flex items-center justify-center py-12">
        <Icon
          name="lucide:loader-2"
          class="h-6 w-6 animate-spin text-muted-foreground"
        />
      </div>

      <div
        v-else-if="error"
        class="rounded-md border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-900 dark:text-rose-200"
      >
        {{ error }}
      </div>

      <div v-else-if="inspect" class="space-y-6 text-sm">
        <!-- State -->
        <section>
          <h3
            class="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
          >
            {{ t("server.docker.inspect.state") }}
          </h3>
          <dl class="mt-2 grid gap-x-6 gap-y-2 sm:grid-cols-2">
            <div>
              <dt class="text-xs text-muted-foreground">
                {{ t("server.common.status") }}
              </dt>
              <dd class="font-medium capitalize">
                {{ localizedDockerValue("state", inspect.state.status) }}
              </dd>
            </div>
            <div>
              <dt class="text-xs text-muted-foreground">
                {{ t("server.metrics.uptime") }}
              </dt>
              <dd>{{ formatUptime(inspect.state.started_at) }}</dd>
            </div>
            <div>
              <dt class="text-xs text-muted-foreground">
                {{ t("server.docker.inspect.startedAt") }}
              </dt>
              <dd>{{ formatTime(inspect.state.started_at) }}</dd>
            </div>
            <div
              v-if="
                inspect.state.finished_at &&
                !inspect.state.finished_at.startsWith('0001-01-01')
              "
            >
              <dt class="text-xs text-muted-foreground">
                {{ t("server.docker.inspect.finishedAt") }}
              </dt>
              <dd>{{ formatTime(inspect.state.finished_at) }}</dd>
            </div>
            <div>
              <dt class="text-xs text-muted-foreground">
                {{ t("server.docker.inspect.restartCount") }}
              </dt>
              <dd
                :class="
                  inspect.restart_count > 3
                    ? 'font-medium text-amber-700 dark:text-amber-400'
                    : ''
                "
              >
                {{ inspect.restart_count }}
                <span
                  v-if="inspect.restart_count > 3"
                  class="ml-1 text-xs text-muted-foreground"
                  >{{ t("server.docker.inspect.possibleCrashloop") }}</span
                >
              </dd>
            </div>
            <div v-if="inspect.state.pid">
              <dt class="text-xs text-muted-foreground">
                {{ t("server.docker.inspect.hostPid") }}
              </dt>
              <dd class="font-mono text-xs">{{ inspect.state.pid }}</dd>
            </div>
            <div v-if="!inspect.state.running">
              <dt class="text-xs text-muted-foreground">
                {{ t("server.docker.inspect.exitCode") }}
              </dt>
              <dd
                :class="
                  inspect.state.exit_code !== 0
                    ? 'font-medium text-rose-700 dark:text-rose-400'
                    : ''
                "
              >
                {{ inspect.state.exit_code }}
                <span
                  v-if="inspect.state.oom_killed"
                  class="ml-1 text-xs text-muted-foreground"
                  >{{ t("server.docker.inspect.oomKilled") }}</span
                >
              </dd>
            </div>
            <div v-if="inspect.state.error" class="sm:col-span-2">
              <dt class="text-xs text-muted-foreground">
                {{ t("server.common.errorOccurred") }}
              </dt>
              <dd class="font-mono text-xs text-rose-700 dark:text-rose-400">
                {{ inspect.state.error }}
              </dd>
            </div>
          </dl>
        </section>

        <!-- Health -->
        <section v-if="inspect.health">
          <h3
            class="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
          >
            {{ t("server.docker.inspect.health") }}
          </h3>
          <div class="mt-2 flex items-center gap-3">
            <span
              class="rounded-full px-2 py-0.5 text-xs font-medium capitalize"
              :class="healthColor(inspect.health.status)"
            >
              {{ localizedDockerValue("health", inspect.health.status) }}
            </span>
            <span class="text-xs text-muted-foreground">
              {{
                t("server.docker.inspect.failingStreak", {
                  count: inspect.health.failing_streak,
                })
              }}
            </span>
          </div>
          <div v-if="inspect.health.log?.length" class="mt-3 space-y-2">
            <p
              class="text-[10px] uppercase tracking-wide text-muted-foreground"
            >
              {{ t("server.docker.inspect.recentChecks") }}
            </p>
            <div
              v-for="(entry, i) in inspect.health.log"
              :key="i"
              class="rounded-md border bg-muted/30 px-3 py-2 text-xs"
            >
              <div
                class="flex justify-between text-[10px] text-muted-foreground"
              >
                <span>{{ formatTime(entry.end) }}</span>
                <span
                  :class="
                    entry.exit_code === 0
                      ? ''
                      : 'text-rose-700 dark:text-rose-400'
                  "
                >
                  {{
                    t("server.docker.inspect.exitCodeValue", {
                      code: entry.exit_code,
                    })
                  }}
                </span>
              </div>
              <pre
                class="mt-1 whitespace-pre-wrap break-words font-mono text-[11px]"
                >{{ entry.output || t("server.docker.inspect.noOutput") }}</pre>
            </div>
          </div>
        </section>

        <!-- Image -->
        <section>
          <h3
            class="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
          >
            {{ t("server.docker.containers.image") }}
          </h3>
          <dl class="mt-2 grid gap-x-6 gap-y-2 sm:grid-cols-2">
            <div>
              <dt class="text-xs text-muted-foreground">
                {{ t("server.docker.inspect.reference") }}
              </dt>
              <dd class="break-all font-mono text-xs">{{ inspect.image }}</dd>
            </div>
            <div v-if="inspect.platform">
              <dt class="text-xs text-muted-foreground">
                {{ t("server.docker.inspect.platform") }}
              </dt>
              <dd>{{ inspect.platform }}</dd>
            </div>
            <div class="sm:col-span-2">
              <dt class="text-xs text-muted-foreground">
                {{ t("server.docker.inspect.imageId") }}
              </dt>
              <dd class="break-all font-mono text-[10px] text-muted-foreground">
                {{ inspect.image_id }}
              </dd>
            </div>
          </dl>
        </section>

        <!--
          Command / Entrypoint / Exec — rendered via SharedCodeEditor
          so long arg lists wrap and stay readable. docker's "command"
          isn't a single field: ENTRYPOINT and CMD compose
          structurally, while Path + Args is what's actually running.
          Showing all three lets the user reconcile them — especially
          handy for legacy (pre-v2) swarm-spawned containers where the
          runtime line is much longer than the Dockerfile CMD.
        -->
        <section>
          <h3
            class="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
          >
            {{ t("server.docker.inspect.command") }}
          </h3>

          <div v-if="entrypointStr" class="space-y-1">
            <p class="text-[11px] text-muted-foreground">
              Entrypoint
              <span class="opacity-60">{{
                t("server.docker.inspect.fromImage")
              }}</span>
            </p>
            <SharedCodeEditor
              :model-value="entrypointStr"
              :disabled="true"
              :line-numbers="false"
              :fold-gutter="false"
              class="h-16"
            />
          </div>

          <div v-if="cmdStr" class="mt-3 space-y-1">
            <p class="text-[11px] text-muted-foreground">
              CMD
              <span class="opacity-60">{{
                t("server.docker.inspect.imageDefault")
              }}</span>
            </p>
            <SharedCodeEditor
              :model-value="cmdStr"
              :disabled="true"
              :line-numbers="false"
              :fold-gutter="false"
              class="h-16"
            />
          </div>

          <div
            v-if="execStr && execStr !== cmdStr && execStr !== entrypointStr"
            class="mt-3 space-y-1"
          >
            <p class="text-[11px] text-muted-foreground">
              Runtime exec
              <span class="opacity-60">{{
                t("server.docker.inspect.runtimeExecuted")
              }}</span>
            </p>
            <SharedCodeEditor
              :model-value="execStr"
              :disabled="true"
              :line-numbers="false"
              :fold-gutter="false"
              class="h-24"
            />
          </div>

          <p
            v-if="!entrypointStr && !cmdStr && !execStr"
            class="text-xs text-muted-foreground"
          >
            {{ t("server.docker.inspect.noCommand") }}
          </p>
        </section>

        <!-- Resources -->
        <section>
          <h3
            class="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
          >
            {{ t("server.docker.inspect.resources") }}
          </h3>
          <dl class="mt-2 grid gap-x-6 gap-y-2 sm:grid-cols-3">
            <div>
              <dt class="text-xs text-muted-foreground">
                {{ t("server.docker.inspect.memoryLimit") }}
              </dt>
              <dd>{{ formatBytes(inspect.resources.memory_limit_bytes) }}</dd>
            </div>
            <div>
              <dt class="text-xs text-muted-foreground">
                {{ t("server.docker.inspect.cpuLimit") }}
              </dt>
              <dd>{{ formatCPUs(inspect.resources.nano_cpus) }}</dd>
            </div>
            <div>
              <dt class="text-xs text-muted-foreground">
                {{ t("server.docker.inspect.restartPolicy") }}
              </dt>
              <dd class="capitalize">
                {{ inspect.restart_policy || t("server.common.no") }}
              </dd>
            </div>
          </dl>
        </section>

        <!-- Mounts -->
        <section v-if="inspect.mounts?.length">
          <h3
            class="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
          >
            {{
              t("server.docker.inspect.mounts", {
                count: inspect.mounts.length,
              })
            }}
          </h3>
          <div class="mt-2 overflow-hidden rounded-md border">
            <table class="w-full text-xs">
              <thead
                class="bg-muted/50 text-left text-[10px] uppercase tracking-wide text-muted-foreground"
              >
                <tr>
                  <th class="px-3 py-2">
                    {{ t("server.docker.inspect.type") }}
                  </th>
                  <th class="px-3 py-2">
                    {{ t("server.docker.inspect.source") }}
                  </th>
                  <th class="px-3 py-2">
                    {{ t("server.docker.inspect.destination") }}
                  </th>
                  <th class="px-3 py-2">
                    {{ t("server.docker.inspect.mode") }}
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(m, i) in inspect.mounts" :key="i" class="border-t">
                  <td class="px-3 py-2 capitalize">
                    {{ localizedDockerValue("mountType", m.type) }}
                  </td>
                  <td class="break-all px-3 py-2 font-mono">{{ m.source }}</td>
                  <td class="break-all px-3 py-2 font-mono">
                    {{ m.destination }}
                  </td>
                  <td class="px-3 py-2 text-muted-foreground">
                    {{ m.read_only ? "ro" : "rw" }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <!-- Networks -->
        <section v-if="inspect.networks?.length">
          <h3
            class="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
          >
            {{
              t("server.docker.inspect.networks", {
                count: inspect.networks.length,
              })
            }}
          </h3>
          <div class="mt-2 overflow-hidden rounded-md border">
            <table class="w-full text-xs">
              <thead
                class="bg-muted/50 text-left text-[10px] uppercase tracking-wide text-muted-foreground"
              >
                <tr>
                  <th class="px-3 py-2">
                    {{ t("server.docker.inspect.network") }}
                  </th>
                  <th class="px-3 py-2">
                    {{ t("server.docker.inspect.ipAddress") }}
                  </th>
                  <th class="px-3 py-2">MAC</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="n in inspect.networks"
                  :key="n.name"
                  class="border-t"
                >
                  <td class="px-3 py-2 font-mono">{{ n.name }}</td>
                  <td class="px-3 py-2 font-mono">{{ n.ip_address || "—" }}</td>
                  <td class="px-3 py-2 font-mono text-muted-foreground">
                    {{ n.mac_address || "—" }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </DialogContent>
  </Dialog>
</template>
