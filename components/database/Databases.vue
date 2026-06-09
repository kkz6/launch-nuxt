<script setup lang="ts">
import { toast } from "vue-sonner";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import {
  dockerService,
  type DockerDatabase,
} from "~/services/dockerService";

interface Props {
  database: DockerDatabase;
}
const props = defineProps<Props>();

// Role gating — members are read-only; editors+ can create databases,
// admins+ can drop them. The backend enforces the same via
// docker.database.lifecycle.
const { canEdit, canDelete } = useCan();

// Per-engine "named databases" management (#75). These are the real
// CREATE DATABASE objects living inside the running engine container —
// listed / created / dropped live over `docker exec` by the backend.
// Nothing is mirrored into our DB; every action reflects the
// container's real state. Only relational engines expose this model.
const MANAGEABLE_ENGINES = ["postgres", "mysql", "mariadb"] as const;
const isManageable = computed(() =>
  (MANAGEABLE_ENGINES as readonly string[]).includes(props.database.engine),
);

const databases = ref<string[]>([]);
const isLoading = ref(true);
const newName = ref("");
const isCreating = ref(false);

const fetchDatabases = async () => {
  if (!isManageable.value) {
    isLoading.value = false;
    return;
  }
  isLoading.value = true;
  try {
    const res = await dockerService.databases.instanceDatabases.list(
      props.database.server_id,
      props.database.project_id,
      props.database.id,
    );
    databases.value = res.data ?? [];
  } catch (err: unknown) {
    const e = err as { data?: { message?: string } };
    toast.error(e.data?.message || "Failed to load databases");
  } finally {
    isLoading.value = false;
  }
};

onMounted(fetchDatabases);

// Names are validated server-side against ^[A-Za-z0-9_]{1,64}$ — mirror
// it here so the Create button disables before a doomed round-trip and
// the user gets instant feedback.
const namePattern = /^[A-Za-z0-9_]{1,64}$/;
const canCreate = computed(
  () => namePattern.test(newName.value.trim()) && !isCreating.value,
);

const createDatabase = async () => {
  const name = newName.value.trim();
  if (!namePattern.test(name)) {
    toast.error("Name must be 1-64 letters, digits, or underscores");
    return;
  }
  isCreating.value = true;
  try {
    const res = await dockerService.databases.instanceDatabases.create(
      props.database.server_id,
      props.database.project_id,
      props.database.id,
      name,
    );
    databases.value = res.data ?? databases.value;
    newName.value = "";
    toast.success(`Database "${name}" created`);
  } catch (err: unknown) {
    const e = err as { data?: { message?: string } };
    toast.error(e.data?.message || "Unable to create database");
  } finally {
    isCreating.value = false;
  }
};

const confirmationDialog = ref<
  InstanceType<
    typeof import("~/components/shared/ConfirmationDialog.vue").default
  > | null
>(null);
const dropping = ref<string | null>(null);

const dropDatabase = async (name: string) => {
  if (!confirmationDialog.value) return;
  const result = await confirmationDialog.value.show({
    title: "Drop Database",
    description: `This permanently drops the database "${name}" and everything inside it. There is no undo.`,
    confirmText: "Drop Database",
    cancelText: "Cancel",
    destructive: true,
    helpText: "Type the database name to confirm:",
    inputVerificationText: name,
  });
  if (!result.ok) return;

  dropping.value = name;
  try {
    await dockerService.databases.instanceDatabases.drop(
      props.database.server_id,
      props.database.project_id,
      props.database.id,
      name,
    );
    databases.value = databases.value.filter((d) => d !== name);
    toast.success(`Database "${name}" dropped`);
  } catch (err: unknown) {
    const e = err as { data?: { message?: string } };
    toast.error(e.data?.message || "Unable to drop database");
  } finally {
    dropping.value = null;
  }
};
</script>

<template>
  <!--
    Lists the logical databases inside the managed engine container and
    lets the user create / drop them live (#75). Redis / Mongo don't
    share the named-databases model, so they get an explanatory empty
    state instead of the editor.
  -->
  <div class="space-y-4">
    <SharedConfirmationDialog ref="confirmationDialog" />

    <Card>
      <CardHeader class="p-4">
        <CardTitle class="flex items-center gap-2 text-sm font-semibold">
          <Icon name="lucide:database" class="h-4 w-4 text-muted-foreground" />
          Databases
        </CardTitle>
        <CardDescription class="text-xs">
          The logical databases living inside this engine instance.
          Created and dropped live on the running container — your app
          can point at any of them via the connection string.
        </CardDescription>
      </CardHeader>

      <CardContent class="p-4 pt-0">
        <!-- Unsupported engine -->
        <div
          v-if="!isManageable"
          class="flex flex-col items-center justify-center gap-2 rounded-md border border-dashed py-10 text-center"
        >
          <Icon
            name="lucide:info"
            class="h-5 w-5 text-muted-foreground"
          />
          <p class="text-sm font-medium text-foreground">
            Not supported for this engine
          </p>
          <p class="max-w-sm text-xs text-muted-foreground">
            {{ database.engine }} doesn't use the named-databases model,
            so there's nothing to manage here. This tab applies to
            PostgreSQL, MySQL, and MariaDB instances.
          </p>
        </div>

        <template v-else>
          <!-- Create row -->
          <form
            v-if="canEdit"
            class="flex items-center gap-2"
            @submit.prevent="createDatabase"
          >
            <Input
              v-model="newName"
              placeholder="new_database_name"
              class="h-9 font-mono text-sm"
              autocomplete="off"
              spellcheck="false"
            />
            <Button
              type="submit"
              size="sm"
              class="shrink-0"
              :disabled="!canCreate"
            >
              <Icon
                v-if="isCreating"
                name="lucide:loader-2"
                class="mr-1 h-4 w-4 animate-spin"
              />
              <Icon v-else name="lucide:plus" class="mr-1 h-4 w-4" />
              Create
            </Button>
          </form>
          <p v-if="canEdit" class="mt-1.5 text-[11px] text-muted-foreground">
            1–64 characters: letters, digits, or underscores.
          </p>

          <!-- Loading -->
          <div
            v-if="isLoading"
            class="mt-4 flex items-center justify-center rounded-md border border-dashed py-10"
          >
            <Icon
              name="lucide:loader-2"
              class="h-5 w-5 animate-spin text-muted-foreground"
            />
          </div>

          <!-- Empty -->
          <div
            v-else-if="databases.length === 0"
            class="mt-4 rounded-md border border-dashed py-10 text-center"
          >
            <p class="text-sm text-muted-foreground">
              No user databases yet. Create one above.
            </p>
          </div>

          <!-- List -->
          <ul v-else class="mt-4 divide-y rounded-md border">
            <li
              v-for="name in databases"
              :key="name"
              class="flex items-center justify-between gap-3 px-3 py-2.5"
            >
              <div class="flex min-w-0 items-center gap-2">
                <Icon
                  name="lucide:database"
                  class="h-4 w-4 shrink-0 text-muted-foreground"
                />
                <span class="truncate font-mono text-sm text-foreground">
                  {{ name }}
                </span>
              </div>
              <Button
                v-if="canDelete"
                size="sm"
                variant="ghost"
                class="shrink-0 text-destructive hover:bg-destructive/10 hover:text-destructive"
                :disabled="dropping === name"
                @click="dropDatabase(name)"
              >
                <Icon
                  v-if="dropping === name"
                  name="lucide:loader-2"
                  class="mr-1 h-4 w-4 animate-spin"
                />
                <Icon v-else name="lucide:trash-2" class="mr-1 h-4 w-4" />
                Drop
              </Button>
            </li>
          </ul>
        </template>
      </CardContent>
    </Card>
  </div>
</template>
