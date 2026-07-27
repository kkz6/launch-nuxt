<script setup lang="ts">
import { reactive, ref, toRefs } from "vue";
import { toast } from "vue-sonner";
import { Separator } from "~/components/ui/separator";
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

const { canDelete } = useCan();

const route = useRoute();

const activeSection = computed(
  () => (route.query.section as string) || "general",
);

type RestartPolicy = "no" | "on-failure" | "always" | "unless-stopped";

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

const isGitSource = computed(() => props.application.source_type === "git");
const isGhaApp = computed(
  () => props.application.build_location === "github_actions",
);
const seedBuilder = (bt?: string | null): "auto" | "nixpacks" | "dockerfile" =>
  bt === "dockerfile" ? "dockerfile" : bt === "nixpacks" ? "nixpacks" : "auto";

interface SecurityForm {
  username: string;
  password: string;
}

interface AdvancedState {
  nameForm: string;
  nameSaving: boolean;
  restartPolicy: RestartPolicy;
  cpuLimit: string;
  memoryLimit: string;
  cpuReservation: string;
  memoryReservation: string;
  healthcheckCommand: string;
  runtimeSaving: boolean;
  extraPortsRaw: string;
  portsSaving: boolean;
  internalPort: number | undefined;
  security: SecurityForm;
  securitySaving: boolean;
  securityRevealPassword: boolean;
  builderType: "auto" | "nixpacks" | "dockerfile";
  dockerfilePath: string;
  buildSaving: boolean;
  buildResyncing: boolean;
  deleteLoading: boolean;
  traefikFilename: string;
  traefikContent: string;
  traefikContentOnDisk: string;
  traefikLoading: boolean;
  traefikSaving: boolean;
  traefikEditing: boolean;
}

const state = reactive({
  nameForm: props.application.name,
  nameSaving: false,
  restartPolicy: (props.application.build_config?.restart_policy ||
    "unless-stopped") as RestartPolicy,
  cpuLimit: (props.application.build_config?.cpu_limit as string) || "",
  memoryLimit: (props.application.build_config?.memory_limit as string) || "",
  cpuReservation:
    (props.application.build_config?.cpu_reservation as string) || "",
  memoryReservation:
    (props.application.build_config?.memory_reservation as string) || "",
  healthcheckCommand:
    (props.application.build_config?.healthcheck_command as string) || "",
  runtimeSaving: false,
  extraPortsRaw: Array.isArray(props.application.build_config?.extra_ports)
    ? (props.application.build_config.extra_ports as string[]).join("\n")
    : "",
  portsSaving: false,
  internalPort: props.application.internal_port || undefined,
  security: seedSecurity(),
  securitySaving: false,
  securityRevealPassword: false,
  builderType: seedBuilder(props.application.build_type),
  dockerfilePath:
    (props.application.build_config?.dockerfile_path as string) || "",
  buildSaving: false,
  buildResyncing: false,
  deleteLoading: false,
  traefikFilename: "",
  traefikContent: "",
  traefikContentOnDisk: "",
  traefikLoading: true,
  traefikSaving: false,
  traefikEditing: false,
}) as AdvancedState;

const {
  nameForm,
  nameSaving,
  restartPolicy,
  cpuLimit,
  memoryLimit,
  cpuReservation,
  memoryReservation,
  healthcheckCommand,
  runtimeSaving,
  extraPortsRaw,
  portsSaving,
  internalPort,
  securitySaving,
  securityRevealPassword,
  builderType,
  dockerfilePath,
  buildSaving,
  buildResyncing,
  deleteLoading,
  traefikFilename,
  traefikContent,
  traefikContentOnDisk,
  traefikLoading,
  traefikSaving,
  traefikEditing,
} = toRefs(state);
const security = state.security;

const confirmationDialog = ref<InstanceType<
  typeof import("~/components/shared/ConfirmationDialog.vue").default
> | null>(null);

watch(
  () => props.application,
  (app) => {
    nameForm.value = app.name;
    restartPolicy.value = ((app.build_config
      ?.restart_policy as RestartPolicy) || "unless-stopped") as RestartPolicy;
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
    Object.assign(security, seedSecurity());
    builderType.value = seedBuilder(app.build_type);
    dockerfilePath.value = (app.build_config?.dockerfile_path as string) || "";
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

const saveBuild = async () => {
  const useDockerfile = builderType.value === "dockerfile";
  buildSaving.value = true;
  try {
    await dockerService.applications.update(
      props.application.server_id,
      props.application.project_id,
      props.application.id,
      {
        build_type: builderType.value,
        dockerfile_path: useDockerfile ? dockerfilePath.value.trim() : "",
      },
    );
    toast.success(
      isGhaApp.value
        ? "Build settings saved — re-sync the workflow to apply"
        : "Build settings saved — applies on next deploy",
    );
    emit("updated");
  } catch (err: unknown) {
    const e = err as { data?: { message?: string } };
    toast.error(e.data?.message || "Failed to update build settings");
  } finally {
    buildSaving.value = false;
  }
};

const resyncBuildWorkflow = async () => {
  buildResyncing.value = true;
  try {
    await dockerService.applications.resyncGhaWorkflow(
      props.application.server_id,
      props.application.project_id,
      props.application.id,
    );
    toast.success("Workflow re-sync queued");
    emit("updated");
  } catch (err: unknown) {
    const e = err as { data?: { message?: string } };
    toast.error(e.data?.message || "Failed to queue workflow re-sync");
  } finally {
    buildResyncing.value = false;
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
  for (const p of ports) {
    if (!isValidPortMapping(p)) {
      toast.error(`"${p}" doesn't look like host:container`);
      return;
    }
  }
  if (
    internalPort.value !== undefined &&
    (internalPort.value < 1 || internalPort.value > 65535)
  ) {
    toast.error("Port must be between 1 and 65535");
    return;
  }
  portsSaving.value = true;
  try {
    await dockerService.applications.updateAdvanced(
      props.application.server_id,
      props.application.project_id,
      props.application.id,
      {
        extra_ports: ports,
        ...(internalPort.value && internalPort.value > 0
          ? { internal_port: internalPort.value }
          : {}),
      },
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
  const u = security.username.trim();
  const p = security.password;
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
    traefikFilename.value = "";
    traefikContent.value = "";
    traefikContentOnDisk.value = "";
  } finally {
    traefikLoading.value = false;
  }
};

const beginModifyTraefik = () => {
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
    toast.success("Traefik config saved — Traefik picks it up automatically.");
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
  <div>
    <SharedConfirmationDialog ref="confirmationDialog" />

    <div v-show="activeSection === 'general'" class="space-y-6">
      <div class="space-y-4">
        <div>
          <h3 class="text-lg font-medium">General</h3>
          <p class="text-sm text-muted-foreground">Rename the application.</p>
        </div>

        <div class="space-y-2">
          <Label for="app-name">Name</Label>
          <Input
            id="app-name"
            v-model="nameForm"
            placeholder="e.g. api, web, worker"
            autocomplete="off"
          />
          <p class="text-sm text-muted-foreground">
            Used in the container name and the deploy log.
          </p>
        </div>

        <Button :disabled="nameSaving" @click="saveName">
          <Icon
            v-if="nameSaving"
            name="lucide:loader-2"
            class="mr-2 h-4 w-4 animate-spin"
          />
          Save Changes
        </Button>
      </div>

      <template v-if="isGitSource">
        <Separator />
        <div class="space-y-4">
          <div>
            <h3 class="text-lg font-medium">Build</h3>
            <p class="text-sm text-muted-foreground">
              How Launch builds the image from your repository.
            </p>
          </div>

          <div
            v-if="isGhaApp && application.gha_out_of_sync"
            class="flex flex-col gap-3 rounded-lg border border-amber-500/40 bg-amber-50 p-3 text-sm dark:bg-amber-950/30 sm:flex-row sm:items-center sm:justify-between"
          >
            <div class="flex items-start gap-2">
              <Icon
                name="lucide:triangle-alert"
                class="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400"
              />
              <span class="text-amber-800 dark:text-amber-200">
                Your GitHub Actions workflow is out of date. Re-sync it to
                commit the updated build config to your repository.
              </span>
            </div>
            <Button
              size="sm"
              variant="outline"
              :disabled="buildResyncing"
              class="shrink-0"
              @click="resyncBuildWorkflow"
            >
              <Icon
                v-if="buildResyncing"
                name="lucide:loader-2"
                class="mr-2 h-4 w-4 animate-spin"
              />
              Re-sync workflow
            </Button>
          </div>

          <div class="space-y-2">
            <Label for="app-builder">Builder</Label>
            <Select v-model="builderType">
              <SelectTrigger id="app-builder">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">
                  Auto-detect (Dockerfile, else Nixpacks)
                </SelectItem>
                <SelectItem value="nixpacks">Nixpacks</SelectItem>
                <SelectItem value="dockerfile">Dockerfile</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div v-if="builderType === 'dockerfile'" class="space-y-2">
            <Label for="app-dockerfile">Dockerfile location</Label>
            <Input
              id="app-dockerfile"
              v-model="dockerfilePath"
              placeholder="e.g. docker/Dockerfile — blank uses ./Dockerfile"
              autocomplete="off"
            />
            <p class="text-sm text-muted-foreground">
              Path to the Dockerfile within the repository.
            </p>
          </div>

          <p v-if="isGhaApp" class="text-sm text-muted-foreground">
            This app builds on GitHub Actions. Saving marks the committed
            workflow out of date — re-sync it to push the change to your repo.
            Server builds apply on the next deploy.
          </p>

          <Button :disabled="buildSaving" @click="saveBuild">
            <Icon
              v-if="buildSaving"
              name="lucide:loader-2"
              class="mr-2 h-4 w-4 animate-spin"
            />
            Save Build Settings
          </Button>
        </div>
      </template>
    </div>

    <ApplicationVolumes
      v-if="activeSection === 'volumes'"
      :application="application"
    />

    <div
      v-if="application.build_location === 'github_actions'"
      v-show="activeSection === 'build'"
    >
      <ApplicationGHA :application="application" @updated="$emit('updated')" />
    </div>

    <div v-show="activeSection === 'runtime'" class="space-y-6">
      <div class="space-y-4">
        <div>
          <h3 class="text-lg font-medium">Container Runtime</h3>
          <p class="text-sm text-muted-foreground">
            Resource caps + reservations, restart policy, and the container
            HEALTHCHECK. Applied on the next deploy.
          </p>
        </div>

        <div class="space-y-3">
          <div
            class="text-xs font-medium uppercase tracking-wide text-muted-foreground"
          >
            Resources
          </div>
          <div class="grid gap-4 sm:grid-cols-2">
            <div class="space-y-2">
              <Label for="app-memory-limit">Memory Limit</Label>
              <Input
                id="app-memory-limit"
                v-model="memoryLimit"
                placeholder="e.g. 512m, 1g"
                autocomplete="off"
              />
              <p class="text-sm text-muted-foreground">
                Hard ceiling (<code>-m</code>). Empty = unlimited.
              </p>
            </div>

            <div class="space-y-2">
              <Label for="app-memory-reservation">Memory Reservation</Label>
              <Input
                id="app-memory-reservation"
                v-model="memoryReservation"
                placeholder="e.g. 256m"
                autocomplete="off"
              />
              <p class="text-sm text-muted-foreground">
                Soft floor (<code>--memory-reservation</code>).
              </p>
            </div>

            <div class="space-y-2">
              <Label for="app-cpu-limit">CPU Limit</Label>
              <Input
                id="app-cpu-limit"
                v-model="cpuLimit"
                placeholder="e.g. 0.5, 2"
                autocomplete="off"
              />
              <p class="text-sm text-muted-foreground">
                CPUs (<code>--cpus</code>). Empty = unlimited.
              </p>
            </div>

            <div class="space-y-2">
              <Label for="app-cpu-reservation">CPU Reservation</Label>
              <Input
                id="app-cpu-reservation"
                v-model="cpuReservation"
                placeholder="e.g. 1024"
                autocomplete="off"
              />
              <p class="text-sm text-muted-foreground">
                CPU shares (1024 = baseline).
              </p>
            </div>
          </div>
        </div>

        <div class="space-y-3">
          <div
            class="text-xs font-medium uppercase tracking-wide text-muted-foreground"
          >
            Restart Policy
          </div>
          <div class="space-y-2">
            <Select v-model="restartPolicy">
              <SelectTrigger id="app-restart">
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
            <p class="text-sm text-muted-foreground">
              Whether the container restarts after the docker daemon (or host)
              reboots.
            </p>
          </div>
        </div>

        <div class="space-y-3">
          <div
            class="text-xs font-medium uppercase tracking-wide text-muted-foreground"
          >
            Healthcheck
          </div>
          <div class="space-y-2">
            <Input
              id="app-healthcheck"
              v-model="healthcheckCommand"
              class="font-mono"
              placeholder="curl -fsS http://localhost/health || exit 1"
              autocomplete="off"
            />
            <p class="text-sm text-muted-foreground">
              Single command run inside the container by docker's HEALTHCHECK.
              Leave blank to skip.
            </p>
          </div>
        </div>

        <Button :disabled="runtimeSaving" @click="saveRuntime">
          <Icon
            v-if="runtimeSaving"
            name="lucide:loader-2"
            class="mr-2 h-4 w-4 animate-spin"
          />
          Save Changes
        </Button>
      </div>

      <Separator />

      <div class="space-y-4">
        <div>
          <h3 class="text-lg font-medium">Security</h3>
          <p class="text-sm text-muted-foreground">
            HTTP basic-auth in front of the app via a Traefik basicauth
            middleware. Clear both fields to disable.
          </p>
        </div>

        <div class="grid gap-4 sm:grid-cols-2">
          <div class="space-y-2">
            <Label for="app-security-user">Username</Label>
            <Input
              id="app-security-user"
              v-model="security.username"
              placeholder="admin"
              autocomplete="off"
            />
          </div>
          <div class="space-y-2">
            <Label for="app-security-pass">Password</Label>
            <div class="relative">
              <Input
                id="app-security-pass"
                v-model="security.password"
                :type="securityRevealPassword ? 'text' : 'password'"
                class="pr-10"
                placeholder="••••••••"
                autocomplete="new-password"
              />
              <button
                type="button"
                class="absolute right-0 top-0 grid h-10 w-10 place-items-center text-muted-foreground hover:text-foreground"
                :title="
                  securityRevealPassword ? 'Hide password' : 'Show password'
                "
                @click="securityRevealPassword = !securityRevealPassword"
              >
                <Icon
                  :name="
                    securityRevealPassword ? 'lucide:eye-off' : 'lucide:eye'
                  "
                  class="h-4 w-4"
                />
              </button>
            </div>
          </div>
        </div>
        <p class="text-sm text-muted-foreground">
          Password is hashed by Traefik (htpasswd) at deploy time and stored in
          the application's build_config.
        </p>

        <Button :disabled="securitySaving" @click="saveSecurity">
          <Icon
            v-if="securitySaving"
            name="lucide:loader-2"
            class="mr-2 h-4 w-4 animate-spin"
          />
          Save Changes
        </Button>
      </div>

      <Separator />

      <div class="space-y-4">
        <div>
          <h3 class="text-lg font-medium">Ports</h3>
          <p class="text-sm text-muted-foreground">
            Extra <code>host:container</code> mappings, one per line. For HTTP
            apps prefer the Domains tab — Traefik handles TLS + routing. These
            are for non-HTTP services that need a raw host port.
          </p>
        </div>

        <div class="space-y-2">
          <Label for="app-internal-port">Container port</Label>
          <Input
            id="app-internal-port"
            v-model.number="internalPort"
            type="number"
            min="1"
            max="65535"
            class="max-w-[160px]"
            placeholder="80"
          />
          <p class="text-sm text-muted-foreground">
            The port your app listens on inside the container. Domains and
            health checks route to this. Applies on the next deploy.
          </p>
        </div>

        <div class="space-y-2">
          <Label for="app-extra-ports">Extra ports</Label>
          <Textarea
            id="app-extra-ports"
            v-model="extraPortsRaw"
            :rows="4"
            class="font-mono text-sm"
            placeholder="8080:80&#10;5432:5432/tcp"
          />
          <p class="text-sm text-muted-foreground">
            Each entry is appended to <code>docker run -p</code>.
          </p>
        </div>

        <Button :disabled="portsSaving" @click="savePorts">
          <Icon
            v-if="portsSaving"
            name="lucide:loader-2"
            class="mr-2 h-4 w-4 animate-spin"
          />
          Save Changes
        </Button>
      </div>
    </div>

    <div v-show="activeSection === 'proxy'" class="space-y-4">
      <div>
        <h3 class="text-lg font-medium">Traefik</h3>
        <p class="text-sm text-muted-foreground">
          Modify the traefik config, in rare cases you may need to add specific
          config, be careful because modifying incorrectly can break traefik and
          your application.
          <span
            v-if="traefikFilename"
            class="ml-1 inline-flex items-center gap-1 rounded bg-muted/50 px-1.5 py-0.5 font-mono text-xs"
            :title="`/etc/launch/traefik/dynamic/${traefikFilename}`"
          >
            <Icon name="lucide:file-text" class="h-3 w-3" />
            {{ traefikFilename }}
          </span>
        </p>
      </div>

      <div class="space-y-2">
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
          <div
            class="flex h-32 flex-col items-center justify-center rounded-md border border-dashed text-center text-xs text-muted-foreground"
          >
            <Icon name="lucide:route-off" class="mb-2 h-5 w-5" />
            No Traefik config on this server yet. Attach a domain on the Domains
            tab and deploy — or hit Modify to write the file yourself.
          </div>
        </div>
        <div v-else class="relative">
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
      </div>

      <div v-if="traefikEditing" class="flex justify-end gap-2">
        <Button
          variant="outline"
          :disabled="traefikSaving"
          @click="cancelModifyTraefik"
        >
          Cancel
        </Button>
        <Button
          :disabled="traefikSaving || !traefikDirty"
          @click="saveTraefikConfig"
        >
          <Icon
            v-if="traefikSaving"
            name="lucide:loader-2"
            class="mr-2 h-4 w-4 animate-spin"
          />
          Save
        </Button>
      </div>
    </div>

    <div v-if="canDelete" v-show="activeSection === 'danger'" class="space-y-4">
      <div>
        <h3 class="text-lg font-medium text-destructive">Danger Zone</h3>
        <p class="text-sm text-muted-foreground">
          Permanently delete this application. The container is stopped and
          removed; volumes (if any) stay on disk. This action cannot be undone.
        </p>
      </div>

      <Button
        variant="destructive"
        :disabled="deleteLoading"
        @click="deleteApplication"
      >
        <Icon
          v-if="deleteLoading"
          name="lucide:loader-2"
          class="mr-2 h-4 w-4 animate-spin"
        />
        <Icon v-else name="lucide:trash-2" class="mr-2 h-4 w-4" />
        Delete Application
      </Button>
    </div>
  </div>
</template>
