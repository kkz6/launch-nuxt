<script setup lang="ts">
import { toast } from "vue-sonner";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { dockerService, type DockerCompose } from "~/services/dockerService";

// Compose volume create dialog. Same 3-flavour shape as the
// application equivalent — the form layout is identical because the
// payload contract is identical (backend uses one polymorphic
// service that branches on owner column). Differences vs the
// application form:
//
//   - bind / volume copy makes explicit they're informational on
//     compose (operator wires them into the YAML themselves)
//   - file path help text references `${STACK_DIR}/files/` instead
//     of the application deploy directory.

interface Props {
  compose: DockerCompose;
}
const props = defineProps<Props>();
const { t } = useI18n();
const emit = defineEmits<{ created: [] }>();

const open = defineModel<boolean>("open", { default: false });
const isSaving = ref(false);

type FormType = "bind" | "volume" | "file";
const form = reactive({
  type: "file" as FormType,
  name: "",
  mount_path: "",
  host_path: "",
  file_path: "",
  content: "",
});

const resetForm = () => {
  // Default to file because that's the only kind compose actually
  // materializes — bind/volume are tracking-only rows here, so they
  // shouldn't be the default "what am I adding" guess.
  form.type = "file";
  form.name = "";
  form.mount_path = "";
  form.host_path = "";
  form.file_path = "";
  form.content = "";
};

const typeOptions = computed<
  {
    value: FormType;
    label: string;
    icon: string;
    blurb: string;
  }[]
>(() => [
  {
    value: "file",
    label: t("workload.volumes.fileMount"),
    icon: "lucide:file-text",
    blurb: t("workload.volumes.composeFileDescription"),
  },
  {
    value: "volume",
    label: t("workload.volumes.volumeMount"),
    icon: "lucide:database",
    blurb: t("workload.volumes.composeVolumeDescription"),
  },
  {
    value: "bind",
    label: t("workload.volumes.bindMount"),
    icon: "lucide:link-2",
    blurb: t("workload.volumes.composeBindDescription"),
  },
]);

const submit = async () => {
  if (!form.name.trim()) {
    toast.error(t("workload.validation.nameRequired"));
    return;
  }
  if (!form.mount_path.trim()) {
    toast.error(t("workload.volumes.mountPathRequired"));
    return;
  }
  if (form.type === "bind" && !form.host_path.trim()) {
    toast.error(t("workload.volumes.hostPathRequired"));
    return;
  }
  if (form.type === "file" && !form.file_path.trim()) {
    toast.error(t("workload.volumes.filePathRequired"));
    return;
  }

  isSaving.value = true;
  try {
    const payload: import("~/services/dockerService").CreateDockerVolumeData = {
      name: form.name.trim(),
      mount_path: form.mount_path.trim(),
      type: form.type,
    };
    if (form.type === "bind") {
      payload.host_path = form.host_path.trim();
    }
    if (form.type === "file") {
      payload.file_path = form.file_path.trim();
      payload.content = form.content;
    }
    await dockerService.composes.volumes.create(
      props.compose.server_id,
      props.compose.project_id,
      props.compose.id,
      payload,
    );
    toast.success(t("workload.volumes.added"));
    emit("created");
    open.value = false;
    resetForm();
  } catch (err: unknown) {
    const e = err as { data?: { message?: string } };
    toast.error(e.data?.message || t("workload.volumes.addFailed"));
  } finally {
    isSaving.value = false;
  }
};

watch(open, (isOpen) => {
  if (isOpen) resetForm();
});
</script>

<template>
  <Dialog v-model:open="open">
    <DialogTrigger as-child>
      <Button>
        <Icon name="lucide:plus" class="mr-2 h-4 w-4" />
        {{ t("workload.volumes.add") }}
      </Button>
    </DialogTrigger>
    <DialogContent class="sm:max-w-3xl">
      <DialogHeader>
        <DialogTitle>{{ t("workload.volumes.title") }}</DialogTitle>
        <DialogDescription>
          {{ t("workload.volumes.composeCreateDescription") }}
        </DialogDescription>
      </DialogHeader>

      <form class="grid w-full gap-4" @submit.prevent="submit">
        <div class="space-y-2">
          <Label>{{ t("workload.volumes.selectType") }}</Label>
          <div class="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <button
              v-for="mountOption in typeOptions"
              :key="mountOption.value"
              type="button"
              class="flex flex-col items-start gap-1 rounded-md border-2 px-3 py-3 text-left transition"
              :class="
                form.type === mountOption.value
                  ? 'border-primary bg-primary/5 text-foreground'
                  : 'border-muted text-muted-foreground hover:border-foreground/40'
              "
              @click="form.type = mountOption.value"
            >
              <div class="flex items-center gap-2 text-sm font-medium">
                <Icon :name="mountOption.icon" class="h-4 w-4" />
                {{ mountOption.label }}
              </div>
              <p class="text-xs text-muted-foreground">
                {{ mountOption.blurb }}
              </p>
            </button>
          </div>
        </div>

        <!-- Compose-only note: bind/volume rows don't auto-wire. -->
        <div
          v-if="form.type === 'bind' || form.type === 'volume'"
          class="rounded-md border border-amber-500/40 bg-amber-500/5 p-3 text-xs text-amber-700 dark:text-amber-400"
        >
          <Icon
            name="lucide:alert-triangle"
            class="-mt-0.5 mr-1 inline-block h-3.5 w-3.5"
          />
          <template v-if="form.type === 'bind'">
            {{ t("workload.volumes.composeBindWarningBefore") }}
            <code class="font-mono">volumes:</code
            >{{ t("workload.volumes.composeBindWarningMiddle") }}
            <code class="font-mono"
              >{{ form.host_path || "/host/path" }}:{{
                form.mount_path || "/container/path"
              }}</code
            >{{ t("workload.volumes.composeBindWarningAfter") }}
          </template>
          <template v-else>
            {{ t("workload.volumes.composeVolumeWarningBefore") }}
            <code class="font-mono">volumes:</code>
            {{ t("workload.volumes.composeVolumeWarningAfter") }}
          </template>
        </div>

        <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div class="space-y-1">
            <Label for="cvol-dialog-name">{{
              t("workload.fields.name")
            }}</Label>
            <Input
              id="cvol-dialog-name"
              v-model="form.name"
              placeholder="config"
              autocomplete="off"
            />
            <p class="text-xs text-muted-foreground">
              <template v-if="form.type === 'volume'">
                {{ t("workload.volumes.composeVolumeNameBefore") }}
                <code class="font-mono">volumes:</code
                >{{ t("workload.volumes.composeVolumeNameAfter") }}
              </template>
              <template v-else>{{
                t("workload.volumes.friendlyNameHelp")
              }}</template>
            </p>
          </div>
          <div class="space-y-1">
            <Label for="cvol-dialog-mount">{{
              t("workload.volumes.mountPathContainer")
            }}</Label>
            <Input
              id="cvol-dialog-mount"
              v-model="form.mount_path"
              placeholder="/etc/app/config"
              autocomplete="off"
            />
          </div>
        </div>

        <div v-if="form.type === 'bind'" class="space-y-1">
          <Label for="cvol-dialog-host">{{
            t("workload.fields.hostPath")
          }}</Label>
          <Input
            id="cvol-dialog-host"
            v-model="form.host_path"
            placeholder="/opt/launch/data"
            autocomplete="off"
          />
          <p class="text-xs text-muted-foreground">
            {{ t("workload.volumes.absoluteHostPath") }}
          </p>
        </div>

        <template v-if="form.type === 'file'">
          <div class="space-y-1">
            <Label for="cvol-dialog-content">{{
              t("workload.fields.content")
            }}</Label>
            <SharedCodeEditor
              v-model="form.content"
              language="properties"
              class="h-72 rounded-md border"
              :line-numbers="true"
              placeholder="NODE_ENV=production&#10;PORT=3000"
            />
            <p class="text-xs text-muted-foreground">
              {{ t("workload.volumes.contentBeforeComposeUp") }}
              <code class="font-mono">docker compose up</code
              >{{ t("workload.volumes.contentAfterComposeUp") }}
            </p>
          </div>
          <div class="space-y-1">
            <Label for="cvol-dialog-file-path">{{
              t("workload.volumes.relativeFilePath")
            }}</Label>
            <Input
              id="cvol-dialog-file-path"
              v-model="form.file_path"
              placeholder="nginx/site.conf"
              autocomplete="off"
            />
            <p class="text-xs text-muted-foreground">
              {{ t("workload.volumes.relativePathBefore") }}
              <code class="font-mono"
                >${{ "{STACK_DIR}" }}/files/&lt;file_path&gt;</code
              >{{ t("workload.volumes.relativePathBetween") }}
              <code class="font-mono"
                >./files/{{ form.file_path || "your-file" }}:{{
                  form.mount_path || "/container/path"
                }}:ro</code
              >.
              {{ t("workload.volumes.relativePathAfter") }}
            </p>
          </div>
        </template>

        <DialogFooter>
          <Button type="button" variant="outline" @click="open = false">
            {{ t("workload.actions.cancel") }}
          </Button>
          <Button type="submit" :disabled="isSaving">
            <Icon
              v-if="isSaving"
              name="lucide:loader-2"
              class="mr-2 h-4 w-4 animate-spin"
            />
            {{ t("workload.volumes.add") }}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
</template>
