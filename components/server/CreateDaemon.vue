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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import type { QueueDaemon, Server } from "~/types";

interface Props {
  server: Server;
  daemon?: QueueDaemon;
}

const props = defineProps<Props>();
const { t } = useI18n();
const serverId = computed(() => props.server.id);

// Server users with local user prioritized first
const serverUsers = computed(() => {
  const users = props.server.users;
  if (!users) {
    return [];
  }

  const result: { value: string; label: string }[] = [];

  // Add local user first (priority)
  if (users.local) {
    result.push({ value: users.local, label: users.local });
  }

  // Add root user second
  if (users.root) {
    result.push({ value: users.root, label: users.root });
  }

  return result;
});

// Get default user (local user has priority)
const defaultUser = computed(() => serverUsers.value[0]?.value || "");
const emit = defineEmits<{
  created: [];
  updated: [];
  "update:open": [value: boolean];
}>();

const open = defineModel<boolean>("open", { default: false });
const isLoading = ref(false);
const errors = ref<Record<string, string>>({});
const confirmationDialog = ref<InstanceType<
  typeof import("~/components/shared/ConfirmationDialog.vue").default
> | null>(null);

// Form values
const command = ref(props.daemon?.command || "");
const directory = ref(props.daemon?.directory || "");
const user = ref(props.daemon?.user || defaultUser.value);
const processes = ref(props.daemon?.processes || 1);
const stopWaitSeconds = ref(props.daemon?.stop_wait_seconds || 5);
const stopSignal = ref(props.daemon?.stop_signal || "SIGTERM");

const signals: Record<string, string> = {
  SIGTERM: "SIGTERM",
  SIGKILL: "SIGKILL",
  SIGINT: "SIGINT",
  SIGQUIT: "SIGQUIT",
};

const getSchema = () =>
  z.object({
    command: z.string().min(1, t("server.daemonForm.commandRequired")).max(255),
    directory: z.string().optional(),
    user: z.string().min(1, t("server.daemonForm.userRequired")),
    processes: z.number().min(1, t("server.daemonForm.processRequired")),
    stop_wait_seconds: z.number().min(0),
    stop_signal: z.string(),
  });

const canSubmit = computed(() => {
  if (isLoading.value) return false;
  if (command.value.trim().length === 0) return false;
  if (user.value.length === 0) return false;
  if (processes.value < 1) return false;
  return true;
});

const resetForm = () => {
  command.value = props.daemon?.command || "";
  directory.value = props.daemon?.directory || "";
  user.value = props.daemon?.user || defaultUser.value;
  processes.value = props.daemon?.processes || 1;
  stopWaitSeconds.value = props.daemon?.stop_wait_seconds || 5;
  stopSignal.value = props.daemon?.stop_signal || "SIGTERM";
  errors.value = {};
};

const validate = () => {
  const result = getSchema().safeParse({
    command: command.value.trim(),
    directory: directory.value.trim() || undefined,
    user: user.value,
    processes: processes.value,
    stop_wait_seconds: stopWaitSeconds.value,
    stop_signal: stopSignal.value,
  });
  if (!result.success) {
    const fieldErrors = result.error.flatten().fieldErrors;
    errors.value = {
      command: fieldErrors.command?.[0] || "",
      user: fieldErrors.user?.[0] || "",
      processes: fieldErrors.processes?.[0] || "",
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
    title: props.daemon
      ? t("server.daemonForm.updateTitle")
      : t("server.daemonForm.create"),
    description: props.daemon
      ? t("server.daemonForm.updateConfirm")
      : t("server.daemonForm.createConfirm"),
    confirmText: props.daemon
      ? t("server.common.update")
      : t("server.common.create"),
    cancelText: t("server.common.cancel"),
  });

  if (!result.ok) {
    toast.info(t("server.common.cancelled"));
    return;
  }

  isLoading.value = true;
  try {
    if (props.daemon) {
      await $api(`/servers/${serverId.value}/daemons/${props.daemon.id}`, {
        method: "PATCH",
        body: data,
      });
      toast.success(t("server.daemonForm.updated"));
      emit("updated");
    } else {
      await $api(`/servers/${serverId.value}/daemons`, {
        method: "POST",
        body: data,
      });
      toast.success(t("server.daemonForm.created"));
      emit("created");
    }
    open.value = false;
    resetForm();
  } catch (error: unknown) {
    const err = error as { data?: { message?: string } };
    toast.error(err.data?.message || t("server.common.errorOccurred"));
  } finally {
    isLoading.value = false;
  }
};

watch(open, (isOpen) => {
  if (isOpen) {
    resetForm();
  }
});
</script>

<template>
  <Dialog v-model:open="open">
    <DialogTrigger as-child>
      <Button>
        <Icon name="lucide:plus-circle" class="mr-2 h-4 w-4" />
        {{
          daemon ? t("server.daemonForm.edit") : t("server.daemonForm.create")
        }}
      </Button>
    </DialogTrigger>
    <DialogContent class="sm:max-w-3xl">
      <SharedConfirmationDialog ref="confirmationDialog" />
      <DialogHeader>
        <DialogTitle>{{
          daemon
            ? t("server.daemonForm.updateTitle")
            : t("server.daemonForm.create")
        }}</DialogTitle>
        <DialogDescription>
          {{
            daemon
              ? t("server.daemonForm.updateDescription")
              : t("server.daemonForm.createDescription")
          }}
        </DialogDescription>
      </DialogHeader>
      <form class="grid w-full gap-4" @submit.prevent="onSubmit">
        <div class="space-y-2">
          <Label for="command">{{ t("server.daemonForm.command") }}</Label>
          <Input
            id="command"
            v-model="command"
            placeholder="php artisan queue:work"
          />
          <p v-if="errors.command" class="text-sm text-destructive">
            {{ errors.command }}
          </p>
        </div>

        <div class="space-y-2">
          <Label for="directory">{{ t("server.daemonForm.directory") }}</Label>
          <Input
            id="directory"
            v-model="directory"
            placeholder="/home/launch/example.com"
          />
        </div>

        <div class="grid grid-cols-2 gap-4">
          <div class="space-y-2">
            <Label for="user">{{ t("server.daemonForm.user") }}</Label>
            <Select v-model="user">
              <SelectTrigger>
                <SelectValue :placeholder="t('server.common.selectUser')" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem
                  v-for="serverUser in serverUsers"
                  :key="serverUser.value"
                  :value="serverUser.value"
                >
                  {{ serverUser.label }}
                </SelectItem>
              </SelectContent>
            </Select>
            <p v-if="errors.user" class="text-sm text-destructive">
              {{ errors.user }}
            </p>
          </div>

          <div class="space-y-2">
            <Label for="processes">{{
              t("server.daemonForm.processes")
            }}</Label>
            <Input
              id="processes"
              v-model.number="processes"
              type="number"
              min="1"
            />
          </div>

          <div class="space-y-2">
            <Label for="stop_wait_seconds">{{
              t("server.daemonForm.stopWaitSeconds")
            }}</Label>
            <Input
              id="stop_wait_seconds"
              v-model.number="stopWaitSeconds"
              type="number"
              min="0"
            />
          </div>

          <div class="space-y-2">
            <Label for="stop_signal">{{
              t("server.daemonForm.stopSignal")
            }}</Label>
            <Select v-model="stopSignal">
              <SelectTrigger>
                <SelectValue
                  :placeholder="t('server.daemonForm.selectSignal')"
                />
              </SelectTrigger>
              <SelectContent>
                <SelectItem
                  v-for="(label, value) in signals"
                  :key="value"
                  :value="value"
                >
                  {{ label }}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button type="submit" :disabled="!canSubmit">
            <Icon
              v-if="isLoading"
              name="lucide:loader-2"
              class="mr-2 h-4 w-4 animate-spin"
            />
            {{ daemon ? t("server.common.update") : t("server.common.create") }}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
</template>
