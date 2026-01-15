<script setup lang="ts">
import { toast } from 'vue-sonner'
import { Switch } from '~/components/ui/switch'
import { Label } from '~/components/ui/label'
import { Button } from '~/components/ui/button'

interface NotificationChannel {
  id: string
  provider: string
  label: string
  data?: {
    email?: string
    webhook_url?: string
  }
  connected: boolean
  is_default: boolean
  created_at: string
}

interface NotificationSettings {
  email_server_created: boolean
  email_server_deleted: boolean
  email_deployment_success: boolean
  email_deployment_failed: boolean
  email_backup_success: boolean
  email_backup_failed: boolean
}

const confirmationDialog = ref<InstanceType<typeof import('~/components/shared/ConfirmationDialog.vue').default> | null>(null)

// Notification channels
const channels = ref<NotificationChannel[]>([])
const isChannelsLoading = ref(true)

const channelLabels: Record<string, string> = {
  slack: 'Slack',
  discord: 'Discord',
  telegram: 'Telegram',
  email: 'Email',
}

const channelIcons: Record<string, string> = {
  slack: 'logos:slack-icon',
  discord: 'logos:discord-icon',
  telegram: 'logos:telegram',
  email: 'lucide:mail',
}

const channelColors: Record<string, string> = {
  slack: 'bg-muted',
  discord: 'bg-muted',
  telegram: 'bg-muted',
  email: 'bg-primary',
}

// Notification settings
const settings = ref<NotificationSettings>({
  email_server_created: true,
  email_server_deleted: true,
  email_deployment_success: false,
  email_deployment_failed: true,
  email_backup_success: false,
  email_backup_failed: true,
})
const isSettingsLoading = ref(true)

const getChannelDetail = (channel: NotificationChannel): string => {
  if (channel.provider === 'email' && channel.data?.email) {
    return channel.data.email
  }
  if (['slack', 'discord'].includes(channel.provider) && channel.data?.webhook_url) {
    return 'Webhook connected'
  }
  return channelLabels[channel.provider] || channel.provider
}

const fetchChannels = async () => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response = await $api<any>('/notification-channels')
    // Handle various response structures
    if (response?.data?.channels) {
      channels.value = response.data.channels
    } else if (Array.isArray(response?.data)) {
      channels.value = response.data
    } else if (Array.isArray(response?.channels)) {
      channels.value = response.channels
    } else if (Array.isArray(response)) {
      channels.value = response
    } else {
      channels.value = []
    }
  } catch {
    // Silent fail, show empty state
  } finally {
    isChannelsLoading.value = false
  }
}

const fetchSettings = async () => {
  try {
    const response = await $api<{ data: NotificationSettings }>('/settings/notifications')
    settings.value = response.data
  } catch {
    // Use defaults
  } finally {
    isSettingsLoading.value = false
  }
}

const saveSettings = async () => {
  try {
    await $api('/settings/notifications', {
      method: 'PUT',
      body: settings.value,
    })
    toast.success('Notification settings saved')
  } catch {
    toast.error('Failed to save settings')
  }
}

const deleteChannel = async (channel: NotificationChannel) => {
  if (!confirmationDialog.value) return

  const result = await confirmationDialog.value.show({
    title: 'Delete Notification Channel',
    description: `Are you sure you want to delete "${channel.label}"?`,
    confirmText: 'Delete',
    cancelText: 'Cancel',
    destructive: true,
  })

  if (result.ok) {
    try {
      await $api(`/notification-channels/${channel.id}`, { method: 'DELETE' })
      channels.value = channels.value.filter((c) => c.id !== channel.id)
      toast.success('Notification channel deleted')
    } catch {
      toast.error('Failed to delete notification channel')
    }
  }
}

const notificationOptions = [
  {
    key: 'email_server_created',
    label: 'Server Created',
    description: 'Receive a notification when a new server is created',
  },
  {
    key: 'email_server_deleted',
    label: 'Server Deleted',
    description: 'Receive a notification when a server is deleted',
  },
  {
    key: 'email_deployment_success',
    label: 'Deployment Success',
    description: 'Receive a notification when a deployment succeeds',
  },
  {
    key: 'email_deployment_failed',
    label: 'Deployment Failed',
    description: 'Receive a notification when a deployment fails',
  },
  {
    key: 'email_backup_success',
    label: 'Backup Success',
    description: 'Receive a notification when a backup succeeds',
  },
  {
    key: 'email_backup_failed',
    label: 'Backup Failed',
    description: 'Receive a notification when a backup fails',
  },
]

onMounted(() => {
  fetchChannels()
  fetchSettings()
})
</script>

<template>
  <div class="divide-y">
    <SharedConfirmationDialog ref="confirmationDialog" />

    <!-- Notification Channels Section -->
    <div class="px-6 pb-6">
      <div class="mb-4 flex items-center justify-between">
        <div>
          <h3 class="text-base font-semibold">Notification Channels</h3>
          <p class="text-sm text-muted-foreground">
            Receive notifications via Slack, Discord, Telegram, or Email.
          </p>
        </div>
        <SettingsAddNotificationChannel v-if="channels.length > 0" @created="fetchChannels" />
      </div>

      <div v-if="isChannelsLoading" class="flex items-center justify-center py-4">
        <Icon name="lucide:loader-2" class="h-5 w-5 animate-spin text-muted-foreground" />
      </div>

      <template v-else>
        <div v-if="channels.length === 0" class="rounded-lg border p-4">
          <div class="flex flex-col items-center gap-3 py-4">
            <Icon name="lucide:bell" class="h-10 w-10 text-muted-foreground" />
            <div class="text-center">
              <p class="font-medium">No notification channels</p>
              <p class="text-sm text-muted-foreground">Connect a channel to receive alerts</p>
            </div>
            <SettingsAddNotificationChannel @created="fetchChannels" />
          </div>
        </div>

        <div v-else class="space-y-2">
          <div
            v-for="channel in channels"
            :key="channel.id"
            class="group flex items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/50"
          >
            <div
              class="flex h-10 w-10 items-center justify-center rounded-lg"
              :class="[
                channelColors[channel.provider] || 'bg-muted',
                channel.provider === 'email' ? 'text-primary-foreground' : ''
              ]"
            >
              <Icon :name="channelIcons[channel.provider] || 'lucide:bell'" class="h-5 w-5" />
            </div>
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2">
                <span class="font-medium">{{ channel.label }}</span>
                <span
                  v-if="channel.connected"
                  class="inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400"
                >
                  <span class="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  Active
                </span>
              </div>
              <p class="truncate text-sm text-muted-foreground">
                {{ getChannelDetail(channel) }}
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              class="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
              @click="deleteChannel(channel)"
            >
              <Icon name="lucide:trash-2" class="h-4 w-4 text-muted-foreground hover:text-destructive" />
            </Button>
          </div>
        </div>
      </template>
    </div>

    <!-- Email Notifications Section -->
    <div class="px-6 pt-6">
      <h3 class="mb-1 text-base font-semibold">Email Notifications</h3>
      <p class="mb-4 text-sm text-muted-foreground">
        All members of your team receive these notifications.
      </p>

      <div v-if="isSettingsLoading" class="flex items-center justify-center py-4">
        <Icon name="lucide:loader-2" class="h-5 w-5 animate-spin text-muted-foreground" />
      </div>

      <div v-else class="space-y-3">
        <div
          v-for="option in notificationOptions"
          :key="option.key"
          class="flex items-center justify-between rounded-lg border p-4"
        >
          <div class="space-y-0.5">
            <Label :for="option.key" class="text-sm font-medium">
              {{ option.label }}
            </Label>
            <p class="text-xs text-muted-foreground">
              {{ option.description }}
            </p>
          </div>
          <Switch
            :id="option.key"
            v-model="settings[option.key as keyof NotificationSettings]"
            @update:model-value="saveSettings"
          />
        </div>
      </div>
    </div>
  </div>
</template>
