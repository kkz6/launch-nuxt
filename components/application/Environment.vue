<script setup lang="ts">
import { toast } from "vue-sonner";
import {
  dockerService,
  type CreateDockerEnvVarData,
  type DockerApplication,
  type DockerEnvVar,
} from "~/services/dockerService";

interface Props {
  application: DockerApplication;
}
const props = defineProps<Props>();

const vars = ref<DockerEnvVar[]>([]);
const isLoading = ref(true);
const isSaving = ref(false);
const showAddForm = ref(false);
const newVar = reactive({ key: "", value: "", is_secret: false });

const bulkOpen = ref(false);
const bulkText = ref("");

const confirmationDialog = ref<
  InstanceType<typeof import("~/components/shared/ConfirmationDialog.vue").default> | null
>(null);

const fetchVars = async (silent = false) => {
  if (!silent) isLoading.value = true;
  try {
    const res = await dockerService.applications.listEnvVars(
      props.application.server_id,
      props.application.project_id,
      props.application.id,
    );
    vars.value = res.data;
  } catch {
    if (!silent) toast.error("Failed to load env vars");
  } finally {
    isLoading.value = false;
  }
};

const addVar = async () => {
  const key = newVar.key.trim();
  if (!key) {
    toast.error("Key is required");
    return;
  }
  isSaving.value = true;
  try {
    const res = await dockerService.applications.createEnvVar(
      props.application.server_id,
      props.application.project_id,
      props.application.id,
      { key, value: newVar.value, is_secret: newVar.is_secret },
    );
    vars.value = [...vars.value, res.data].sort((a, b) =>
      a.key.localeCompare(b.key),
    );
    newVar.key = "";
    newVar.value = "";
    newVar.is_secret = false;
    showAddForm.value = false;
    toast.success("Env var added");
  } catch (err: unknown) {
    const e = err as { data?: { message?: string } };
    toast.error(e.data?.message || "Failed to add env var");
  } finally {
    isSaving.value = false;
  }
};

const updateVar = async (v: DockerEnvVar, patch: { value?: string; is_secret?: boolean }) => {
  try {
    const res = await dockerService.applications.updateEnvVar(
      props.application.server_id,
      props.application.project_id,
      props.application.id,
      v.id,
      patch,
    );
    const idx = vars.value.findIndex((x) => x.id === v.id);
    if (idx >= 0) vars.value[idx] = res.data;
  } catch (err: unknown) {
    const e = err as { data?: { message?: string } };
    toast.error(e.data?.message || "Failed to update env var");
  }
};

const removeVar = async (v: DockerEnvVar) => {
  if (!confirmationDialog.value) return;
  const result = await confirmationDialog.value.show({
    title: "Remove Env Var",
    description: `Remove ${v.key} from this application?`,
    confirmText: "Remove",
    cancelText: "Cancel",
    destructive: true,
  });
  if (!result.ok) return;
  try {
    await dockerService.applications.deleteEnvVar(
      props.application.server_id,
      props.application.project_id,
      props.application.id,
      v.id,
    );
    vars.value = vars.value.filter((x) => x.id !== v.id);
    toast.success("Env var removed");
  } catch (err: unknown) {
    const e = err as { data?: { message?: string } };
    toast.error(e.data?.message || "Failed to remove env var");
  }
};

// parseDotEnv is extracted to useDockerHelpers for unit testing — see
// tests/composables/useDockerHelpers.test.ts for the supported edge
// cases. is_secret=false is the safe default; users mark a row secret
// explicitly with the per-row eye toggle.
const parseDotEnvForApi = (text: string): CreateDockerEnvVarData[] =>
  parseDotEnv(text).map(({ key, value }) => ({ key, value, is_secret: false }));

const submitBulk = async () => {
  const parsed = parseDotEnvForApi(bulkText.value);
  if (parsed.length === 0) {
    toast.error("No valid KEY=VALUE lines found");
    return;
  }
  if (!confirmationDialog.value) return;
  const result = await confirmationDialog.value.show({
    title: "Replace env vars",
    description: `This replaces ALL ${vars.value.length} existing env var(s) with ${parsed.length} new one(s). Sure?`,
    confirmText: "Replace",
    cancelText: "Cancel",
    destructive: true,
  });
  if (!result.ok) return;
  isSaving.value = true;
  try {
    const res = await dockerService.applications.setEnvVars(
      props.application.server_id,
      props.application.project_id,
      props.application.id,
      { vars: parsed },
    );
    vars.value = res.data;
    bulkOpen.value = false;
    bulkText.value = "";
    toast.success(`Saved ${res.data.length} env var(s)`);
  } catch (err: unknown) {
    const e = err as { data?: { message?: string } };
    toast.error(e.data?.message || "Failed to save env vars");
  } finally {
    isSaving.value = false;
  }
};

// Per-row reveal toggle for secret values. We don't ship the cleartext
// from the backend by default — the user has to click an unlock icon,
// at which point we patch the row to set is_secret=false temporarily…
// no, that's destructive. Better: just toggle a local "showing" flag
// and rely on the fact that pressing Save on a row with the password
// box visible sends the new value through. For phase-1 simplicity:
// only let users *replace* secret values, not view existing ones.
// (We can add a reveal-one-value endpoint later if the team wants it.)
const editing = ref<Record<string, { value: string }>>({});

const startEdit = (v: DockerEnvVar) => {
  // Don't pre-fill the masked value into the edit box for secret
  // rows — that'd save "********" as the new value if the user hits
  // save without typing. Empty box = user must explicitly type.
  editing.value[v.id] = { value: v.is_secret ? "" : v.value };
};
const cancelEdit = (id: string) => {
  delete editing.value[id];
  editing.value = { ...editing.value };
};
const saveEdit = async (v: DockerEnvVar) => {
  const next = editing.value[v.id];
  if (!next) return;
  await updateVar(v, { value: next.value });
  cancelEdit(v.id);
};

onMounted(fetchVars);
</script>

<template>
  <div class="space-y-6">
    <SharedConfirmationDialog ref="confirmationDialog" />

    <div class="flex items-center justify-between">
      <div>
        <h2 class="text-xl font-semibold">Environment</h2>
        <p class="mt-1 text-sm text-muted-foreground">
          Env vars passed to the container as <code>-e KEY=VALUE</code>.
          Changes take effect on the next deploy.
        </p>
      </div>
      <div class="flex gap-2">
        <Button variant="outline" @click="bulkOpen = true">
          <Icon name="lucide:clipboard-paste" class="mr-2 h-4 w-4" />
          Paste .env
        </Button>
        <Button @click="showAddForm = !showAddForm">
          <Icon name="lucide:plus" class="mr-2 h-4 w-4" />
          Add Var
        </Button>
      </div>
    </div>

    <div
      v-if="showAddForm"
      class="space-y-3 rounded-lg border bg-card p-4"
    >
      <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div class="space-y-1">
          <Label for="env-key">Key</Label>
          <Input
            id="env-key"
            v-model="newVar.key"
            placeholder="DATABASE_URL"
            autocomplete="off"
          />
        </div>
        <div class="space-y-1">
          <Label for="env-value">Value</Label>
          <Input
            id="env-value"
            v-model="newVar.value"
            :type="newVar.is_secret ? 'password' : 'text'"
            autocomplete="off"
          />
        </div>
      </div>
      <label class="flex cursor-pointer items-center gap-2 text-sm">
        <input v-model="newVar.is_secret" type="checkbox" class="h-4 w-4" />
        Treat as secret (mask in list)
      </label>
      <div class="flex justify-end gap-2">
        <Button
          variant="outline"
          :disabled="isSaving"
          @click="showAddForm = false"
        >
          Cancel
        </Button>
        <Button :disabled="isSaving" @click="addVar">
          <Icon
            v-if="isSaving"
            name="lucide:loader-2"
            class="mr-2 h-4 w-4 animate-spin"
          />
          Add
        </Button>
      </div>
    </div>

    <div v-if="isLoading" class="flex items-center justify-center py-12">
      <Icon name="lucide:loader-2" class="h-6 w-6 animate-spin text-muted-foreground" />
    </div>

    <div
      v-else-if="vars.length === 0"
      class="flex flex-col items-center justify-center rounded-lg border border-dashed py-16"
    >
      <Icon name="lucide:key" class="h-12 w-12 text-muted-foreground" />
      <h3 class="mt-4 text-lg font-medium">No env vars yet</h3>
      <p class="mt-1 max-w-md text-center text-sm text-muted-foreground">
        Add per-app config like <code>DATABASE_URL</code> or
        <code>NODE_ENV</code>. Already have a <code>.env</code> file?
        Paste it in.
      </p>
    </div>

    <div v-else class="overflow-hidden rounded-lg border">
      <table class="w-full text-sm">
        <thead class="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            <th class="px-4 py-3">Key</th>
            <th class="px-4 py-3">Value</th>
            <th class="px-4 py-3 w-32"></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="v in vars" :key="v.id" class="border-t">
            <td class="px-4 py-3 align-top font-mono text-xs">
              {{ v.key }}
              <span
                v-if="v.is_secret"
                class="ml-2 rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-400"
              >
                secret
              </span>
            </td>
            <td class="px-4 py-3 align-top">
              <div v-if="editing[v.id]" class="flex items-center gap-2">
                <Input
                  v-model="editing[v.id].value"
                  :type="v.is_secret ? 'password' : 'text'"
                  class="font-mono text-xs"
                />
                <Button size="sm" @click="saveEdit(v)">Save</Button>
                <Button
                  size="sm"
                  variant="outline"
                  @click="cancelEdit(v.id)"
                >
                  Cancel
                </Button>
              </div>
              <button
                v-else
                class="block w-full text-left font-mono text-xs text-muted-foreground hover:text-foreground"
                @click="startEdit(v)"
              >
                {{ v.value || "(empty)" }}
              </button>
            </td>
            <td class="px-4 py-3 text-right align-top">
              <Button
                variant="ghost"
                size="icon"
                title="Toggle secret"
                @click="updateVar(v, { is_secret: !v.is_secret })"
              >
                <Icon
                  :name="v.is_secret ? 'lucide:eye-off' : 'lucide:eye'"
                  class="h-4 w-4"
                />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                title="Remove"
                @click="removeVar(v)"
              >
                <Icon name="lucide:trash-2" class="h-4 w-4" />
              </Button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <p class="text-xs text-muted-foreground">
      <Icon name="lucide:info" class="-mt-0.5 mr-1 inline-block h-3 w-3" />
      Changes here don't update the running container until you redeploy.
    </p>

    <Dialog v-model:open="bulkOpen">
      <DialogContent class="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Paste .env file</DialogTitle>
          <DialogDescription>
            Replaces the entire set of env vars on this application.
            Comments (<code>#</code>) and blank lines are skipped;
            <code>export FOO=bar</code> prefixes are tolerated.
          </DialogDescription>
        </DialogHeader>
        <Textarea
          v-model="bulkText"
          rows="12"
          class="font-mono text-xs"
          placeholder="DATABASE_URL=postgres://...&#10;NODE_ENV=production"
        />
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            :disabled="isSaving"
            @click="bulkOpen = false"
          >
            Cancel
          </Button>
          <Button :disabled="isSaving" @click="submitBulk">
            <Icon
              v-if="isSaving"
              name="lucide:loader-2"
              class="mr-2 h-4 w-4 animate-spin"
            />
            Replace env vars
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>
