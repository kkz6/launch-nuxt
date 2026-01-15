<script setup lang="ts">
import { toast } from 'vue-sonner'
import { Button } from '~/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog'
import { Input } from '~/components/ui/input'
import { Label } from '~/components/ui/label'

interface NotificationChannel {
  id: string
  provider: string
  label: string
  data?: {
    email?: string
    webhook_url?: string
    bot_token?: string
    chat_id?: string
  }
  connected: boolean
}

interface Props {
  channel: NotificationChannel | null
}

const props = defineProps<Props>()

const emit = defineEmits<{
  updated: []
}>()

const open = defineModel<boolean>('open', { required: true })
const isLoading = ref(false)
const label = ref('')
const credentials = ref({
  webhook_url: '',
  bot_token: '',
  chat_id: '',
  email: '',
})
const errors = ref<Record<string, string>>({})

const providers: Record<string, { label: string; icon: string }> = {
  slack: { label: 'Slack', icon: 'logos:slack-icon' },
  discord: { label: 'Discord', icon: 'logos:discord-icon' },
  telegram: { label: 'Telegram', icon: 'logos:telegram' },
  email: { label: 'Email', icon: 'lucide:mail' },
}

const currentProvider = computed(() => props.channel ? providers[props.channel.provider] : null)
const needsWebhook = computed(() => props.channel && ['slack', 'discord'].includes(props.channel.provider))
const needsTelegram = computed(() => props.channel?.provider === 'telegram')
const needsEmail = computed(() => props.channel?.provider === 'email')

const initForm = () => {
  if (!props.channel) return
  label.value = props.channel.label
  credentials.value = {
    webhook_url: props.channel.data?.webhook_url || '',
    bot_token: props.channel.data?.bot_token || '',
    chat_id: props.channel.data?.chat_id || '',
    email: props.channel.data?.email || '',
  }
  errors.value = {}
}

const validate = () => {
  errors.value = {}

  if (!label.value.trim()) {
    errors.value.label = 'Label is required'
  }

  if (needsWebhook.value && !credentials.value.webhook_url.trim()) {
    errors.value.webhook_url = 'Webhook URL is required'
  }

  if (needsTelegram.value) {
    if (!credentials.value.bot_token.trim()) {
      errors.value.bot_token = 'Bot token is required'
    }
    if (!credentials.value.chat_id.trim()) {
      errors.value.chat_id = 'Chat ID is required'
    }
  }

  if (needsEmail.value && !credentials.value.email.trim()) {
    errors.value.email = 'Email is required'
  }

  return Object.keys(errors.value).length === 0
}

const onSubmit = async () => {
  if (!props.channel || !validate()) return

  isLoading.value = true

  try {
    const body: Record<string, string> = {
      label: label.value,
    }

    if (needsWebhook.value) {
      body.webhook_url = credentials.value.webhook_url
    }

    if (needsTelegram.value) {
      body.bot_token = credentials.value.bot_token
      body.chat_id = credentials.value.chat_id
    }

    if (needsEmail.value) {
      body.email = credentials.value.email
    }

    await $api(`/notification-channels/${props.channel.id}`, {
      method: 'PUT',
      body,
    })

    toast.success('Notification channel updated')
    emit('updated')
    open.value = false
  } catch (error: unknown) {
    const err = error as { data?: { message?: string; errors?: Record<string, string[]> } }
    if (err.data?.errors) {
      for (const [field, messages] of Object.entries(err.data.errors)) {
        errors.value[field] = messages[0]
      }
    } else {
      toast.error(err.data?.message || 'Failed to update channel')
    }
  } finally {
    isLoading.value = false
  }
}

watch(open, (isOpen) => {
  if (isOpen) initForm()
})
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="sm:max-w-md">
      <DialogHeader>
        <DialogTitle class="flex items-center gap-2">
          <Icon v-if="currentProvider" :name="currentProvider.icon" class="h-5 w-5" />
          Edit {{ currentProvider?.label }} Channel
        </DialogTitle>
        <DialogDescription>
          Update your notification channel settings
        </DialogDescription>
      </DialogHeader>

      <form v-if="channel" class="space-y-4" @submit.prevent="onSubmit">
        <div class="space-y-2">
          <Label for="edit-label">Label</Label>
          <Input
            id="edit-label"
            v-model="label"
            placeholder="Channel name"
          />
          <p v-if="errors.label" class="text-sm text-destructive">{{ errors.label }}</p>
        </div>

        <!-- Webhook URL (for Slack, Discord) -->
        <div v-if="needsWebhook" class="space-y-2">
          <Label for="edit-webhook_url">Webhook URL</Label>
          <Input
            id="edit-webhook_url"
            v-model="credentials.webhook_url"
            type="url"
            :placeholder="channel.provider === 'slack' ? 'https://hooks.slack.com/services/...' : 'https://discord.com/api/webhooks/...'"
          />
          <p v-if="errors.webhook_url" class="text-sm text-destructive">{{ errors.webhook_url }}</p>
        </div>

        <!-- Telegram Credentials -->
        <template v-if="needsTelegram">
          <div class="space-y-2">
            <Label for="edit-bot_token">Bot Token</Label>
            <Input
              id="edit-bot_token"
              v-model="credentials.bot_token"
              type="password"
              placeholder="Enter new bot token to update"
            />
            <p v-if="errors.bot_token" class="text-sm text-destructive">{{ errors.bot_token }}</p>
          </div>

          <div class="space-y-2">
            <Label for="edit-chat_id">Chat ID</Label>
            <Input
              id="edit-chat_id"
              v-model="credentials.chat_id"
              placeholder="-1001234567890"
            />
            <p v-if="errors.chat_id" class="text-sm text-destructive">{{ errors.chat_id }}</p>
          </div>
        </template>

        <!-- Email -->
        <div v-if="needsEmail" class="space-y-2">
          <Label for="edit-email">Email Address</Label>
          <Input
            id="edit-email"
            v-model="credentials.email"
            type="email"
            placeholder="alerts@example.com"
          />
          <p v-if="errors.email" class="text-sm text-destructive">{{ errors.email }}</p>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" @click="open = false">
            Cancel
          </Button>
          <Button type="submit" :disabled="isLoading">
            <Icon v-if="isLoading" name="lucide:loader-2" class="mr-2 h-4 w-4 animate-spin" />
            Save Changes
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
</template>
