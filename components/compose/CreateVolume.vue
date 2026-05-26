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
  type DockerCompose,
} from "~/services/dockerService";

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

const typeOptions: {
  value: FormType;
  label: string;
  icon: string;
  blurb: string;
}[] = [
  {
    value: "file",
    label: "File Mount",
    icon: "lucide:file-text",
    blurb:
      "Write a config file under ${STACK_DIR}/files/ — YAML mounts it via ./files/<path>.",
  },
  {
    value: "volume",
    label: "Volume Mount",
    icon: "lucide:database",
    blurb:
      "Track a docker named volume the stack uses. Reference it in your YAML.",
  },
  {
    value: "bind",
    label: "Bind Mount",
    icon: "lucide:link-2",
    blurb:
      "Track a host directory the stack mounts. Reference it in your YAML.",
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
    await dockerService.composes.volumes.create(
      props.compose.server_id,
      props.compose.project_id,
      props.compose.id,
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
          File mounts are written to disk and bind-mounted by your
          YAML; bind / volume rows are tracked here but you wire them
          into the compose YAML yourself.
        </DialogDescription>
      </DialogHeader>

      <form class="grid w-full gap-4" @submit.prevent="submit">
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
            Compose doesn't rewrite your YAML — add the matching
            <code class="font-mono">volumes:</code> entry yourself
            (e.g. <code class="font-mono">{{ form.host_path || '/host/path' }}:{{ form.mount_path || '/container/path' }}</code>).
            Make sure the host path exists on the docker server.
          </template>
          <template v-else>
            Compose doesn't rewrite your YAML — add the matching
            <code class="font-mono">volumes:</code> entry yourself
            and declare the named volume at the top level of the
            compose file.
          </template>
        </div>

        <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div class="space-y-1">
            <Label for="cvol-dialog-name">Name</Label>
            <Input
              id="cvol-dialog-name"
              v-model="form.name"
              placeholder="config"
              autocomplete="off"
            />
            <p class="text-xs text-muted-foreground">
              <template v-if="form.type === 'volume'">
                Docker named-volume identifier — must match the name
                in your compose YAML's top-level
                <code class="font-mono">volumes:</code> block.
              </template>
              <template v-else>Friendly label for this mount.</template>
            </p>
          </div>
          <div class="space-y-1">
            <Label for="cvol-dialog-mount">Mount path (in the container)</Label>
            <Input
              id="cvol-dialog-mount"
              v-model="form.mount_path"
              placeholder="/etc/app/config"
              autocomplete="off"
            />
          </div>
        </div>

        <div v-if="form.type === 'bind'" class="space-y-1">
          <Label for="cvol-dialog-host">Host path</Label>
          <Input
            id="cvol-dialog-host"
            v-model="form.host_path"
            placeholder="/opt/launch/data"
            autocomplete="off"
          />
          <p class="text-xs text-muted-foreground">
            Absolute path on the docker server.
          </p>
        </div>

        <template v-if="form.type === 'file'">
          <div class="space-y-1">
            <Label for="cvol-dialog-content">Content</Label>
            <SharedCodeEditor
              v-model="form.content"
              language="properties"
              class="h-72 rounded-md border"
              :line-numbers="true"
              placeholder="NODE_ENV=production&#10;PORT=3000"
            />
            <p class="text-xs text-muted-foreground">
              File body written to the host before
              <code class="font-mono">docker compose up</code> runs.
            </p>
          </div>
          <div class="space-y-1">
            <Label for="cvol-dialog-file-path">File path (relative)</Label>
            <Input
              id="cvol-dialog-file-path"
              v-model="form.file_path"
              placeholder="nginx/site.conf"
              autocomplete="off"
            />
            <p class="text-xs text-muted-foreground">
              Written to <code class="font-mono">${{ '{STACK_DIR}' }}/files/&lt;file_path&gt;</code>.
              Reference in YAML via
              <code class="font-mono">./files/{{ form.file_path || 'your-file' }}:{{ form.mount_path || '/container/path' }}:ro</code>.
              Subpaths are honored — parents are <code class="font-mono">mkdir -p</code>'d.
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
