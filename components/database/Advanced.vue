<script setup lang="ts">
import { toast } from "vue-sonner";
import type { DockerDatabase } from "~/services/dockerService";

interface Props {
  database: DockerDatabase;
}
const props = defineProps<Props>();

type RestartPolicy = "no" | "on-failure" | "always" | "unless-stopped";

// Default to "unless-stopped" — matches what RunDatabaseScript sets on
// fresh containers. There's no source field on the row for the current
// policy yet (we'd need a separate `docker inspect` round-trip), so
// the form starts from the same default each time and the user
// reads the actual current value in the Container tab if they need it.
const restartPolicy = ref<RestartPolicy>("unless-stopped");
const isSaving = ref(false);

const save = async () => {
  isSaving.value = true;
  try {
    const { patch } = useApi();
    await patch(
      `/servers/${props.database.server_id}/docker/projects/${props.database.project_id}/databases/${props.database.id}/advanced`,
      { restart_policy: restartPolicy.value },
    );
    toast.success("Restart policy update queued");
  } catch (err: unknown) {
    const e = err as { data?: { message?: string } };
    toast.error(e.data?.message || "Failed to update restart policy");
  } finally {
    isSaving.value = false;
  }
};
</script>

<template>
  <div class="space-y-6">
    <section class="rounded-lg border bg-card p-6">
      <h2 class="text-xl font-semibold">Advanced</h2>
      <p class="mt-1 text-sm text-muted-foreground">
        Runtime tweaks applied to the database container via
        <code>docker update</code>. No container recreation needed.
      </p>

      <form class="mt-6 max-w-md space-y-4" @submit.prevent="save">
        <div class="space-y-1">
          <Label>Restart policy</Label>
          <Select v-model="restartPolicy">
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="unless-stopped">Unless stopped (default)</SelectItem>
              <SelectItem value="always">Always</SelectItem>
              <SelectItem value="on-failure">On failure</SelectItem>
              <SelectItem value="no">No</SelectItem>
            </SelectContent>
          </Select>
          <p class="text-xs text-muted-foreground">
            Controls whether the container restarts after the docker
            daemon (or the host) reboots.
          </p>
        </div>

        <div class="flex justify-end">
          <Button type="submit" :disabled="isSaving">
            <Icon
              v-if="isSaving"
              name="lucide:loader-2"
              class="mr-2 h-4 w-4 animate-spin"
            />
            Save
          </Button>
        </div>
      </form>
    </section>

    <section class="rounded-lg border bg-card p-6 text-sm text-muted-foreground">
      <h3 class="text-base font-semibold text-foreground">Other changes need a recreate</h3>
      <p class="mt-2">
        Engine version, exposed port, and volume mounts require stopping
        and replacing the container. Use the Restart button on the
        header (or delete + recreate) for those — credentials are
        preserved between deploys.
      </p>
    </section>
  </div>
</template>
