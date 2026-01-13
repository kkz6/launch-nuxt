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
import { RadioGroup, RadioGroupItem } from '~/components/ui/radio-group'
import type { Cron } from '~/types'

interface Props {
  serverId: string
  cron?: Cron
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

const schema = toTypedSchema(z.object({
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
}))

const { handleSubmit, resetForm, setFieldValue, values, errors } = useForm({
  validationSchema: schema,
  validateOnMount: false,
  initialValues: {
    command: props.cron?.command || '',
    user: props.cron?.user || 'launch',
    frequency: props.cron?.frequency || '* * * * *',
    custom_expression: props.cron?.expression || '',
  },
})

type StringFields = 'command' | 'user' | 'frequency' | 'custom_expression'
const setStringField = (field: StringFields, value: unknown) => {
  setFieldValue(field, value != null ? String(value) : '')
}

const onSubmit = handleSubmit(async (data) => {
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
    if (props.cron) {
      await $api(`/servers/${props.serverId}/crons/${props.cron.id}`, {
        method: 'PATCH',
        body: data,
      })
      toast.success('Scheduler updated successfully')
      emit('updated')
    } else {
      await $api(`/servers/${props.serverId}/crons`, {
        method: 'POST',
        body: data,
      })
      toast.success('Scheduler created successfully')
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
  if (open && props.cron) {
    // Reset form with cron values when opening for edit
    resetForm({
      values: {
        command: props.cron.command || '',
        user: props.cron.user || 'launch',
        frequency: props.cron.frequency === 'custom' ? 'custom' : (props.cron.expression || '* * * * *'),
        custom_expression: props.cron.frequency === 'custom' ? props.cron.expression : '',
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
          {{ cron ? 'Edit Scheduler' : 'Create Scheduler' }}
        </Button>
      </slot>
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
            :model-value="values.command"
            placeholder="php artisan schedule:run"
            @update:model-value="setStringField('command', $event)"
          />
          <p v-if="errors.command" class="text-sm text-destructive">{{ errors.command }}</p>
        </div>

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
          <Label>Frequency</Label>
          <RadioGroup
            :model-value="values.frequency"
            class="grid grid-cols-2 gap-2"
            @update:model-value="setStringField('frequency', $event)"
          >
            <div v-for="(label, value) in frequencies" :key="value" class="flex items-center space-x-2">
              <RadioGroupItem :id="`freq-${value}`" :value="value" />
              <Label :for="`freq-${value}`" class="font-normal">{{ label }}</Label>
            </div>
          </RadioGroup>
        </div>

        <div v-if="values.frequency === 'custom'" class="space-y-2">
          <Label for="custom_expression">Custom Expression</Label>
          <Input
            id="custom_expression"
            :model-value="values.custom_expression"
            placeholder="*/30 * * * *"
            @update:model-value="setStringField('custom_expression', $event)"
          />
          <p v-if="errors.custom_expression" class="text-sm text-destructive">{{ errors.custom_expression }}</p>
        </div>

        <DialogFooter>
          <Button type="submit" :disabled="isLoading">
            <Icon v-if="isLoading" name="lucide:loader-2" class="mr-2 h-4 w-4 animate-spin" />
            {{ cron ? 'Update' : 'Create' }}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
</template>
