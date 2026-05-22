<script setup lang="ts">
import { toast } from "vue-sonner";
import {
  dockerService,
  type DockerApplication,
  type DockerSchedule,
} from "~/services/dockerService";

interface Props {
  application: DockerApplication;
}
const props = defineProps<Props>();

const schedules = ref<DockerSchedule[]>([]);
const isLoading = ref(true);
const showAddForm = ref(false);
const form = reactive({ cron: "0 * * * *", command: "" });
const isSaving = ref(false);

const confirmationDialog = ref<
  InstanceType<typeof import("~/components/shared/ConfirmationDialog.vue").default> | null
>(null);

const fetchSchedules = async () => {
  isLoading.value = true;
  try {
    const res = await dockerService.applications.listSchedules(
      props.application.server_id,
      props.application.project_id,
      props.application.id,
    );
    schedules.value = res.data;
  } catch {
    toast.error("Failed to load schedules");
  } finally {
    isLoading.value = false;
  }
};

const submitAdd = async () => {
  if (!form.cron.trim() || !form.command.trim()) {
    toast.error("Cron and command are required");
    return;
  }
  if (form.cron.trim().split(/\s+/).length !== 5) {
    toast.error("Cron must be 5 fields (minute hour day month weekday)");
    return;
  }
  isSaving.value = true;
  try {
    const res = await dockerService.applications.createSchedule(
      props.application.server_id,
      props.application.project_id,
      props.application.id,
      { cron: form.cron.trim(), command: form.command.trim() },
    );
    schedules.value = [res.data, ...schedules.value];
    form.cron = "0 * * * *";
    form.command = "";
    showAddForm.value = false;
    toast.success("Schedule added");
  } catch (err: unknown) {
    const e = err as { data?: { message?: string } };
    toast.error(e.data?.message || "Failed to add schedule");
  } finally {
    isSaving.value = false;
  }
};

const removeSchedule = async (s: DockerSchedule) => {
  if (!confirmationDialog.value) return;
  const result = await confirmationDialog.value.show({
    title: "Remove schedule",
    description: `Stop running "${s.command}" on ${s.cron}?`,
    confirmText: "Remove",
    cancelText: "Cancel",
    destructive: true,
  });
  if (!result.ok) return;
  try {
    await dockerService.applications.deleteSchedule(
      props.application.server_id,
      props.application.project_id,
      props.application.id,
      s.id,
    );
    schedules.value = schedules.value.filter((x) => x.id !== s.id);
    toast.success("Schedule removed");
  } catch (err: unknown) {
    const e = err as { data?: { message?: string } };
    toast.error(e.data?.message || "Failed to remove schedule");
  }
};

onMounted(fetchSchedules);
</script>

<template>
  <div class="space-y-6">
    <SharedConfirmationDialog ref="confirmationDialog" />

    <div class="flex items-center justify-between">
      <div>
        <h2 class="text-xl font-semibold">Schedules</h2>
        <p class="mt-1 text-sm text-muted-foreground">
          Cron-style commands run inside the container. Useful for
          recurring tasks like <code>npm run migrate</code> or
          <code>php artisan cache:clear</code>.
        </p>
      </div>
      <Button @click="showAddForm = !showAddForm">
        <Icon name="lucide:plus" class="mr-2 h-4 w-4" />
        Add Schedule
      </Button>
    </div>

    <div v-if="showAddForm" class="space-y-3 rounded-lg border bg-card p-4">
      <div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div class="space-y-1 sm:col-span-1">
          <Label for="sched-cron">Cron</Label>
          <Input
            id="sched-cron"
            v-model="form.cron"
            placeholder="0 * * * *"
            autocomplete="off"
            class="font-mono text-xs"
          />
          <p class="text-xs text-muted-foreground">
            minute hour day month weekday
          </p>
        </div>
        <div class="space-y-1 sm:col-span-2">
          <Label for="sched-command">Command</Label>
          <Input
            id="sched-command"
            v-model="form.command"
            placeholder="rake db:migrate"
            autocomplete="off"
            class="font-mono text-xs"
          />
          <p class="text-xs text-muted-foreground">
            Runs as <code>docker exec &lt;container&gt; sh -c '&lt;command&gt;'</code>.
          </p>
        </div>
      </div>
      <div class="flex justify-end gap-2">
        <Button
          variant="outline"
          :disabled="isSaving"
          @click="showAddForm = false"
        >
          Cancel
        </Button>
        <Button :disabled="isSaving" @click="submitAdd">
          <Icon
            v-if="isSaving"
            name="lucide:loader-2"
            class="mr-2 h-4 w-4 animate-spin"
          />
          Add Schedule
        </Button>
      </div>
    </div>

    <div v-if="isLoading" class="flex items-center justify-center py-12">
      <Icon name="lucide:loader-2" class="h-6 w-6 animate-spin text-muted-foreground" />
    </div>

    <div
      v-else-if="schedules.length === 0"
      class="flex flex-col items-center justify-center rounded-lg border border-dashed py-16"
    >
      <Icon name="lucide:clock" class="h-12 w-12 text-muted-foreground" />
      <h3 class="mt-4 text-lg font-medium">No schedules yet</h3>
      <p class="mt-1 max-w-md text-center text-sm text-muted-foreground">
        Add a recurring task. Schedules run independent of the
        container's restart count.
      </p>
    </div>

    <div v-else class="overflow-hidden rounded-lg border">
      <table class="w-full text-sm">
        <thead class="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            <th class="px-4 py-3">Cron</th>
            <th class="px-4 py-3">Command</th>
            <th class="px-4 py-3">Last run</th>
            <th class="px-4 py-3"></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="s in schedules" :key="s.id" class="border-t">
            <td class="px-4 py-3 font-mono text-xs">{{ s.cron }}</td>
            <td class="px-4 py-3 font-mono text-xs">{{ s.command }}</td>
            <td class="px-4 py-3 text-xs text-muted-foreground">
              {{ s.last_run_at ? new Date(s.last_run_at).toLocaleString() : "—" }}
              <span v-if="s.last_status" class="ml-1">
                ({{ s.last_status }})
              </span>
            </td>
            <td class="px-4 py-3 text-right">
              <Button variant="ghost" size="icon" @click="removeSchedule(s)">
                <Icon name="lucide:trash-2" class="h-4 w-4" />
              </Button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <p class="text-xs text-muted-foreground">
      <Icon name="lucide:info" class="-mt-0.5 mr-1 inline-block h-3 w-3" />
      Schedules are persisted now; the host-side cron installation lands
      in a follow-up release. Until then, treat this tab as your
      authoritative record.
    </p>
  </div>
</template>
