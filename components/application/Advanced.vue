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
const { t } = useI18n();
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
    toast.error(t("workload.validation.nameRequired"));
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
    toast.success(t("workload.application.advanced.renamed"));
    emit("updated");
  } catch (err: unknown) {
    const e = err as { data?: { message?: string } };
    toast.error(
      e.data?.message || t("workload.application.advanced.renameFailed"),
    );
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
        ? t("workload.application.advanced.buildSavedResync")
        : t("workload.application.advanced.buildSavedNextDeploy"),
    );
    emit("updated");
  } catch (err: unknown) {
    const e = err as { data?: { message?: string } };
    toast.error(
      e.data?.message || t("workload.application.advanced.buildSaveFailed"),
    );
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
    toast.success(t("workload.githubActions.resyncQueued"));
    emit("updated");
  } catch (err: unknown) {
    const e = err as { data?: { message?: string } };
    toast.error(e.data?.message || t("workload.githubActions.resyncFailed"));
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
    toast.success(t("workload.runtime.saved"));
    emit("updated");
  } catch (err: unknown) {
    const e = err as { data?: { message?: string } };
    toast.error(e.data?.message || t("workload.runtime.saveFailed"));
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
      toast.error(t("workload.ports.invalidMapping", { mapping: p }));
      return;
    }
  }
  if (
    internalPort.value !== undefined &&
    (internalPort.value < 1 || internalPort.value > 65535)
  ) {
    toast.error(t("workload.validation.portRange"));
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
    toast.success(t("workload.ports.saved"));
    emit("updated");
  } catch (err: unknown) {
    const e = err as { data?: { message?: string } };
    toast.error(e.data?.message || t("workload.ports.saveFailed"));
  } finally {
    portsSaving.value = false;
  }
};

const saveSecurity = async () => {
  const u = security.username.trim();
  const p = security.password;
  if ((u && !p) || (!u && p)) {
    toast.error(t("workload.security.credentialsRequired"));
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
      u && p ? t("workload.security.enabled") : t("workload.security.cleared"),
    );
    emit("updated");
  } catch (err: unknown) {
    const e = err as { data?: { message?: string } };
    toast.error(e.data?.message || t("workload.security.saveFailed"));
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
    toast.success(t("workload.traefik.saved"));
  } catch (err: unknown) {
    const e = err as { data?: { message?: string } };
    toast.error(e.data?.message || t("workload.traefik.saveFailed"));
  } finally {
    traefikSaving.value = false;
  }
};

onMounted(fetchTraefikConfig);

const deleteApplication = async () => {
  if (!confirmationDialog.value) return;
  const result = await confirmationDialog.value.show({
    title: t("workload.application.delete.title"),
    description:
      props.application.status === "running"
        ? t("workload.application.delete.runningDescription", {
            name: props.application.name,
          })
        : t("workload.application.delete.advancedDescription", {
            name: props.application.name,
          }),
    confirmText: t("workload.application.delete.title"),
    cancelText: t("workload.actions.cancel"),
    destructive: true,
    helpText: t("workload.application.delete.confirmDeletionHelp"),
    inputVerificationText: props.application.name,
    checkbox: {
      label: t("workload.application.delete.volumesLabel"),
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
        ? t("workload.application.delete.queuedWithVolumes")
        : t("workload.application.delete.queuedPreserved"),
    );
    emit("deleted");
  } catch (err: unknown) {
    const e = err as { data?: { message?: string } };
    toast.error(e.data?.message || t("workload.application.delete.unable"));
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
          <h3 class="text-lg font-medium">
            {{ t("workload.application.advanced.general") }}
          </h3>
          <p class="text-sm text-muted-foreground">
            {{ t("workload.application.advanced.renameDescription") }}
          </p>
        </div>

        <div class="space-y-2">
          <Label for="app-name">{{ t("workload.fields.name") }}</Label>
          <Input
            id="app-name"
            v-model="nameForm"
            :placeholder="t('workload.application.create.namePlaceholder')"
            autocomplete="off"
          />
          <p class="text-sm text-muted-foreground">
            {{ t("workload.application.advanced.nameHelp") }}
          </p>
        </div>

        <Button :disabled="nameSaving" @click="saveName">
          <Icon
            v-if="nameSaving"
            name="lucide:loader-2"
            class="mr-2 h-4 w-4 animate-spin"
          />
          {{ t("workload.actions.saveChanges") }}
        </Button>
      </div>

      <template v-if="isGitSource">
        <Separator />
        <div class="space-y-4">
          <div>
            <h3 class="text-lg font-medium">
              {{ t("workload.fields.build") }}
            </h3>
            <p class="text-sm text-muted-foreground">
              {{ t("workload.application.advanced.buildDescription") }}
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
                {{ t("workload.application.advanced.workflowOutdated") }}
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
              {{ t("workload.githubActions.resync") }}
            </Button>
          </div>

          <div class="space-y-2">
            <Label for="app-builder">{{ t("workload.fields.builder") }}</Label>
            <Select v-model="builderType">
              <SelectTrigger id="app-builder">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">
                  {{ t("workload.application.create.autoDetectBuilder") }}
                </SelectItem>
                <SelectItem value="nixpacks">Nixpacks</SelectItem>
                <SelectItem value="dockerfile">Dockerfile</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div v-if="builderType === 'dockerfile'" class="space-y-2">
            <Label for="app-dockerfile">{{
              t("workload.application.advanced.dockerfileLocation")
            }}</Label>
            <Input
              id="app-dockerfile"
              v-model="dockerfilePath"
              :placeholder="
                t('workload.application.advanced.dockerfilePlaceholder')
              "
              autocomplete="off"
            />
            <p class="text-sm text-muted-foreground">
              {{ t("workload.application.advanced.dockerfileHelp") }}
            </p>
          </div>

          <p v-if="isGhaApp" class="text-sm text-muted-foreground">
            {{ t("workload.application.advanced.githubActionsSaveHelp") }}
          </p>

          <Button :disabled="buildSaving" @click="saveBuild">
            <Icon
              v-if="buildSaving"
              name="lucide:loader-2"
              class="mr-2 h-4 w-4 animate-spin"
            />
            {{ t("workload.application.advanced.saveBuild") }}
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
          <h3 class="text-lg font-medium">
            {{ t("workload.runtime.title") }}
          </h3>
          <p class="text-sm text-muted-foreground">
            {{ t("workload.runtime.description") }}
          </p>
        </div>

        <div class="space-y-3">
          <div
            class="text-xs font-medium uppercase tracking-wide text-muted-foreground"
          >
            {{ t("workload.runtime.resources") }}
          </div>
          <div class="grid gap-4 sm:grid-cols-2">
            <div class="space-y-2">
              <Label for="app-memory-limit">{{
                t("workload.runtime.memoryLimit")
              }}</Label>
              <Input
                id="app-memory-limit"
                v-model="memoryLimit"
                :placeholder="
                  t('workload.database.advanced.memoryLimitPlaceholder')
                "
                autocomplete="off"
              />
              <p class="text-sm text-muted-foreground">
                {{ t("workload.runtime.memoryLimitBefore") }}
                <code>-m</code>{{ t("workload.runtime.memoryLimitAfter") }}
              </p>
            </div>

            <div class="space-y-2">
              <Label for="app-memory-reservation">{{
                t("workload.runtime.memoryReservation")
              }}</Label>
              <Input
                id="app-memory-reservation"
                v-model="memoryReservation"
                :placeholder="
                  t('workload.database.advanced.memoryReservationPlaceholder')
                "
                autocomplete="off"
              />
              <p class="text-sm text-muted-foreground">
                {{ t("workload.runtime.memoryReservationBefore") }}
                <code>--memory-reservation</code
                >{{ t("workload.punctuation.period") }}
              </p>
            </div>

            <div class="space-y-2">
              <Label for="app-cpu-limit">{{
                t("workload.runtime.cpuLimit")
              }}</Label>
              <Input
                id="app-cpu-limit"
                v-model="cpuLimit"
                :placeholder="
                  t('workload.database.advanced.cpuLimitPlaceholder')
                "
                autocomplete="off"
              />
              <p class="text-sm text-muted-foreground">
                {{ t("workload.runtime.cpuLimitBefore") }}
                <code>--cpus</code>{{ t("workload.runtime.cpuLimitAfter") }}
              </p>
            </div>

            <div class="space-y-2">
              <Label for="app-cpu-reservation">{{
                t("workload.runtime.cpuReservation")
              }}</Label>
              <Input
                id="app-cpu-reservation"
                v-model="cpuReservation"
                :placeholder="
                  t('workload.database.advanced.cpuReservationPlaceholder')
                "
                autocomplete="off"
              />
              <p class="text-sm text-muted-foreground">
                {{ t("workload.runtime.cpuReservationHelp") }}
              </p>
            </div>
          </div>
        </div>

        <div class="space-y-3">
          <div
            class="text-xs font-medium uppercase tracking-wide text-muted-foreground"
          >
            {{ t("workload.runtime.restartPolicy") }}
          </div>
          <div class="space-y-2">
            <Select v-model="restartPolicy">
              <SelectTrigger id="app-restart">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="unless-stopped">
                  {{ t("workload.runtime.unlessStopped") }}
                </SelectItem>
                <SelectItem value="always">{{
                  t("workload.runtime.always")
                }}</SelectItem>
                <SelectItem value="on-failure">{{
                  t("workload.runtime.onFailure")
                }}</SelectItem>
                <SelectItem value="no">{{
                  t("workload.runtime.no")
                }}</SelectItem>
              </SelectContent>
            </Select>
            <p class="text-sm text-muted-foreground">
              {{ t("workload.runtime.restartHelp") }}
            </p>
          </div>
        </div>

        <div class="space-y-3">
          <div
            class="text-xs font-medium uppercase tracking-wide text-muted-foreground"
          >
            {{ t("workload.runtime.healthcheck") }}
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
              {{ t("workload.runtime.healthcheckHelp") }}
            </p>
          </div>
        </div>

        <Button :disabled="runtimeSaving" @click="saveRuntime">
          <Icon
            v-if="runtimeSaving"
            name="lucide:loader-2"
            class="mr-2 h-4 w-4 animate-spin"
          />
          {{ t("workload.actions.saveChanges") }}
        </Button>
      </div>

      <Separator />

      <div class="space-y-4">
        <div>
          <h3 class="text-lg font-medium">
            {{ t("workload.security.title") }}
          </h3>
          <p class="text-sm text-muted-foreground">
            {{ t("workload.security.description") }}
          </p>
        </div>

        <div class="grid gap-4 sm:grid-cols-2">
          <div class="space-y-2">
            <Label for="app-security-user">{{
              t("workload.fields.username")
            }}</Label>
            <Input
              id="app-security-user"
              v-model="security.username"
              placeholder="admin"
              autocomplete="off"
            />
          </div>
          <div class="space-y-2">
            <Label for="app-security-pass">{{
              t("workload.fields.password")
            }}</Label>
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
                  securityRevealPassword
                    ? t('workload.security.hidePassword')
                    : t('workload.security.showPassword')
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
          {{ t("workload.security.passwordHelp") }}
        </p>

        <Button :disabled="securitySaving" @click="saveSecurity">
          <Icon
            v-if="securitySaving"
            name="lucide:loader-2"
            class="mr-2 h-4 w-4 animate-spin"
          />
          {{ t("workload.actions.saveChanges") }}
        </Button>
      </div>

      <Separator />

      <div class="space-y-4">
        <div>
          <h3 class="text-lg font-medium">{{ t("workload.ports.title") }}</h3>
          <p class="text-sm text-muted-foreground">
            {{ t("workload.ports.descriptionBefore") }}
            <code>host:container</code>
            {{ t("workload.ports.descriptionAfter") }}
          </p>
        </div>

        <div class="space-y-2">
          <Label for="app-internal-port">{{
            t("workload.domains.containerPort")
          }}</Label>
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
            {{ t("workload.ports.containerPortHelp") }}
          </p>
        </div>

        <div class="space-y-2">
          <Label for="app-extra-ports">{{
            t("workload.ports.extraPorts")
          }}</Label>
          <Textarea
            id="app-extra-ports"
            v-model="extraPortsRaw"
            :rows="4"
            class="font-mono text-sm"
            placeholder="8080:80&#10;5432:5432/tcp"
          />
          <p class="text-sm text-muted-foreground">
            {{ t("workload.ports.entryBefore") }}
            <code>docker run -p</code>{{ t("workload.punctuation.period") }}
          </p>
        </div>

        <Button :disabled="portsSaving" @click="savePorts">
          <Icon
            v-if="portsSaving"
            name="lucide:loader-2"
            class="mr-2 h-4 w-4 animate-spin"
          />
          {{ t("workload.actions.saveChanges") }}
        </Button>
      </div>
    </div>

    <div v-show="activeSection === 'proxy'" class="space-y-4">
      <div>
        <h3 class="text-lg font-medium">Traefik</h3>
        <p class="text-sm text-muted-foreground">
          {{ t("workload.traefik.description") }}
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
            {{ t("workload.traefik.applicationEmpty") }}
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
            {{ t("workload.traefik.modify") }}
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
          {{ t("workload.actions.cancel") }}
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
          {{ t("workload.actions.save") }}
        </Button>
      </div>
    </div>

    <div v-if="canDelete" v-show="activeSection === 'danger'" class="space-y-4">
      <div>
        <h3 class="text-lg font-medium text-destructive">
          {{ t("workload.danger.title") }}
        </h3>
        <p class="text-sm text-muted-foreground">
          {{ t("workload.application.advanced.dangerDescription") }}
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
        {{ t("workload.application.delete.title") }}
      </Button>
    </div>
  </div>
</template>
