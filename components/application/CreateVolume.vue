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
import {
  dockerService,
  type DockerApplication,
} from "~/services/dockerService";

interface Props {
  application: DockerApplication;
}
const props = defineProps<Props>();
const emit = defineEmits<{ created: [] }>();

const open = defineModel<boolean>("open", { default: false });
const isSaving = ref(false);

// 3-flavour form state — matches dokploy's mount-kind set. `name`
// doubles as the docker-named volume for type=volume; for bind +
// file it's a friendly label the row uses in the table.
type FormType = "bind" | "volume" | "file";
const form = reactive({
  type: "bind" as FormType,
  name: "",
  mount_path: "",
  host_path: "",
  file_path: "",
  content: "",
});

const resetForm = () => {
  form.type = "bind";
  form.name = "";
  form.mount_path = "";
  form.host_path = "";
  form.file_path = "";
  form.content = "";
};

const typeOptions: {
  value: FormType;
  label: string;
  icon: string;
  blurb: string;
}[] = [
  {
    value: "bind",
    label: "Bind Mount",
    icon: "lucide:link-2",
    blurb: "Map a host directory into the container.",
  },
  {
    value: "volume",
    label: "Volume Mount",
    icon: "lucide:database",
    blurb: "Docker-named volume — survives container replacement.",
  },
  {
    value: "file",
    label: "File Mount",
    icon: "lucide:file-text",
    blurb:
      "Write a config file on the host, bind-mount it into the container.",
  },
];

const submit = async () => {
  if (!form.name.trim()) {
    toast.error("Name is required");
    return;
  }
  if (!form.mount_path.trim()) {
    toast.error("Mount path is required");
    return;
  }
  if (form.type === "bind" && !form.host_path.trim()) {
    toast.error("Bind mounts need a host path");
    return;
  }
  if (form.type === "file" && !form.file_path.trim()) {
    toast.error("File mounts need a file path (the on-host filename)");
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
    await dockerService.applications.createVolume(
      props.application.server_id,
      props.application.project_id,
      props.application.id,
      payload,
    );
    toast.success("Mount added");
    emit("created");
    open.value = false;
    resetForm();
  } catch (err: unknown) {
    const e = err as { data?: { message?: string } };
    toast.error(e.data?.message || "Failed to add mount");
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
        Add Mount
      </Button>
    </DialogTrigger>
    <DialogContent class="sm:max-w-3xl">
      <DialogHeader>
        <DialogTitle>Volumes / Mounts</DialogTitle>
        <DialogDescription>
          Three flavours — pick the one that matches what you're
          mounting. Changes apply on the next deploy.
        </DialogDescription>
      </DialogHeader>

      <form class="grid w-full gap-4" @submit.prevent="submit">
        <!-- 3-up mount-kind picker, same pattern as dokploy's
             AddVolumes RadioGroup. -->
        <div class="space-y-2">
          <Label>Select the mount type</Label>
          <div class="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <button
              v-for="t in typeOptions"
              :key="t.value"
              type="button"
              class="flex flex-col items-start gap-1 rounded-md border-2 px-3 py-3 text-left transition"
              :class="
                form.type === t.value
                  ? 'border-primary bg-primary/5 text-foreground'
                  : 'border-muted text-muted-foreground hover:border-foreground/40'
              "
              @click="form.type = t.value"
            >
              <div class="flex items-center gap-2 text-sm font-medium">
                <Icon :name="t.icon" class="h-4 w-4" />
                {{ t.label }}
              </div>
              <p class="text-xs text-muted-foreground">{{ t.blurb }}</p>
            </button>
          </div>
        </div>

        <!-- Bind-mount warning (dokploy parity). -->
        <div
          v-if="form.type === 'bind'"
          class="rounded-md border border-amber-500/40 bg-amber-500/5 p-3 text-xs text-amber-700 dark:text-amber-400"
        >
          <Icon
            name="lucide:alert-triangle"
            class="-mt-0.5 mr-1 inline-block h-3.5 w-3.5"
          />
          Make sure the host path is a valid path that exists on the
          docker server.
        </div>

        <!-- Always-shown fields. -->
        <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div class="space-y-1">
            <Label for="vol-dialog-name">Name</Label>
            <Input
              id="vol-dialog-name"
              v-model="form.name"
              placeholder="data"
              autocomplete="off"
            />
            <p class="text-xs text-muted-foreground">
              <template v-if="form.type === 'volume'">
                Docker named-volume identifier.
              </template>
              <template v-else>Friendly label for this mount.</template>
            </p>
          </div>
          <div class="space-y-1">
            <Label for="vol-dialog-mount">Mount path (in the container)</Label>
            <Input
              id="vol-dialog-mount"
              v-model="form.mount_path"
              placeholder="/var/lib/app/data"
              autocomplete="off"
            />
          </div>
        </div>

        <!-- Bind-only: host path. -->
        <div v-if="form.type === 'bind'" class="space-y-1">
          <Label for="vol-dialog-host">Host path</Label>
          <Input
            id="vol-dialog-host"
            v-model="form.host_path"
            placeholder="/opt/launch/data"
            autocomplete="off"
          />
          <p class="text-xs text-muted-foreground">
            Absolute path on the docker server. Must exist and be
            readable by the container's user.
          </p>
        </div>

        <!-- File-only: content + file path. -->
        <template v-if="form.type === 'file'">
          <div class="space-y-1">
            <Label for="vol-dialog-content">Content</Label>
            <SharedCodeEditor
              v-model="form.content"
              language="properties"
              class="h-72 rounded-md border"
              :line-numbers="true"
              placeholder="NODE_ENV=production&#10;PORT=3000"
            />
            <p class="text-xs text-muted-foreground">
              File body written to the host before the container
              starts.
            </p>
          </div>
          <div class="space-y-1">
            <Label for="vol-dialog-file-path">File path (on the host)</Label>
            <Input
              id="vol-dialog-file-path"
              v-model="form.file_path"
              placeholder="nginx.conf"
              autocomplete="off"
            />
            <p class="text-xs text-muted-foreground">
              Filename written under the application's deploy
              directory. Bind-mounted at the mount path above.
            </p>
          </div>
        </template>

        <DialogFooter>
          <Button type="button" variant="outline" @click="open = false">
            Cancel
          </Button>
          <Button type="submit" :disabled="isSaving">
            <Icon
              v-if="isSaving"
              name="lucide:loader-2"
              class="mr-2 h-4 w-4 animate-spin"
            />
            Add Mount
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
</template>
