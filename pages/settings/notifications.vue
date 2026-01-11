<script setup lang="ts">
import { toast } from "vue-sonner";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Switch } from "~/components/ui/switch";
import { Label } from "~/components/ui/label";

definePageMeta({
  layout: "settings",
  middleware: "auth",
});

useHead({ title: "Notifications" });

interface NotificationSettings {
  email_server_created: boolean;
  email_server_deleted: boolean;
  email_deployment_success: boolean;
  email_deployment_failed: boolean;
  email_backup_success: boolean;
  email_backup_failed: boolean;
}

const settings = ref<NotificationSettings>({
  email_server_created: true,
  email_server_deleted: true,
  email_deployment_success: false,
  email_deployment_failed: true,
  email_backup_success: false,
  email_backup_failed: true,
});
const isLoading = ref(true);
const isSaving = ref(false);

const fetchSettings = async () => {
  try {
    const response = await $api<{ data: NotificationSettings }>(
      "/settings/notifications"
    );
    settings.value = response.data;
  } catch {
    // Use defaults
  } finally {
    isLoading.value = false;
  }
};

const saveSettings = async () => {
  isSaving.value = true;
  try {
    await $api("/settings/notifications", {
      method: "PUT",
      body: settings.value,
    });
    toast.success("Notification settings saved");
  } catch {
    toast.error("Failed to save settings");
  } finally {
    isSaving.value = false;
  }
};

const notificationOptions = [
  {
    key: "email_server_created",
    label: "Server Created",
    description: "Receive an email when a new server is created",
  },
  {
    key: "email_server_deleted",
    label: "Server Deleted",
    description: "Receive an email when a server is deleted",
  },
  {
    key: "email_deployment_success",
    label: "Deployment Success",
    description: "Receive an email when a deployment succeeds",
  },
  {
    key: "email_deployment_failed",
    label: "Deployment Failed",
    description: "Receive an email when a deployment fails",
  },
  {
    key: "email_backup_success",
    label: "Backup Success",
    description: "Receive an email when a backup succeeds",
  },
  {
    key: "email_backup_failed",
    label: "Backup Failed",
    description: "Receive an email when a backup fails",
  },
];

onMounted(fetchSettings);
</script>

<template>
  <div class="w-full">
    <Card class="h-full bg-transparent">
      <CardHeader>
        <CardTitle class="text-xl">Notification Settings</CardTitle>
        <CardDescription>
          Configure how you want to be notified about events
        </CardDescription>
      </CardHeader>
      <CardContent class="flex flex-col gap-4">
        <div v-if="isLoading" class="flex items-center justify-center py-8">
          <Icon
            name="lucide:loader-2"
            class="h-6 w-6 animate-spin text-muted-foreground"
          />
        </div>

        <template v-else>
          <div class="space-y-6">
            <div
              v-for="option in notificationOptions"
              :key="option.key"
              class="flex items-center justify-between rounded-lg border p-4"
            >
              <div class="space-y-0.5">
                <Label :for="option.key" class="text-base">
                  {{ option.label }}
                </Label>
                <p class="text-sm text-muted-foreground">
                  {{ option.description }}
                </p>
              </div>
              <Switch
                :id="option.key"
                v-model:checked="settings[option.key as keyof NotificationSettings]"
                @update:checked="saveSettings"
              />
            </div>
          </div>
        </template>
      </CardContent>
    </Card>
  </div>
</template>
