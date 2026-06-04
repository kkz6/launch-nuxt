<script setup lang="ts">
import { toast } from "vue-sonner";
import * as z from "zod";
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
import { RadioGroup, RadioGroupItem } from "~/components/ui/radio-group";
import {
  dockerService,
  type DockerApplication,
  type DockerSchedule,
} from "~/services/dockerService";

interface Props {
  application: DockerApplication;
  schedule?: DockerSchedule;
}
const props = defineProps<Props>();

const emit = defineEmits<{
  created: [];
  updated: [];
  "update:open": [value: boolean];
}>();

const open = defineModel<boolean>("open", { default: false });
const isLoading = ref(false);
const errors = ref<Record<string, string>>({});
const confirmationDialog = ref<
  InstanceType<typeof import("~/components/shared/ConfirmationDialog.vue").default> | null
>(null);

// Same preset set the PHP-site CreateScheduler dialog uses. Selecting
// "custom" reveals the raw-expression input.
const frequencies: Record<string, string> = {
  "* * * * *": "Every Minute",
  "*/5 * * * *": "Every 5 Minutes",
  "*/15 * * * *": "Every 15 Minutes",
  "*/30 * * * *": "Every 30 Minutes",
  "0 * * * *": "Hourly",
  "0 0 * * *": "Daily",
  "0 0 * * 0": "Weekly",
  "0 0 1 * *": "Monthly",
  custom: "Custom Expression",
};

// When opening in edit mode, decide whether the row's cron string
// matches a preset (radio selects that preset) or doesn't (radio
// flips to "custom" and the raw expression goes in customExpression).
const isPresetCron = (c: string) =>
  Object.prototype.hasOwnProperty.call(frequencies, c);

const command = ref(props.schedule?.command || "");
const frequency = ref<string>(
  props.schedule?.cron
    ? isPresetCron(props.schedule.cron)
      ? props.schedule.cron
      : "custom"
    : "* * * * *",
);
const customExpression = ref(
  props.schedule?.cron && !isPresetCron(props.schedule.cron)
    ? props.schedule.cron
    : "",
);

// Server-side validators are already strict; this is just enough to
// stop empty submissions client-side.
const schema = z
  .object({
    command: z.string().min(1, "Command is required").max(255),
    frequency: z.string().min(1, "Frequency is required"),
    custom_expression: z.string().optional(),
  })
  .refine(
    (data) => {
      if (data.frequency === "custom") {
        return !!data.custom_expression && data.custom_expression.trim().length > 0;
      }
      return true;
    },
    {
      message: "Custom expression is required",
      path: ["custom_expression"],
    },
  );

const canSubmit = computed(() => {
  if (isLoading.value) return false;
  if (command.value.trim().length === 0) return false;
  if (frequency.value === "custom" && customExpression.value.trim().length === 0)
    return false;
  return true;
});

const resetForm = () => {
  command.value = props.schedule?.command || "";
  frequency.value = props.schedule?.cron
    ? isPresetCron(props.schedule.cron)
      ? props.schedule.cron
      : "custom"
    : "* * * * *";
  customExpression.value =
    props.schedule?.cron && !isPresetCron(props.schedule.cron)
      ? props.schedule.cron
      : "";
  errors.value = {};
};

const validate = () => {
  const result = schema.safeParse({
    command: command.value.trim(),
    frequency: frequency.value,
    custom_expression: customExpression.value.trim() || undefined,
  });
  if (!result.success) {
    const fieldErrors = result.error.flatten().fieldErrors;
    errors.value = {
      command: fieldErrors.command?.[0] || "",
      custom_expression: fieldErrors.custom_expression?.[0] || "",
    };
    return null;
  }
  errors.value = {};
  return result.data;
};

const onSubmit = async () => {
  const data = validate();
  if (!data) return;
  if (!confirmationDialog.value) return;

  const result = await confirmationDialog.value.show({
    title: props.schedule ? "Update Scheduler" : "Create Scheduler",
    description: props.schedule
      ? "Are you sure you want to update this scheduled task?"
      : "Are you sure you want to create this scheduled task?",
    confirmText: props.schedule ? "Update" : "Create",
    cancelText: "Cancel",
  });
  if (!result.ok) {
    toast.info("Cancelled");
    return;
  }

  // Resolve the cron expression we'll ship to the backend. Presets
  // are sent verbatim; "custom" sends whatever the user typed.
  const cron =
    data.frequency === "custom"
      ? (data.custom_expression || "").trim()
      : data.frequency;

  isLoading.value = true;
  try {
    if (props.schedule) {
      await dockerService.applications.updateSchedule(
        props.application.server_id,
        props.application.project_id,
        props.application.id,
        props.schedule.id,
        { cron, command: data.command },
      );
      toast.success("Scheduler updated");
      emit("updated");
    } else {
      await dockerService.applications.createSchedule(
        props.application.server_id,
        props.application.project_id,
        props.application.id,
        { cron, command: data.command },
      );
      toast.success("Scheduler created");
      emit("created");
    }
    open.value = false;
    resetForm();
  } catch (error: unknown) {
    const err = error as { data?: { message?: string } };
    toast.error(err.data?.message || "Failed to save scheduler");
  } finally {
    isLoading.value = false;
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
        <Icon name="lucide:plus-circle" class="mr-2 h-4 w-4" />
        {{ schedule ? "Edit Scheduler" : "Create Scheduler" }}
      </Button>
    </DialogTrigger>
    <DialogContent class="sm:max-w-3xl">
      <SharedConfirmationDialog ref="confirmationDialog" />
      <DialogHeader>
        <DialogTitle>
          {{ schedule ? "Update Scheduler" : "Create Scheduler" }}
        </DialogTitle>
        <DialogDescription>
          {{
            schedule
              ? "Update the scheduled task configuration."
              : "Run a recurring command inside the application's container."
          }}
        </DialogDescription>
      </DialogHeader>

      <form class="grid w-full gap-4" @submit.prevent="onSubmit">
        <div class="space-y-2">
          <Label for="sched-command">Command</Label>
          <Input
            id="sched-command"
            v-model="command"
            placeholder="rake db:migrate"
            class="font-mono text-sm"
          />
          <p v-if="errors.command" class="text-sm text-destructive">
            {{ errors.command }}
          </p>
          <p v-else class="text-xs text-muted-foreground">
            Runs as <code>docker exec &lt;container&gt; sh -c '&lt;command&gt;'</code>.
          </p>
        </div>

        <div class="space-y-2">
          <Label>Frequency</Label>
          <RadioGroup v-model="frequency" class="grid grid-cols-2 gap-2">
            <div
              v-for="(label, value) in frequencies"
              :key="value"
              class="flex items-center space-x-2"
            >
              <RadioGroupItem :id="`freq-${value}`" :value="value" />
              <Label :for="`freq-${value}`" class="font-normal">
                {{ label }}
              </Label>
            </div>
          </RadioGroup>
        </div>

        <div v-if="frequency === 'custom'" class="space-y-2">
          <Label for="custom_expression">Custom Expression</Label>
          <Input
            id="custom_expression"
            v-model="customExpression"
            placeholder="*/30 * * * *"
            class="font-mono text-sm"
          />
          <p v-if="errors.custom_expression" class="text-sm text-destructive">
            {{ errors.custom_expression }}
          </p>
          <p v-else class="text-xs text-muted-foreground">
            5 fields: minute hour day month weekday.
          </p>
        </div>

        <DialogFooter>
          <Button type="submit" :disabled="!canSubmit">
            <Icon
              v-if="isLoading"
              name="lucide:loader-2"
              class="mr-2 h-4 w-4 animate-spin"
            />
            {{ schedule ? "Update" : "Create" }}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
</template>
