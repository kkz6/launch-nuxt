<script setup lang="ts">
import { reactive, toRefs } from "vue";
import { useClipboard } from "@vueuse/core";
import { toast } from "vue-sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Switch } from "~/components/ui/switch";
import { Button } from "~/components/ui/button";
import { dockerService, type DockerDatabase } from "~/services/dockerService";

interface Props {
  database: DockerDatabase;
}
const props = defineProps<Props>();
const { t } = useI18n();

const open = defineModel<boolean>("open", { default: false });

type ConnectionMode = "internal" | "external";

interface ConnectionDialogState {
  revealed: DockerDatabase | null;
  isRevealing: boolean;
  showPassword: boolean;
  connectionMode: ConnectionMode;
  exposeEnabled: boolean;
  exposePort: number | undefined;
  exposeSaving: boolean;
}

const state = reactive({
  revealed: null,
  isRevealing: false,
  showPassword: false,
  connectionMode: "internal",
  exposeEnabled: Boolean(props.database.external_port),
  exposePort: props.database.external_port ?? undefined,
  exposeSaving: false,
}) as ConnectionDialogState;

const {
  revealed,
  isRevealing,
  showPassword,
  connectionMode,
  exposeEnabled,
  exposePort,
  exposeSaving,
} = toRefs(state);

const reveal = async () => {
  if (revealed.value) {
    await withSmoothResize(() => {
      showPassword.value = !showPassword.value;
    });
    return;
  }
  isRevealing.value = true;
  try {
    const res = await dockerService.databases.get(
      props.database.server_id,
      props.database.project_id,
      props.database.id,
      { reveal: true },
    );
    await withSmoothResize(() => {
      revealed.value = res.data;
      showPassword.value = true;
    });
  } catch (err: unknown) {
    const e = err as { data?: { message?: string } };
    toast.error(
      e.data?.message || t("workload.database.connection.loadFailed"),
    );
  } finally {
    isRevealing.value = false;
  }
};

watch(open, (isOpen) => {
  if (!isOpen) {
    revealed.value = null;
    showPassword.value = false;
    connectionMode.value = "internal";
  }
});

const { copy } = useClipboard();

const copyValue = async (label: string, value: string) => {
  if (!value) return;
  try {
    await copy(value);
    toast.success(t("workload.copy.success", { label }));
  } catch {
    toast.error(t("workload.copy.failed", { label }));
  }
};

const engineInfo = computed(() => {
  switch (props.database.engine) {
    case "postgres":
      return { label: "Postgres", defaultPort: 5432 };
    case "mysql":
      return { label: "MySQL", defaultPort: 3306 };
    case "mariadb":
      return { label: "MariaDB", defaultPort: 3306 };
    case "redis":
      return { label: "Redis", defaultPort: 6379 };
    case "mongo":
      return { label: "MongoDB", defaultPort: 27017 };
    default:
      return { label: props.database.engine, defaultPort: 0 };
  }
});

const internalPort = computed(() => engineInfo.value.defaultPort);
const internalHost = computed(
  () => props.database.container_name || props.database.name,
);

const sharedServerIp = useState<string | null>(
  "currentServerPublicIp",
  () => null,
);
const externalHost = computed(() => sharedServerIp.value || "<server-ip>");

const username = computed(
  () => revealed.value?.credentials?.username ?? props.database.name,
);
const databaseName = computed(
  () => revealed.value?.credentials?.database ?? props.database.name,
);
const rawPassword = computed(() => revealed.value?.credentials?.password ?? "");
const passwordDisplay = computed(() => {
  if (!revealed.value?.credentials) return "•".repeat(12);
  return showPassword.value
    ? revealed.value.credentials.password
    : "•".repeat(Math.min(16, revealed.value.credentials.password.length));
});

const urlPasswordSlot = computed(() => {
  if (!revealed.value) return "<password>";
  if (!showPassword.value) return "•".repeat(8);
  return rawPassword.value;
});

const buildConnectionURL = (host: string, port: number) => {
  const u = username.value;
  const p = urlPasswordSlot.value;
  const d = databaseName.value;
  switch (props.database.engine) {
    case "postgres":
      return `postgres://${u}:${p}@${host}:${port}/${d}`;
    case "mysql":
    case "mariadb":
      return `mysql://${u}:${p}@${host}:${port}/${d}`;
    case "redis":
      return `redis://:${p}@${host}:${port}`;
    case "mongo":
      return `mongodb://${u}:${p}@${host}:${port}`;
    default:
      return "";
  }
};

const hasExternal = computed(() => Boolean(props.database.external_port));

const setConnectionMode = (mode: ConnectionMode) => {
  if (mode === connectionMode.value) return;
  void withSmoothResize(() => {
    connectionMode.value = mode;
  });
};

const activeHost = computed(() =>
  connectionMode.value === "external" ? externalHost.value : internalHost.value,
);
const activePort = computed(() =>
  connectionMode.value === "external"
    ? (props.database.external_port ?? 0)
    : internalPort.value,
);
const activeConnectionURL = computed(() =>
  buildConnectionURL(activeHost.value, activePort.value),
);

const copyableConnectionURL = computed(() => {
  if (!revealed.value) return "";
  const host = activeHost.value;
  const port = activePort.value;
  const u = username.value;
  const p = rawPassword.value;
  const d = databaseName.value;
  switch (props.database.engine) {
    case "postgres":
      return `postgres://${u}:${p}@${host}:${port}/${d}`;
    case "mysql":
    case "mariadb":
      return `mysql://${u}:${p}@${host}:${port}/${d}`;
    case "redis":
      return `redis://:${p}@${host}:${port}`;
    case "mongo":
      return `mongodb://${u}:${p}@${host}:${port}`;
    default:
      return "";
  }
});

const urlCopyDisabled = computed(() => !revealed.value);

const defaultExposePort = computed(() => {
  switch (props.database.engine) {
    case "postgres":
      return 5432;
    case "mysql":
    case "mariadb":
      return 3306;
    case "redis":
      return 6379;
    case "mongo":
      return 27017;
    default:
      return undefined;
  }
});

watch(
  () => props.database.external_port,
  (port) => {
    exposeEnabled.value = Boolean(port);
    exposePort.value = port ?? undefined;
  },
);

const onExposeToggle = (next: boolean) => {
  void withSmoothResize(() => {
    exposeEnabled.value = next;
    if (next && !exposePort.value) {
      exposePort.value = defaultExposePort.value;
    }
  });
};

const saveExpose = async () => {
  if (exposeEnabled.value && !exposePort.value) {
    toast.error(t("workload.database.connection.portRequired"));
    return;
  }
  exposeSaving.value = true;
  try {
    await dockerService.databases.setExpose(
      props.database.server_id,
      props.database.project_id,
      props.database.id,
      {
        enabled: exposeEnabled.value,
        port: exposeEnabled.value ? exposePort.value : null,
      },
    );
    toast.success(
      exposeEnabled.value
        ? t("workload.database.connection.enablingExternal")
        : t("workload.database.connection.disablingExternal"),
    );
  } catch (err: unknown) {
    const e = err as { data?: { message?: string } };
    toast.error(
      e.data?.message || t("workload.database.connection.exposeFailed"),
    );
    exposeEnabled.value = Boolean(props.database.external_port);
    exposePort.value = props.database.external_port ?? undefined;
  } finally {
    exposeSaving.value = false;
  }
};

const exposeDirty = computed(() => {
  const wasEnabled = Boolean(props.database.external_port);
  const wasPort = props.database.external_port ?? undefined;
  if (exposeEnabled.value !== wasEnabled) return true;
  if (exposeEnabled.value && exposePort.value !== wasPort) return true;
  return false;
});

const SMOOTH_RESIZE_SELECTOR = ".dialog-smooth-resize";

async function withSmoothResize<T>(fn: () => T | Promise<T>): Promise<T> {
  const el = document.querySelector(
    SMOOTH_RESIZE_SELECTOR,
  ) as HTMLElement | null;
  if (!el) return await fn();

  const fromH = el.offsetHeight;
  el.style.height = `${fromH}px`;
  el.style.overflow = "hidden";

  const result = await fn();

  await nextTick();

  el.style.height = "";
  const toH = el.offsetHeight;
  el.style.height = `${fromH}px`;

  if (Math.abs(toH - fromH) < 2) {
    el.style.height = "";
    el.style.overflow = "";
    return result;
  }

  el.getAnimations().forEach((a) => a.cancel());
  const anim = el.animate([{ height: `${fromH}px` }, { height: `${toH}px` }], {
    duration: 200,
    easing: "ease-out",
    fill: "forwards",
  });
  const cleanup = () => {
    el.style.height = "";
    el.style.overflow = "";
    try {
      anim.cancel();
    } catch {
      // The animation may already have been cancelled by the browser.
    }
  };
  anim.addEventListener("finish", cleanup, { once: true });
  anim.addEventListener("cancel", cleanup, { once: true });

  return result;
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="dialog-smooth-resize sm:max-w-2xl">
      <DialogHeader>
        <DialogTitle>{{ t("workload.database.connection.title") }}</DialogTitle>
        <DialogDescription>
          {{
            t("workload.database.connection.description", {
              name: database.name,
              engine: engineInfo.label,
            })
          }}
        </DialogDescription>
      </DialogHeader>

      <div class="space-y-4">
        <div class="inline-flex rounded-md border bg-muted p-0.5">
          <button
            type="button"
            class="rounded px-3 py-1 text-xs font-medium transition-colors"
            :class="
              connectionMode === 'internal'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            "
            @click="setConnectionMode('internal')"
          >
            <Icon name="lucide:network" class="mr-1.5 inline h-3.5 w-3.5" />
            {{ t("workload.database.connection.internal") }}
          </button>
          <button
            type="button"
            class="rounded px-3 py-1 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50"
            :class="
              connectionMode === 'external' && hasExternal
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            "
            :disabled="!hasExternal"
            :title="
              hasExternal
                ? undefined
                : t('workload.database.connection.noExternalPort')
            "
            @click="hasExternal && setConnectionMode('external')"
          >
            <Icon name="lucide:globe" class="mr-1.5 inline h-3.5 w-3.5" />
            {{ t("workload.database.connection.external") }}
          </button>
        </div>

        <div class="rounded-lg border bg-card p-3">
          <div class="mb-2 flex items-center justify-between">
            <p
              class="text-[11px] font-medium uppercase tracking-wide text-muted-foreground"
            >
              {{ t("workload.database.connection.url") }}
            </p>
            <div class="flex items-center gap-1">
              <button
                type="button"
                class="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
                :disabled="isRevealing"
                @click="reveal"
              >
                <Icon
                  v-if="isRevealing"
                  name="lucide:loader-2"
                  class="h-3.5 w-3.5 animate-spin"
                />
                <Icon
                  v-else
                  :name="showPassword ? 'lucide:eye-off' : 'lucide:eye'"
                  class="h-3.5 w-3.5"
                />
                {{
                  revealed
                    ? showPassword
                      ? t("workload.actions.hide")
                      : t("workload.actions.show")
                    : t("workload.actions.reveal")
                }}
              </button>
              <button
                type="button"
                class="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
                :disabled="urlCopyDisabled"
                :title="
                  urlCopyDisabled
                    ? t('workload.database.connection.revealBeforeCopy')
                    : t('workload.copy.value', {
                        label: t('workload.database.connection.url'),
                      })
                "
                @click="
                  copyValue(
                    t('workload.database.connection.url'),
                    copyableConnectionURL,
                  )
                "
              >
                <Icon name="lucide:copy" class="h-3.5 w-3.5" />
                {{ t("workload.actions.copy") }}
              </button>
            </div>
          </div>
          <code
            class="block w-full whitespace-pre-wrap break-all rounded bg-muted/60 px-2 py-1.5 font-mono text-xs"
            >{{ activeConnectionURL }}</code
          >
        </div>

        <div class="divide-y rounded-lg border bg-card text-sm">
          <div class="grid grid-cols-3 items-center gap-2 px-3 py-2">
            <span class="text-muted-foreground">
              {{
                connectionMode === "external"
                  ? t("workload.database.connection.externalHost")
                  : t("workload.fields.host")
              }}
            </span>
            <code
              class="col-span-2 flex items-center justify-between gap-2 font-mono text-xs"
            >
              <span class="truncate">{{ activeHost }}</span>
              <button
                type="button"
                class="shrink-0 rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                :title="
                  t('workload.copy.value', { label: t('workload.fields.host') })
                "
                @click="copyValue(t('workload.fields.host'), activeHost)"
              >
                <Icon name="lucide:copy" class="h-3 w-3" />
              </button>
            </code>
          </div>
          <div class="grid grid-cols-3 items-center gap-2 px-3 py-2">
            <span class="text-muted-foreground">{{
              t("workload.fields.port")
            }}</span>
            <code
              class="col-span-2 flex items-center justify-between gap-2 font-mono text-xs"
            >
              <span>{{ activePort }}</span>
              <button
                type="button"
                class="shrink-0 rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                :title="
                  t('workload.copy.value', { label: t('workload.fields.port') })
                "
                @click="
                  copyValue(t('workload.fields.port'), String(activePort))
                "
              >
                <Icon name="lucide:copy" class="h-3 w-3" />
              </button>
            </code>
          </div>
          <div class="grid grid-cols-3 items-center gap-2 px-3 py-2">
            <span class="text-muted-foreground">{{
              t("workload.database.connection.database")
            }}</span>
            <code
              class="col-span-2 flex items-center justify-between gap-2 font-mono text-xs"
            >
              <span class="truncate">{{ databaseName }}</span>
              <button
                type="button"
                class="shrink-0 rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                :title="
                  t('workload.copy.value', {
                    label: t('workload.database.connection.database'),
                  })
                "
                @click="
                  copyValue(
                    t('workload.database.connection.database'),
                    databaseName,
                  )
                "
              >
                <Icon name="lucide:copy" class="h-3 w-3" />
              </button>
            </code>
          </div>
          <div class="grid grid-cols-3 items-center gap-2 px-3 py-2">
            <span class="text-muted-foreground">{{
              t("workload.database.connection.user")
            }}</span>
            <code
              class="col-span-2 flex items-center justify-between gap-2 font-mono text-xs"
            >
              <span class="truncate">{{ username }}</span>
              <button
                type="button"
                class="shrink-0 rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                :title="
                  t('workload.copy.value', {
                    label: t('workload.database.connection.user'),
                  })
                "
                @click="
                  copyValue(t('workload.database.connection.user'), username)
                "
              >
                <Icon name="lucide:copy" class="h-3 w-3" />
              </button>
            </code>
          </div>
          <div class="grid grid-cols-3 items-center gap-2 px-3 py-2">
            <span class="text-muted-foreground">{{
              t("workload.fields.password")
            }}</span>
            <code
              class="col-span-2 flex items-center justify-between gap-2 font-mono text-xs"
            >
              <span class="truncate">{{ passwordDisplay }}</span>
              <button
                type="button"
                class="shrink-0 rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
                :disabled="!rawPassword"
                :title="
                  t('workload.copy.value', {
                    label: t('workload.fields.password'),
                  })
                "
                @click="copyValue(t('workload.fields.password'), rawPassword)"
              >
                <Icon name="lucide:copy" class="h-3 w-3" />
              </button>
            </code>
          </div>
        </div>

        <p class="text-xs text-muted-foreground">
          <template v-if="connectionMode === 'internal'">
            <Icon name="lucide:info" class="-mt-0.5 mr-1 inline h-3.5 w-3.5" />
            {{ t("workload.database.connection.internalHelp") }}
          </template>
          <template v-else>
            <Icon name="lucide:info" class="-mt-0.5 mr-1 inline h-3.5 w-3.5" />
            {{ t("workload.database.connection.externalHelp") }}
          </template>
        </p>

        <div class="rounded-lg border bg-card">
          <div class="flex items-start justify-between gap-4 px-4 py-3">
            <div class="min-w-0 space-y-0.5">
              <div class="flex items-center gap-2">
                <Icon
                  name="lucide:globe"
                  class="h-4 w-4 text-muted-foreground"
                />
                <Label class="text-sm font-medium">
                  {{ t("workload.database.connection.exposeTitle") }}
                </Label>
              </div>
              <p class="text-xs text-muted-foreground">
                {{ t("workload.database.connection.exposeDescription") }}
              </p>
            </div>
            <Switch
              :model-value="exposeEnabled"
              :disabled="exposeSaving"
              class="mt-0.5 shrink-0"
              @update:model-value="onExposeToggle"
            />
          </div>

          <div
            v-if="exposeEnabled || exposeDirty"
            class="flex items-end gap-3 border-t px-4 py-3"
          >
            <div class="flex-1 space-y-1">
              <Label
                for="db-expose-port"
                class="text-[11px] uppercase tracking-wide text-muted-foreground"
              >
                {{ t("workload.database.general.externalPort") }}
              </Label>
              <Input
                id="db-expose-port"
                v-model.number="exposePort"
                type="number"
                class="h-8 text-sm"
                :disabled="!exposeEnabled"
                :placeholder="
                  defaultExposePort?.toString() ||
                  t('workload.database.connection.portPlaceholder')
                "
                autocomplete="off"
              />
            </div>
            <Button
              size="sm"
              :disabled="exposeSaving || !exposeDirty"
              @click="saveExpose"
            >
              <Icon
                v-if="exposeSaving"
                name="lucide:loader-2"
                class="mr-1.5 h-3.5 w-3.5 animate-spin"
              />
              {{ t("workload.actions.save") }}
            </Button>
          </div>
        </div>
      </div>
    </DialogContent>
  </Dialog>
</template>
