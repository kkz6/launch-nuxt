<script setup lang="ts">
import { toast } from "vue-sonner";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import {
  dockerService,
  type DockerApplication,
} from "~/services/dockerService";

interface Props {
  application: DockerApplication;
}
const props = defineProps<Props>();
const emit = defineEmits<{
  updated: [];
  deleted: [];
}>();

type RestartPolicy = "no" | "on-failure" | "always" | "unless-stopped";

// All advanced-form state lives in this single block. Mirrors the
// database Advanced layout — three cards (General / Container Runtime
// / Danger Zone) plus a Ports card unique to applications. Empty
// string in any input means "clear this knob"; the backend treats
// empty as a delete on the build_config map.

// General (rename) — used to live on the General subtab; moved here
// so the General page can be a pure read-only info-card grid like the
// database General. Settings live with settings.
const nameForm = ref(props.application.name);
const nameSaving = ref(false);
const nameDirty = computed(
  () => nameForm.value.trim() !== props.application.name,
);

// Container Runtime — CPU/memory limits + reservations + restart
// policy. Merged into a single card with a single Save button, same
// shape the database Advanced uses.
const restartPolicy = ref<RestartPolicy>(
  ((props.application.build_config?.restart_policy as RestartPolicy) ||
    "unless-stopped") as RestartPolicy,
);
const cpuLimit = ref<string>(
  (props.application.build_config?.cpu_limit as string) || "",
);
const memoryLimit = ref<string>(
  (props.application.build_config?.memory_limit as string) || "",
);
const cpuReservation = ref<string>(
  (props.application.build_config?.cpu_reservation as string) || "",
);
const memoryReservation = ref<string>(
  (props.application.build_config?.memory_reservation as string) || "",
);
const healthcheckCommand = ref<string>(
  (props.application.build_config?.healthcheck_command as string) || "",
);
const runtimeSaving = ref(false);

// Ports — extra host:container mappings. App-specific (databases
// have a single "Expose" toggle instead, because their port set is
// fixed by the engine).
const extraPortsRaw = ref<string>(
  Array.isArray(props.application.build_config?.extra_ports)
    ? (props.application.build_config!.extra_ports as string[]).join("\n")
    : "",
);
const portsSaving = ref(false);

// Security — single basic-auth row. The empty form (username and
// password both blank) clears the middleware on save; otherwise it
// writes both into build_config.security.
const seedSecurity = () => {
  const raw = props.application.build_config?.security as
    | Record<string, unknown>
    | undefined;
  if (!raw) return { username: "", password: "" };
  return {
    username: typeof raw.username === "string" ? raw.username : "",
    password: typeof raw.password === "string" ? raw.password : "",
  };
};
const security = ref(seedSecurity());
const securitySaving = ref(false);
const securityRevealPassword = ref(false);

const deleteLoading = ref(false);

const confirmationDialog = ref<
  InstanceType<typeof import("~/components/shared/ConfirmationDialog.vue").default> | null
>(null);

// Re-seed when the parent refetches the application (rename / deploy
// / WS updates push a new model). Mirrors the database Advanced
// re-seed watcher — deep:true so build_config changes propagate.
watch(
  () => props.application,
  (app) => {
    nameForm.value = app.name;
    restartPolicy.value =
      ((app.build_config?.restart_policy as RestartPolicy) ||
        "unless-stopped") as RestartPolicy;
    cpuLimit.value = (app.build_config?.cpu_limit as string) || "";
    memoryLimit.value = (app.build_config?.memory_limit as string) || "";
    cpuReservation.value = (app.build_config?.cpu_reservation as string) || "";
    memoryReservation.value =
      (app.build_config?.memory_reservation as string) || "";
    healthcheckCommand.value =
      (app.build_config?.healthcheck_command as string) || "";
    extraPortsRaw.value = Array.isArray(app.build_config?.extra_ports)
      ? (app.build_config!.extra_ports as string[]).join("\n")
      : "";
    security.value = seedSecurity();
  },
  { deep: true },
);

const saveName = async () => {
  const newName = nameForm.value.trim();
  if (!newName) {
    toast.error("Name is required");
    return;
  }
  if (newName === props.application.name) return;
  nameSaving.value = true;
  try {
    await dockerService.applications.update(
      props.application.server_id,
      props.application.project_id,
      props.application.id,
      { name: newName },
    );
    toast.success("Application renamed");
    emit("updated");
  } catch (err: unknown) {
    const e = err as { data?: { message?: string } };
    toast.error(e.data?.message || "Failed to rename application");
  } finally {
    nameSaving.value = false;
  }
};

const saveRuntime = async () => {
  runtimeSaving.value = true;
  try {
    await dockerService.applications.updateAdvanced(
      props.application.server_id,
      props.application.project_id,
      props.application.id,
      {
        restart_policy: restartPolicy.value,
        cpu_limit: cpuLimit.value.trim(),
        memory_limit: memoryLimit.value.trim(),
        cpu_reservation: cpuReservation.value.trim(),
        memory_reservation: memoryReservation.value.trim(),
        healthcheck_command: healthcheckCommand.value.trim(),
      },
    );
    toast.success("Container runtime saved — applies on next deploy");
    emit("updated");
  } catch (err: unknown) {
    const e = err as { data?: { message?: string } };
    toast.error(e.data?.message || "Failed to update container runtime");
  } finally {
    runtimeSaving.value = false;
  }
};

const savePorts = async () => {
  const ports = extraPortsRaw.value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  // Light validation — host:container with optional protocol suffix.
  for (const p of ports) {
    if (!isValidPortMapping(p)) {
      toast.error(`"${p}" doesn't look like host:container`);
      return;
    }
  }
  portsSaving.value = true;
  try {
    await dockerService.applications.updateAdvanced(
      props.application.server_id,
      props.application.project_id,
      props.application.id,
      { extra_ports: ports },
    );
    toast.success("Ports saved — applies on next deploy");
    emit("updated");
  } catch (err: unknown) {
    const e = err as { data?: { message?: string } };
    toast.error(e.data?.message || "Failed to update ports");
  } finally {
    portsSaving.value = false;
  }
};

const saveSecurity = async () => {
  const u = security.value.username.trim();
  const p = security.value.password;
  // If one is set, both must be set (dokploy enforces the same).
  if ((u && !p) || (!u && p)) {
    toast.error("Both username and password are required to enable basic auth");
    return;
  }
  securitySaving.value = true;
  try {
    await dockerService.applications.updateAdvanced(
      props.application.server_id,
      props.application.project_id,
      props.application.id,
      { security: { username: u, password: p } },
    );
    toast.success(
      u && p
        ? "Basic auth enabled — applies on next deploy"
        : "Basic auth cleared — applies on next deploy",
    );
    emit("updated");
  } catch (err: unknown) {
    const e = err as { data?: { message?: string } };
    toast.error(e.data?.message || "Failed to update security");
  } finally {
    securitySaving.value = false;
  }
};

// --- Traefik dynamic-config card ----------------------------------
//
// Mirrors dokploy's Advanced → Traefik surface. Read-only by default
// (the deploy pipeline writes this file; hand-edits get clobbered on
// the next domain change), with a "Modify" button that opens up the
// editor for emergency tweaks. Save round-trips through the backend
// which validates filename/size and writes via SSH; Traefik watches
// the dir so the change takes effect with no reload.
//
// Stays in sync with the server when the user lands on the tab:
// fetchTraefikConfig runs on mount AND whenever the lock is
// re-engaged, so re-opening Modify shows the latest on-disk state
// rather than a stale cached one.

const traefikFilename = ref("");
const traefikContent = ref("");
const traefikContentOnDisk = ref("");
const traefikLoading = ref(true);
const traefikSaving = ref(false);
const traefikEditing = ref(false);

const traefikDirty = computed(
  () => traefikContent.value !== traefikContentOnDisk.value,
);

const fetchTraefikConfig = async () => {
  traefikLoading.value = true;
  try {
    const res = await dockerService.applications.getTraefikConfig(
      props.application.server_id,
      props.application.project_id,
      props.application.id,
    );
    traefikFilename.value = res.data.filename;
    traefikContent.value = res.data.content;
    traefikContentOnDisk.value = res.data.content;
  } catch {
    // Silent: empty editor is fine. The card heading still loads;
    // the user can save to create the file if Traefik hasn't been
    // populated yet. Avoid a toast on the cold-load path because
    // the Advanced tab also triggers other fetches and stacking
    // error toasts is noisy.
    traefikFilename.value = "";
    traefikContent.value = "";
    traefikContentOnDisk.value = "";
  } finally {
    traefikLoading.value = false;
  }
};

const beginModifyTraefik = () => {
  // Re-pull so the operator edits the file as it is RIGHT NOW —
  // domains added since the page load would otherwise be invisible.
  fetchTraefikConfig().then(() => {
    traefikEditing.value = true;
  });
};

const cancelModifyTraefik = () => {
  traefikContent.value = traefikContentOnDisk.value;
  traefikEditing.value = false;
};

const saveTraefikConfig = async () => {
  traefikSaving.value = true;
  try {
    const res = await dockerService.applications.updateTraefikConfig(
      props.application.server_id,
      props.application.project_id,
      props.application.id,
      traefikContent.value,
    );
    traefikContentOnDisk.value = res.data.content;
    traefikFilename.value = res.data.filename;
    traefikEditing.value = false;
    toast.success(
      "Traefik config saved — Traefik picks it up automatically.",
    );
  } catch (err: unknown) {
    const e = err as { data?: { message?: string } };
    toast.error(e.data?.message || "Failed to save Traefik config");
  } finally {
    traefikSaving.value = false;
  }
};

onMounted(fetchTraefikConfig);

const deleteApplication = async () => {
  if (!confirmationDialog.value) return;
  const result = await confirmationDialog.value.show({
    title: "Delete Application",
    description:
      props.application.status === "running"
        ? `"${props.application.name}" is currently running. Deleting it will stop and remove the container.`
        : `Are you sure you want to delete "${props.application.name}"? This action cannot be undone.`,
    confirmText: "Delete Application",
    cancelText: "Cancel",
    destructive: true,
    helpText: "Type the application name to confirm deletion:",
    inputVerificationText: props.application.name,
    // Opt-in volume cleanup. Off by default so a misclicked Delete
    // doesn't destroy the application's persistent state (named
    // volumes declared via the Volumes subtab). Backend iterates
    // type=volume rows and `docker volume rm` each when ticked.
    checkbox: {
      label: "Also delete attached named volumes (data will be lost)",
      checked: false,
    },
  });
  if (!result.ok) return;
  const removeVolumes = !!result.checkbox?.checked;

  deleteLoading.value = true;
  try {
    await dockerService.applications.delete(
      props.application.server_id,
      props.application.project_id,
      props.application.id,
      { removeVolumes },
    );
    toast.success(
      removeVolumes
        ? "Application + named volumes deletion queued"
        : "Application deletion queued (volumes preserved)",
    );
    emit("deleted");
  } catch (err: unknown) {
    const e = err as { data?: { message?: string } };
    toast.error(e.data?.message || "Unable to delete application");
  } finally {
    deleteLoading.value = false;
  }
};
</script>

<template>
  <!--
    Grouped-cards layout — mirrors components/database/Advanced.vue.
      1. General           — rename
      2. Container Runtime — resources + restart + healthcheck (one Save)
      3. Ports             — extra host:container mappings
      4. Danger Zone       — Delete, destructive border tint

    Each editable card has Header (title + description), Content (form),
    Footer (right-aligned Save). Same `Card` primitives, same paddings,
    same label/help-text sizes the database Advanced uses.
  -->
  <div class="space-y-4">
    <SharedConfirmationDialog ref="confirmationDialog" />

    <!-- ─── General ───────────────────────────────────────────── -->
    <Card>
      <CardHeader class="p-4">
        <CardTitle class="flex items-center gap-2 text-sm font-semibold">
          <Icon name="lucide:tag" class="h-4 w-4 text-muted-foreground" />
          General
        </CardTitle>
        <CardDescription class="text-xs">
          Rename the application. Source and build settings are
          immutable until a later release adds a reconfigure flow.
        </CardDescription>
      </CardHeader>

      <CardContent class="space-y-3 p-4 pt-0">
        <div class="space-y-1 sm:max-w-md">
          <Label for="app-name" class="text-xs">Name</Label>
          <Input
            id="app-name"
            v-model="nameForm"
            class="h-9 text-sm"
            placeholder="e.g. api, web, worker"
            autocomplete="off"
          />
          <p class="text-[11px] text-muted-foreground">
            Used in the container name and the deploy log.
          </p>
        </div>
      </CardContent>

      <CardFooter class="justify-end border-t bg-muted/30 px-4 py-2">
        <Button
          size="sm"
          :disabled="!nameDirty || nameSaving"
          @click="saveName"
        >
          <Icon
            v-if="nameSaving"
            name="lucide:loader-2"
            class="mr-2 h-3.5 w-3.5 animate-spin"
          />
          Save
        </Button>
      </CardFooter>
    </Card>

    <!-- ─── Container Runtime ─────────────────────────────────── -->
    <Card>
      <CardHeader class="p-4">
        <CardTitle class="flex items-center gap-2 text-sm font-semibold">
          <Icon
            name="lucide:sliders-horizontal"
            class="h-4 w-4 text-muted-foreground"
          />
          Container Runtime
        </CardTitle>
        <CardDescription class="text-xs">
          Resource caps + reservations, restart policy, and the
          container HEALTHCHECK. Applied on the next deploy.
        </CardDescription>
      </CardHeader>

      <CardContent class="space-y-4 p-4 pt-0">
        <!-- Resources block -->
        <div class="space-y-2">
          <div
            class="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground"
          >
            Resources
          </div>
          <div class="grid gap-3 sm:grid-cols-2">
            <div class="space-y-1">
              <Label for="app-memory-limit" class="text-xs">Memory Limit</Label>
              <Input
                id="app-memory-limit"
                v-model="memoryLimit"
                class="h-9 text-sm"
                placeholder="e.g. 512m, 1g"
                autocomplete="off"
              />
              <p class="text-[11px] text-muted-foreground">
                Hard ceiling (<code>-m</code>). Empty = unlimited.
              </p>
            </div>

            <div class="space-y-1">
              <Label for="app-memory-reservation" class="text-xs">
                Memory Reservation
              </Label>
              <Input
                id="app-memory-reservation"
                v-model="memoryReservation"
                class="h-9 text-sm"
                placeholder="e.g. 256m"
                autocomplete="off"
              />
              <p class="text-[11px] text-muted-foreground">
                Soft floor (<code>--memory-reservation</code>).
              </p>
            </div>

            <div class="space-y-1">
              <Label for="app-cpu-limit" class="text-xs">CPU Limit</Label>
              <Input
                id="app-cpu-limit"
                v-model="cpuLimit"
                class="h-9 text-sm"
                placeholder="e.g. 0.5, 2"
                autocomplete="off"
              />
              <p class="text-[11px] text-muted-foreground">
                CPUs (<code>--cpus</code>). Empty = unlimited.
              </p>
            </div>

            <div class="space-y-1">
              <Label for="app-cpu-reservation" class="text-xs">
                CPU Reservation
              </Label>
              <Input
                id="app-cpu-reservation"
                v-model="cpuReservation"
                class="h-9 text-sm"
                placeholder="e.g. 1024"
                autocomplete="off"
              />
              <p class="text-[11px] text-muted-foreground">
                CPU shares (1024 = baseline).
              </p>
            </div>
          </div>
        </div>

        <!-- Restart policy block -->
        <div class="space-y-2">
          <div
            class="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground"
          >
            Restart Policy
          </div>
          <div class="space-y-1 sm:max-w-md">
            <Select v-model="restartPolicy">
              <SelectTrigger id="app-restart" class="h-9 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="unless-stopped">
                  Unless stopped (default)
                </SelectItem>
                <SelectItem value="always">Always</SelectItem>
                <SelectItem value="on-failure">On failure</SelectItem>
                <SelectItem value="no">No</SelectItem>
              </SelectContent>
            </Select>
            <p class="text-[11px] text-muted-foreground">
              Whether the container restarts after the docker daemon
              (or host) reboots.
            </p>
          </div>
        </div>

        <!-- Healthcheck block -->
        <div class="space-y-2">
          <div
            class="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground"
          >
            Healthcheck
          </div>
          <div class="space-y-1">
            <Input
              id="app-healthcheck"
              v-model="healthcheckCommand"
              class="h-9 font-mono text-sm"
              placeholder="curl -fsS http://localhost/health || exit 1"
              autocomplete="off"
            />
            <p class="text-[11px] text-muted-foreground">
              Single command run inside the container by docker's
              HEALTHCHECK. Leave blank to skip.
            </p>
          </div>
        </div>
      </CardContent>

      <CardFooter class="justify-end border-t bg-muted/30 px-4 py-2">
        <Button size="sm" :disabled="runtimeSaving" @click="saveRuntime">
          <Icon
            v-if="runtimeSaving"
            name="lucide:loader-2"
            class="mr-2 h-3.5 w-3.5 animate-spin"
          />
          Save
        </Button>
      </CardFooter>
    </Card>

    <!-- ─── Security (basic auth) ─────────────────────────────── -->
    <Card>
      <CardHeader class="p-4">
        <CardTitle class="flex items-center gap-2 text-sm font-semibold">
          <Icon name="lucide:shield-check" class="h-4 w-4 text-muted-foreground" />
          Security
        </CardTitle>
        <CardDescription class="text-xs">
          HTTP basic-auth in front of the app via a Traefik basicauth
          middleware. Clear both fields to disable.
        </CardDescription>
      </CardHeader>

      <CardContent class="space-y-3 p-4 pt-0">
        <div class="grid gap-3 sm:grid-cols-2">
          <div class="space-y-1">
            <Label for="app-security-user" class="text-xs">Username</Label>
            <Input
              id="app-security-user"
              v-model="security.username"
              class="h-9 text-sm"
              placeholder="admin"
              autocomplete="off"
            />
          </div>
          <div class="space-y-1">
            <Label for="app-security-pass" class="text-xs">Password</Label>
            <div class="relative">
              <Input
                id="app-security-pass"
                v-model="security.password"
                :type="securityRevealPassword ? 'text' : 'password'"
                class="h-9 pr-9 text-sm"
                placeholder="••••••••"
                autocomplete="new-password"
              />
              <button
                type="button"
                class="absolute right-0 top-0 grid h-9 w-9 place-items-center text-muted-foreground hover:text-foreground"
                :title="securityRevealPassword ? 'Hide password' : 'Show password'"
                @click="securityRevealPassword = !securityRevealPassword"
              >
                <Icon
                  :name="securityRevealPassword ? 'lucide:eye-off' : 'lucide:eye'"
                  class="h-3.5 w-3.5"
                />
              </button>
            </div>
          </div>
        </div>
        <p class="text-[11px] text-muted-foreground">
          Password is hashed by Traefik (htpasswd) at deploy time and
          stored in the application's build_config.
        </p>
      </CardContent>

      <CardFooter class="justify-end border-t bg-muted/30 px-4 py-2">
        <Button size="sm" :disabled="securitySaving" @click="saveSecurity">
          <Icon
            v-if="securitySaving"
            name="lucide:loader-2"
            class="mr-2 h-3.5 w-3.5 animate-spin"
          />
          Save
        </Button>
      </CardFooter>
    </Card>

    <!-- ─── Ports ─────────────────────────────────────────────── -->
    <Card>
      <CardHeader class="p-4">
        <CardTitle class="flex items-center gap-2 text-sm font-semibold">
          <Icon name="lucide:plug" class="h-4 w-4 text-muted-foreground" />
          Ports
        </CardTitle>
        <CardDescription class="text-xs">
          Extra <code>host:container</code> mappings, one per line.
          For HTTP apps prefer the Domains tab — Traefik handles TLS +
          routing. These are for non-HTTP services that need a raw
          host port.
        </CardDescription>
      </CardHeader>

      <CardContent class="p-4 pt-0">
        <div class="space-y-1">
          <Label for="app-extra-ports" class="sr-only">Extra ports</Label>
          <Textarea
            id="app-extra-ports"
            v-model="extraPortsRaw"
            :rows="4"
            class="font-mono text-sm"
            placeholder="8080:80&#10;5432:5432/tcp"
          />
          <p class="text-[11px] text-muted-foreground">
            Each entry is appended to <code>docker run -p</code>.
          </p>
        </div>
      </CardContent>

      <CardFooter class="justify-end border-t bg-muted/30 px-4 py-2">
        <Button size="sm" :disabled="portsSaving" @click="savePorts">
          <Icon
            v-if="portsSaving"
            name="lucide:loader-2"
            class="mr-2 h-3.5 w-3.5 animate-spin"
          />
          Save
        </Button>
      </CardFooter>
    </Card>

    <!-- ─── Traefik dynamic-config ────────────────────────────── -->
    <!--
      Mirrors dokploy's Advanced → Traefik card: read-only viewer with
      a Modify button that opens up the editor for emergency tweaks.
      The deploy task is the source of truth — adding a domain on the
      Domains tab regenerates this file, so manual edits get clobbered
      on the next domain change. The Save flow round-trips through
      WriteTraefikDynamicFile, which validates filename + size cap;
      Traefik watches the dir and picks up changes with no reload.
    -->
    <Card>
      <CardHeader class="p-4">
        <CardTitle class="flex items-center gap-2 text-sm font-semibold">
          <Icon name="lucide:route" class="h-4 w-4 text-muted-foreground" />
          Traefik
        </CardTitle>
        <CardDescription class="text-xs">
          Modify the traefik config, in rare cases you may need to add
          specific config, be careful because modifying incorrectly
          can break traefik and your application.
          <span
            v-if="traefikFilename"
            class="ml-1 inline-flex items-center gap-1 rounded bg-muted/50 px-1.5 py-0.5 font-mono"
            :title="`/etc/launch/traefik/dynamic/${traefikFilename}`"
          >
            <Icon name="lucide:file-text" class="h-3 w-3" />
            {{ traefikFilename }}
          </span>
        </CardDescription>
      </CardHeader>

      <CardContent class="space-y-2 p-4 pt-0">
        <div
          v-if="traefikLoading"
          class="flex h-72 items-center justify-center rounded-md border bg-muted/30"
        >
          <Icon
            name="lucide:loader-2"
            class="h-5 w-5 animate-spin text-muted-foreground"
          />
        </div>
        <div v-else-if="!traefikContent && !traefikEditing" class="relative">
          <!--
            Empty state — file doesn't exist yet on the host (first
            deploy hasn't run, or no domains attached). Modify still
            works; saving creates the file.
          -->
          <div
            class="flex h-32 flex-col items-center justify-center rounded-md border border-dashed text-center text-xs text-muted-foreground"
          >
            <Icon name="lucide:route-off" class="mb-2 h-5 w-5" />
            No Traefik config on this server yet. Attach a domain on the
            Domains tab and deploy — or hit Modify to write the file
            yourself.
          </div>
        </div>
        <div v-else class="relative">
          <!--
            Modify button overlay matches the dokploy screenshot —
            top-right above the editor. Hidden while editing because
            the Save / Cancel actions move to the footer.
          -->
          <Button
            v-if="!traefikEditing"
            size="sm"
            class="absolute right-2 top-2 z-10"
            @click="beginModifyTraefik"
          >
            <Icon name="lucide:pencil" class="mr-2 h-3.5 w-3.5" />
            Modify
          </Button>
          <SharedCodeEditor
            v-model="traefikContent"
            language="yaml"
            class="h-72 rounded-md border"
            :line-numbers="true"
            :disabled="!traefikEditing"
            placeholder="http:&#10;  routers:&#10;    ..."
          />
        </div>
      </CardContent>

      <CardFooter
        v-if="traefikEditing"
        class="justify-end gap-2 border-t bg-muted/30 px-4 py-2"
      >
        <Button
          size="sm"
          variant="outline"
          :disabled="traefikSaving"
          @click="cancelModifyTraefik"
        >
          Cancel
        </Button>
        <Button
          size="sm"
          :disabled="traefikSaving || !traefikDirty"
          @click="saveTraefikConfig"
        >
          <Icon
            v-if="traefikSaving"
            name="lucide:loader-2"
            class="mr-2 h-3.5 w-3.5 animate-spin"
          />
          Save
        </Button>
      </CardFooter>
    </Card>

    <!-- ─── Danger Zone ───────────────────────────────────────── -->
    <!--
      Same destructive-tinted border + divide-y row layout the
      database Advanced uses. Only one action for applications — no
      Rebuild row because Rebuild for apps is just "Deploy", which is
      non-destructive and lives in the Actions dropdown.
    -->
    <Card class="border-destructive/40">
      <CardHeader class="p-4">
        <CardTitle
          class="flex items-center gap-2 text-sm font-semibold text-destructive"
        >
          <Icon name="lucide:alert-triangle" class="h-4 w-4" />
          Danger Zone
        </CardTitle>
        <CardDescription class="text-xs">
          Destructive actions. Requires typing the application name
          to confirm.
        </CardDescription>
      </CardHeader>

      <CardContent class="space-y-0 divide-y p-4 pt-0">
        <div
          class="flex flex-col gap-2 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
        >
          <div class="min-w-0 space-y-0.5">
            <p class="text-sm font-medium">Delete Application</p>
            <p class="text-xs text-muted-foreground">
              Permanently delete this application. The container is
              stopped and removed; volumes (if any) stay on disk.
            </p>
          </div>
          <Button
            variant="destructive"
            size="sm"
            :disabled="deleteLoading"
            class="shrink-0"
            @click="deleteApplication"
          >
            <Icon
              v-if="deleteLoading"
              name="lucide:loader-2"
              class="mr-2 h-3.5 w-3.5 animate-spin"
            />
            <Icon v-else name="lucide:trash-2" class="mr-2 h-3.5 w-3.5" />
            Delete
          </Button>
        </div>
      </CardContent>
    </Card>
  </div>
</template>
