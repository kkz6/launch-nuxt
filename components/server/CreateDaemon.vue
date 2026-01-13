<script setup lang="ts">
import { toast } from 'vue-sonner'
import { useForm } from 'vee-validate'
import { toTypedSchema } from '@vee-validate/zod'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select'
import type { QueueDaemon } from '~/types'

interface Props {
  serverId: string
  daemon?: QueueDaemon
  open?: boolean
}

const props = defineProps<Props>()
const emit = defineEmits<{
  created: []
  updated: []
  'update:open': [value: boolean]
}>()

const internalOpen = ref(false)
const isOpen = computed({
  get: () => props.open !== undefined ? props.open : internalOpen.value,
  set: (value) => {
    if (props.open !== undefined) {
      emit('update:open', value)
    } else {
      internalOpen.value = value
    }
  },
})
const isLoading = ref(false)
const isControlled = computed(() => props.open !== undefined)
const confirmationDialog = ref<InstanceType<typeof import('~/components/shared/ConfirmationDialog.vue').default> | null>(null)

const signals: Record<string, string> = {
  SIGTERM: 'SIGTERM',
  SIGKILL: 'SIGKILL',
  SIGINT: 'SIGINT',
  SIGQUIT: 'SIGQUIT',
}

const schema = toTypedSchema(z.object({
  command: z.string().min(1, 'Command is required').max(255),
  directory: z.string().optional(),
  user: z.string().min(1, 'User is required'),
  processes: z.number().min(1, 'At least 1 process required'),
  stop_wait_seconds: z.number().min(0),
  stop_signal: z.string(),
}))

const { handleSubmit, resetForm, setFieldValue, values, errors } = useForm({
  validationSchema: schema,
  validateOnMount: false,
  initialValues: {
    command: props.daemon?.command || '',
    directory: props.daemon?.directory || '',
    user: props.daemon?.user || 'launch',
    processes: props.daemon?.processes || 1,
    stop_wait_seconds: props.daemon?.stop_wait_seconds || 5,
    stop_signal: props.daemon?.stop_signal || 'SIGTERM',
  },
})

type StringFields = 'command' | 'directory' | 'user' | 'stop_signal'
const setStringField = (field: StringFields, value: unknown) => {
  setFieldValue(field, value != null ? String(value) : '')
}

const onSubmit = handleSubmit(async (data) => {
  if (!confirmationDialog.value) return

  const result = await confirmationDialog.value.show({
    title: props.daemon ? 'Update Daemon' : 'Create Daemon',
    description: props.daemon
      ? 'Are you sure you want to update this daemon?'
      : 'Are you sure you want to create this daemon?',
    confirmText: props.daemon ? 'Update' : 'Create',
    cancelText: 'Cancel',
  })

  if (!result.ok) {
    toast.info('Cancelled')
    return
  }

  isLoading.value = true
  try {
    if (props.daemon) {
      await $api(`/servers/${props.serverId}/daemons/${props.daemon.id}`, {
        method: 'PATCH',
        body: data,
      })
      toast.success('Daemon updated successfully')
      emit('updated')
    } else {
      await $api(`/servers/${props.serverId}/daemons`, {
        method: 'POST',
        body: data,
      })
      toast.success('Daemon created successfully')
      emit('created')
    }
    isOpen.value = false
    resetForm()
  } catch (error: unknown) {
    const err = error as { data?: { message?: string } }
    toast.error(err.data?.message || 'An error occurred')
  } finally {
    isLoading.value = false
  }
})

watch(isOpen, (open) => {
  if (open && props.daemon) {
    // Reset form with daemon values when opening for edit
    resetForm({
      values: {
        command: props.daemon.command || '',
        directory: props.daemon.directory || '',
        user: props.daemon.user || 'launch',
        processes: props.daemon.processes || 1,
        stop_wait_seconds: props.daemon.stop_wait_seconds || 5,
        stop_signal: props.daemon.stop_signal || 'SIGTERM',
      },
    })
  } else if (!open) {
    resetForm()
  }
})
</script>

<template>
  <Dialog v-model:open="isOpen">
    <DialogTrigger v-if="!isControlled" as-child>
      <slot>
        <Button>
          <Icon name="lucide:plus-circle" class="mr-2 h-4 w-4" />
          {{ daemon ? 'Edit Daemon' : 'Create Daemon' }}
        </Button>
      </slot>
    </DialogTrigger>
    <DialogContent class="sm:max-w-3xl">
      <SharedConfirmationDialog ref="confirmationDialog" />
      <DialogHeader>
        <DialogTitle>{{ daemon ? 'Update Daemon' : 'Create Daemon' }}</DialogTitle>
        <DialogDescription>
          {{ daemon ? 'Update the daemon configuration' : 'Create a new background daemon process' }}
        </DialogDescription>
      </DialogHeader>
      <form class="grid w-full gap-4" @submit.prevent="onSubmit">
        <div class="space-y-2">
          <Label for="command">Command</Label>
          <Input
            id="command"
            :model-value="values.command"
            placeholder="php artisan queue:work"
            @update:model-value="setStringField('command', $event)"
          />
          <p v-if="errors.command" class="text-sm text-destructive">{{ errors.command }}</p>
        </div>

        <div class="space-y-2">
          <Label for="directory">Directory (optional)</Label>
          <Input
            id="directory"
            :model-value="values.directory"
            placeholder="/home/launch/example.com"
            @update:model-value="setStringField('directory', $event)"
          />
        </div>

        <div class="grid grid-cols-2 gap-4">
          <div class="space-y-2">
            <Label for="user">User</Label>
            <Input
              id="user"
              :model-value="values.user"
              @update:model-value="setStringField('user', $event)"
            />
            <p v-if="errors.user" class="text-sm text-destructive">{{ errors.user }}</p>
          </div>

          <div class="space-y-2">
            <Label for="processes">Processes</Label>
            <Input
              id="processes"
              type="number"
              :model-value="values.processes"
              min="1"
              @update:model-value="setFieldValue('processes', Number($event))"
            />
          </div>

          <div class="space-y-2">
            <Label for="stop_wait_seconds">Stop Wait Seconds</Label>
            <Input
              id="stop_wait_seconds"
              type="number"
              :model-value="values.stop_wait_seconds"
              min="0"
              @update:model-value="setFieldValue('stop_wait_seconds', Number($event))"
            />
          </div>

          <div class="space-y-2">
            <Label for="stop_signal">Stop Signal</Label>
            <Select :model-value="values.stop_signal" @update:model-value="setStringField('stop_signal', $event)">
              <SelectTrigger>
                <SelectValue placeholder="Select signal" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem v-for="(label, value) in signals" :key="value" :value="value">
                  {{ label }}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button type="submit" :disabled="isLoading">
            <Icon v-if="isLoading" name="lucide:loader-2" class="mr-2 h-4 w-4 animate-spin" />
            {{ daemon ? 'Update' : 'Create' }}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
</template>
