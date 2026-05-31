<script setup lang="ts">
import { toast } from 'vue-sonner'
import * as z from 'zod'
import { Button } from '~/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '~/components/ui/dialog'
import { Input } from '~/components/ui/input'
import { Label } from '~/components/ui/label'
import { RadioGroup, RadioGroupItem } from '~/components/ui/radio-group'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select'
import type { Cron, Server } from '~/types'

interface Props {
  server: Server
  cron?: Cron
}

const props = defineProps<Props>()
const serverId = computed(() => props.server.id)

// Server users with local user prioritized first
const serverUsers = computed(() => {
  const users = props.server.users
  if (!users) {
    return []
  }

  const result: { value: string; label: string }[] = []

  // Add local user first (priority)
  if (users.local) {
    result.push({ value: users.local, label: users.local })
  }

  // Add root user second
  if (users.root) {
    result.push({ value: users.root, label: users.root })
  }

  return result
})

// Get default user (local user has priority)
const defaultUser = computed(() => serverUsers.value[0]?.value || '')
const emit = defineEmits<{
  created: []
  updated: []
  'update:open': [value: boolean]
}>()

const open = defineModel<boolean>('open', { default: false })
const isLoading = ref(false)
const errors = ref<Record<string, string>>({})
const confirmationDialog = ref<InstanceType<typeof import('~/components/shared/ConfirmationDialog.vue').default> | null>(null)

// Form values
const command = ref(props.cron?.command || '')
const user = ref(props.cron?.user || defaultUser.value)
const frequency = ref(props.cron?.frequency || '* * * * *')
const customExpression = ref(props.cron?.expression || '')

const frequencies: Record<string, string> = {
  '* * * * *': 'Every Minute',
  '*/5 * * * *': 'Every 5 Minutes',
  '*/15 * * * *': 'Every 15 Minutes',
  '0 * * * *': 'Hourly',
  '0 0 * * *': 'Daily',
  '0 0 * * 0': 'Weekly',
  '0 0 1 * *': 'Monthly',
  'custom': 'Custom Expression',
}

const schema = z.object({
  command: z.string().min(1, 'Command is required').max(255),
  user: z.string().min(1, 'User is required'),
  frequency: z.string().min(1, 'Frequency is required'),
  custom_expression: z.string().optional(),
}).refine((data) => {
  if (data.frequency === 'custom') {
    return !!data.custom_expression
  }
  return true
}, {
  message: 'Custom expression is required',
  path: ['custom_expression'],
})

const canSubmit = computed(() => {
  if (isLoading.value) return false
  if (command.value.trim().length === 0) return false
  if (user.value.length === 0) return false
  if (frequency.value === 'custom' && customExpression.value.trim().length === 0) return false
  return true
})

const resetForm = () => {
  command.value = props.cron?.command || ''
  user.value = props.cron?.user || defaultUser.value
  frequency.value = props.cron?.frequency === 'custom' ? 'custom' : (props.cron?.expression || '* * * * *')
  customExpression.value = props.cron?.frequency === 'custom' ? (props.cron?.expression || '') : ''
  errors.value = {}
}

const validate = () => {
  const result = schema.safeParse({
    command: command.value.trim(),
    user: user.value,
    frequency: frequency.value,
    custom_expression: customExpression.value.trim() || undefined,
  })
  if (!result.success) {
    const fieldErrors = result.error.flatten().fieldErrors
    errors.value = {
      command: fieldErrors.command?.[0] || '',
      user: fieldErrors.user?.[0] || '',
      custom_expression: fieldErrors.custom_expression?.[0] || '',
    }
    return null
  }
  errors.value = {}
  return result.data
}

const onSubmit = async () => {
  const data = validate()
  if (!data) return

  if (!confirmationDialog.value) return

  const result = await confirmationDialog.value.show({
    title: props.cron ? 'Update Scheduler' : 'Create Scheduler',
    description: props.cron
      ? 'Are you sure you want to update this scheduled task?'
      : 'Are you sure you want to create this scheduled task?',
    confirmText: props.cron ? 'Update' : 'Create',
    cancelText: 'Cancel',
  })

  if (!result.ok) {
    toast.info('Cancelled')
    return
  }

  isLoading.value = true
  try {
    // The radio group's `frequency` value is the actual cron string
    // for presets (e.g. "0 * * * *" for Hourly) or the literal
    // "custom" sentinel — and the backend's CreateCronRequest /
    // UpdateCronRequest expect the cron string under `expression`,
    // not `frequency`. Sending `frequency` directly produced a 422
    // {"errors":{"expression":["This field is required"]}} on every
    // Create attempt, which the UI toasted as a generic failure.
    const expression = data.frequency === 'custom'
      ? (data.custom_expression || '').trim()
      : data.frequency
    const payload: Record<string, unknown> = {
      command: data.command,
      user: data.user,
      expression,
    }
    if (props.cron) {
      await $api(`/servers/${serverId.value}/crons/${props.cron.id}`, {
        // Backend route is `Put`, not `Patch` (see
        // internal/modules/server/routes.go) — sending PATCH used
        // to come back 405 Method Not Allowed and the toast just
        // said "Failed".
        method: 'PUT',
        body: payload,
      })
      toast.success('Scheduler updated successfully')
      emit('updated')
    } else {
      await $api(`/servers/${serverId.value}/crons`, {
        method: 'POST',
        body: payload,
      })
      toast.success('Scheduler created successfully')
      emit('created')
    }
    open.value = false
    resetForm()
  } catch (error: unknown) {
    const err = error as { data?: { message?: string } }
    toast.error(err.data?.message || 'An error occurred')
  } finally {
    isLoading.value = false
  }
}

watch(open, (isOpen) => {
  if (isOpen) {
    resetForm()
  }
})
</script>

<template>
  <Dialog v-model:open="open">
    <DialogTrigger as-child>
      <Button>
        <Icon name="lucide:plus-circle" class="mr-2 h-4 w-4" />
        {{ cron ? 'Edit Scheduler' : 'Create Scheduler' }}
      </Button>
    </DialogTrigger>
    <DialogContent class="sm:max-w-3xl">
      <SharedConfirmationDialog ref="confirmationDialog" />
      <DialogHeader>
        <DialogTitle>{{ cron ? 'Update Scheduler' : 'Create Scheduler' }}</DialogTitle>
        <DialogDescription>
          {{ cron ? 'Update the scheduled task configuration' : 'Create a new cron job' }}
        </DialogDescription>
      </DialogHeader>
      <form class="grid w-full gap-4" @submit.prevent="onSubmit">
        <div class="space-y-2">
          <Label for="command">Command</Label>
          <Input
            id="command"
            v-model="command"
            placeholder="php artisan schedule:run"
          />
          <p v-if="errors.command" class="text-sm text-destructive">{{ errors.command }}</p>
        </div>

        <div class="space-y-2">
          <Label for="user">User</Label>
          <Select v-model="user">
            <SelectTrigger>
              <SelectValue placeholder="Select user" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem v-for="serverUser in serverUsers" :key="serverUser.value" :value="serverUser.value">
                {{ serverUser.label }}
              </SelectItem>
            </SelectContent>
          </Select>
          <p v-if="errors.user" class="text-sm text-destructive">{{ errors.user }}</p>
        </div>

        <div class="space-y-2">
          <Label>Frequency</Label>
          <RadioGroup
            v-model="frequency"
            class="grid grid-cols-2 gap-2"
          >
            <div v-for="(label, value) in frequencies" :key="value" class="flex items-center space-x-2">
              <RadioGroupItem :id="`freq-${value}`" :value="value" />
              <Label :for="`freq-${value}`" class="font-normal">{{ label }}</Label>
            </div>
          </RadioGroup>
        </div>

        <div v-if="frequency === 'custom'" class="space-y-2">
          <Label for="custom_expression">Custom Expression</Label>
          <Input
            id="custom_expression"
            v-model="customExpression"
            placeholder="*/30 * * * *"
          />
          <p v-if="errors.custom_expression" class="text-sm text-destructive">{{ errors.custom_expression }}</p>
        </div>

        <DialogFooter>
          <Button type="submit" :disabled="!canSubmit">
            <Icon v-if="isLoading" name="lucide:loader-2" class="mr-2 h-4 w-4 animate-spin" />
            {{ cron ? 'Update' : 'Create' }}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
</template>
