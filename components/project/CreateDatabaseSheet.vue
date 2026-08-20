<script setup lang="ts">
import { toast } from "vue-sonner";
import {
  dockerService,
  type CreateDockerDatabaseData,
  type DockerDatabase,
  type DockerDatabaseEngine,
  type DockerDatabaseEngineCatalogue,
} from "~/services/dockerService";

interface Props {
  open: boolean;
  serverId: string;
  projectId: string;
}
const props = defineProps<Props>();
const { t } = useI18n();
const emit = defineEmits<{
  "update:open": [value: boolean];
  created: [db: DockerDatabase];
}>();

const isOpen = computed({
  get: () => props.open,
  set: (v) => emit("update:open", v),
});

const catalogue = ref<DockerDatabaseEngineCatalogue>({
  postgres: ["16"],
  mysql: ["8.0"],
  mariadb: ["11"],
  redis: ["7"],
  mongo: ["7"],
});
const engineList = computed(() =>
  (Object.keys(catalogue.value) as DockerDatabaseEngine[]).sort(),
);

const name = ref("");
const engine = ref<DockerDatabaseEngine>("postgres");
const version = ref<string>("");
const exposeExternalPort = ref(false);
// Input v-model accepts string | number | undefined, not null — keep
// the unset state as undefined so the type lines up with the form
// control's accepted shape.
const externalPort = ref<number | undefined>(undefined);
const isSubmitting = ref(false);

const versionsForEngine = computed(() => catalogue.value[engine.value] ?? []);

// Pick the first (newest) version automatically when the engine
// switches so the form is always submittable.
watch(engine, (e) => {
  version.value = catalogue.value[e]?.[0] ?? "";
});

// Default external port suggestion mirrors the engine's canonical port —
// users can override but starting from the right number reduces typos.
const portSuggestions: Record<DockerDatabaseEngine, number> = {
  postgres: 5432,
  mysql: 3306,
  mariadb: 3306,
  redis: 6379,
  mongo: 27017,
};

watch(exposeExternalPort, (on) => {
  if (on && externalPort.value === undefined) {
    externalPort.value = portSuggestions[engine.value];
  }
});
watch(engine, (e) => {
  if (exposeExternalPort.value) externalPort.value = portSuggestions[e];
});

watch(isOpen, (open) => {
  if (open) {
    name.value = "";
    engine.value = "postgres";
    version.value = catalogue.value.postgres?.[0] ?? "";
    exposeExternalPort.value = false;
    externalPort.value = undefined;
  }
});

const fetchCatalogue = async () => {
  try {
    const res = await dockerService.databases.engineCatalogue();
    catalogue.value = res.data;
    // Re-seed version once we have the real list.
    version.value = res.data[engine.value]?.[0] ?? "";
  } catch {
    // Non-fatal — defaults above keep the form usable until the
    // network call lands.
  }
};
onMounted(fetchCatalogue);

const submit = async () => {
  const trimmedName = name.value.trim();
  if (!trimmedName) {
    toast.error(t("workload.validation.nameRequired"));
    return;
  }

  const payload: CreateDockerDatabaseData = {
    name: trimmedName,
    engine: engine.value,
    version: version.value || undefined,
  };
  if (exposeExternalPort.value && externalPort.value) {
    payload.external_port = externalPort.value;
  }

  isSubmitting.value = true;
  try {
    const res = await dockerService.databases.create(
      props.serverId,
      props.projectId,
      payload,
    );
    toast.success(t("workload.database.create.queued"));
    emit("created", res.data);
  } catch (err: unknown) {
    const e = err as { data?: { message?: string } };
    toast.error(e.data?.message || t("workload.database.create.failed"));
  } finally {
    isSubmitting.value = false;
  }
};
</script>

<template>
  <Dialog v-model:open="isOpen">
    <DialogContent class="max-h-[90vh] overflow-y-auto sm:max-w-lg">
      <DialogHeader>
        <DialogTitle>{{ t("workload.database.create.title") }}</DialogTitle>
        <DialogDescription>
          {{ t("workload.database.create.descriptionBefore") }}
          <code>launch-network</code
          >{{ t("workload.database.create.descriptionAfter") }}
        </DialogDescription>
      </DialogHeader>

      <form class="space-y-4" @submit.prevent="submit">
        <div class="space-y-2">
          <Label for="db-name">{{ t("workload.fields.name") }}</Label>
          <Input
            id="db-name"
            v-model="name"
            :placeholder="t('workload.database.create.namePlaceholder')"
            autocomplete="off"
            required
          />
        </div>

        <div class="grid grid-cols-2 gap-3">
          <div class="space-y-2">
            <Label>{{ t("workload.fields.engine") }}</Label>
            <Select v-model="engine">
              <SelectTrigger>
                <SelectValue
                  :placeholder="t('workload.database.create.pickEngine')"
                />
              </SelectTrigger>
              <SelectContent>
                <SelectItem v-for="e in engineList" :key="e" :value="e">
                  {{ e }}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div class="space-y-2">
            <Label>{{ t("workload.fields.version") }}</Label>
            <Select v-model="version">
              <SelectTrigger>
                <SelectValue :placeholder="t('workload.fields.version')" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem v-for="v in versionsForEngine" :key="v" :value="v">
                  {{ v }}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div class="space-y-2 rounded-md border p-3">
          <label class="flex cursor-pointer items-center gap-2 text-sm">
            <input
              v-model="exposeExternalPort"
              type="checkbox"
              class="h-4 w-4"
            />
            {{ t("workload.database.create.exposeOnHost") }}
          </label>
          <p class="text-xs text-muted-foreground">
            {{ t("workload.database.create.exposeDescription") }}
          </p>
          <Input
            v-if="exposeExternalPort"
            v-model.number="externalPort"
            type="number"
            min="1"
            max="65535"
            class="mt-1"
          />
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            :disabled="isSubmitting"
            @click="isOpen = false"
          >
            {{ t("workload.actions.cancel") }}
          </Button>
          <Button type="submit" :disabled="isSubmitting">
            <Icon
              v-if="isSubmitting"
              name="lucide:loader-2"
              class="mr-2 h-4 w-4 animate-spin"
            />
            {{ t("workload.database.create.submit") }}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
</template>
