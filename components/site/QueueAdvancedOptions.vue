<script setup lang="ts">
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { Switch } from "~/components/ui/switch";
import { Label } from "~/components/ui/label";

interface QueueValues {
  queue_connection: string;
  queue: string;
  user?: string;
  max_seconds_per_job: number;
  rest_seconds_on_empty: number;
  failed_job_delay_seconds: number;
  directory?: string;
  run_on_maintenance: boolean;
  run_with_listen: boolean;
  environment?: string;
  max_tries?: number;
  max_memory?: number;
  numprocs?: number;
  stop_wait_seconds?: number;
}

const open = defineModel<boolean>("open", { required: true });
const values = defineModel<QueueValues>("values", { required: true });
const { t } = useI18n();

const updateValue = <K extends keyof QueueValues>(
  key: K,
  value: QueueValues[K],
) => {
  values.value = { ...values.value, [key]: value };
};

const runWithListen = computed({
  get: () => Boolean(values.value.run_with_listen),
  set: (val: boolean) => updateValue("run_with_listen", val),
});

const runOnMaintenance = computed({
  get: () => Boolean(values.value.run_on_maintenance),
  set: (val: boolean) => updateValue("run_on_maintenance", val),
});
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="sm:max-w-2xl">
      <DialogHeader>
        <DialogTitle>{{ t("site.queueAdvanced.title") }}</DialogTitle>
        <DialogDescription>
          {{ t("site.queueAdvanced.description") }}
        </DialogDescription>
      </DialogHeader>

      <div class="space-y-6 py-4">
        <!-- Policies Section -->
        <div class="space-y-4 border-b pb-4">
          <h3 class="text-sm font-medium">
            {{ t("site.queueAdvanced.policies") }}
          </h3>
          <div class="grid grid-cols-2 gap-4">
            <div class="space-y-2">
              <Label>{{ t("site.queueAdvanced.maxSecondsPerJob") }}</Label>
              <Input
                type="number"
                :model-value="values.max_seconds_per_job"
                @update:model-value="
                  updateValue('max_seconds_per_job', Number($event))
                "
              />
              <p class="text-xs text-muted-foreground">
                {{ t("site.queueAdvanced.maxSecondsDescription") }}
              </p>
            </div>

            <div class="space-y-2">
              <Label>{{ t("site.queueAdvanced.restSecondsOnEmpty") }}</Label>
              <Input
                type="number"
                placeholder="3"
                :model-value="values.rest_seconds_on_empty"
                @update:model-value="
                  updateValue('rest_seconds_on_empty', Number($event))
                "
              />
            </div>

            <div class="space-y-2">
              <Label>{{ t("site.queueAdvanced.failedJobDelaySeconds") }}</Label>
              <Input
                type="number"
                placeholder="0"
                :model-value="values.failed_job_delay_seconds"
                @update:model-value="
                  updateValue('failed_job_delay_seconds', Number($event))
                "
              />
            </div>

            <div class="space-y-2">
              <Label>{{ t("site.queueAdvanced.maxTries") }}</Label>
              <Input
                type="number"
                :model-value="values.max_tries"
                @update:model-value="
                  updateValue('max_tries', $event ? Number($event) : undefined)
                "
              />
            </div>
          </div>
        </div>

        <!-- Configuration Section -->
        <div class="space-y-4">
          <h3 class="text-sm font-medium">
            {{ t("site.queueAdvanced.configuration") }}
          </h3>
          <div class="grid grid-cols-2 gap-4">
            <div class="space-y-2">
              <Label>{{ t("site.queueAdvanced.environment") }}</Label>
              <Input
                placeholder="production"
                :model-value="values.environment"
                @update:model-value="
                  updateValue(
                    'environment',
                    $event ? String($event) : undefined,
                  )
                "
              />
            </div>

            <div class="space-y-2">
              <Label>{{ t("site.queueAdvanced.maxMemory") }}</Label>
              <Input
                type="number"
                placeholder="128"
                :model-value="values.max_memory"
                @update:model-value="
                  updateValue('max_memory', $event ? Number($event) : undefined)
                "
              />
            </div>
          </div>

          <div class="space-y-2">
            <Label>{{ t("site.queueAdvanced.workingDirectory") }}</Label>
            <Input
              placeholder="/home/user/site.com"
              :model-value="values.directory"
              @update:model-value="
                updateValue('directory', $event ? String($event) : undefined)
              "
            />
          </div>

          <div class="grid grid-cols-2 gap-4">
            <div class="space-y-2">
              <Label>{{ t("site.queueAdvanced.numberOfProcesses") }}</Label>
              <Input
                type="number"
                :model-value="values.numprocs"
                @update:model-value="
                  updateValue('numprocs', $event ? Number($event) : undefined)
                "
              />
            </div>

            <div class="space-y-2">
              <Label>{{ t("site.queueAdvanced.gracefulShutdown") }}</Label>
              <Input
                type="number"
                placeholder="10"
                :model-value="values.stop_wait_seconds"
                @update:model-value="
                  updateValue(
                    'stop_wait_seconds',
                    $event ? Number($event) : undefined,
                  )
                "
              />
            </div>
          </div>

          <div class="flex items-center justify-between rounded-lg border p-4">
            <div class="space-y-0.5">
              <Label>{{ t("site.queueAdvanced.runWithListen") }}</Label>
              <p class="text-sm text-muted-foreground">
                {{ t("site.queueAdvanced.runWithListenDescription") }}
              </p>
            </div>
            <Switch v-model="runWithListen" />
          </div>

          <div class="flex items-center justify-between rounded-lg border p-4">
            <div class="space-y-0.5">
              <Label>{{ t("site.queueAdvanced.runOnMaintenance") }}</Label>
              <p class="text-sm text-muted-foreground">
                {{ t("site.queueAdvanced.runOnMaintenanceDescription") }}
              </p>
            </div>
            <Switch v-model="runOnMaintenance" />
          </div>
        </div>
      </div>

      <DialogFooter>
        <Button variant="outline" @click="open = false">
          {{ t("site.common.close") }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
