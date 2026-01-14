<script setup lang="ts">
import { Settings } from 'lucide-vue-next'
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
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '~/components/ui/form'
import { Input } from '~/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select'

interface QueueValues {
  queue_connection: string
  queue: string
  user?: string
  max_seconds_per_job: number
  rest_seconds_on_empty: number
  failed_job_delay_seconds: number
  directory?: string
  run_on_maintenance: boolean
  run_with_listen: boolean
  environment?: string
  max_tries?: number
  max_memory?: number
  numprocs?: number
  stop_wait_seconds?: number
}

interface Queue extends QueueValues {
  id: string
}

interface Props {
  serverId: string
  siteId: string
  queue?: Queue
}

const props = defineProps<Props>()

const emit = defineEmits<{
  created: []
  updated: []
}>()

const open = defineModel<boolean>('open', { default: false })
const isLoading = ref(false)
const isAdvancedOpen = ref(false)
const availableUsers = ref<Record<string, string>>({})
const directory = ref('')
const redisInstalled = ref(false)
const confirmationDialog = ref<InstanceType<typeof import('~/components/shared/ConfirmationDialog.vue').default> | null>(null)

const queueSchema = toTypedSchema(
  z.object({
    queue_connection: z.string().min(1).max(50),
    queue: z.string().min(1).max(50),
    user: z.string().optional(),
    max_seconds_per_job: z.coerce.number().min(1),
    rest_seconds_on_empty: z.coerce.number().min(0),
    failed_job_delay_seconds: z.coerce.number().min(0),
    directory: z.string().optional(),
    run_on_maintenance: z.boolean(),
    run_with_listen: z.boolean(),
    environment: z.string().max(255).optional(),
    max_tries: z.coerce.number().optional(),
    max_memory: z.coerce.number().min(128).optional(),
    numprocs: z.coerce.number().optional(),
    stop_wait_seconds: z.coerce.number().optional(),
  })
)

const getInitialValues = () => {
  if (props.queue) {
    return {
      queue_connection: props.queue.queue_connection,
      queue: props.queue.queue,
      user: props.queue.user || Object.keys(availableUsers.value)[0] || '',
      max_seconds_per_job: props.queue.max_seconds_per_job,
      rest_seconds_on_empty: props.queue.rest_seconds_on_empty,
      failed_job_delay_seconds: props.queue.failed_job_delay_seconds,
      directory: props.queue.directory || directory.value,
      run_on_maintenance: props.queue.run_on_maintenance,
      run_with_listen: props.queue.run_with_listen,
      environment: props.queue.environment,
      max_tries: props.queue.max_tries,
      max_memory: props.queue.max_memory,
      numprocs: props.queue.numprocs || 1,
      stop_wait_seconds: props.queue.stop_wait_seconds || 10,
    }
  }
  return {
    queue_connection: redisInstalled.value ? 'redis' : 'database',
    queue: 'default',
    user: Object.keys(availableUsers.value)[0] || '',
    max_seconds_per_job: 60,
    rest_seconds_on_empty: 10,
    failed_job_delay_seconds: 3,
    directory: directory.value,
    run_on_maintenance: false,
    run_with_listen: false,
    numprocs: 1,
    stop_wait_seconds: 10,
  }
}

const { handleSubmit, resetForm, setFieldError, values, setValues } = useForm({
  validationSchema: queueSchema,
  validateOnMount: false,
  initialValues: getInitialValues(),
})

const fetchOptions = async () => {
  try {
    const response = await $api<{
      data: {
        directory: string
        redis_installed: boolean
        available_users: Record<string, string>
      }
    }>(`/servers/${props.serverId}/sites/${props.siteId}/queues/create`)
    availableUsers.value = response.data.available_users || {}
    directory.value = response.data.directory || ''
    redisInstalled.value = response.data.redis_installed || false

    // Update form with fetched defaults
    if (!props.queue) {
      setValues({
        ...values,
        queue_connection: redisInstalled.value ? 'redis' : 'database',
        user: Object.keys(availableUsers.value)[0] || '',
        directory: directory.value,
      })
    }
  } catch {
    // Silent fail
  }
}

const handleClose = (isOpen = false) => {
  open.value = isOpen
  if (!isOpen) {
    resetForm({ values: getInitialValues() })
  }
}

watch(open, (isOpen) => {
  if (isOpen) {
    fetchOptions()
    // Reset form with queue values when editing
    if (props.queue) {
      setValues(getInitialValues())
    }
  }
})

const onSubmit = handleSubmit(async (formValues) => {
  if (!confirmationDialog.value) return

  const isEdit = !!props.queue
  const result = await confirmationDialog.value.show({
    title: isEdit ? 'Update Queue Worker' : 'Create Queue Worker',
    description: isEdit
      ? 'Are you sure you want to update this queue worker?'
      : 'Are you sure you want to create this queue worker?',
    confirmText: isEdit ? 'Update' : 'Create',
    cancelText: 'Cancel',
  })

  if (!result.ok) {
    toast.info('Cancelled')
    return
  }

  isLoading.value = true

  try {
    const url = isEdit
      ? `/servers/${props.serverId}/sites/${props.siteId}/queues/${props.queue!.id}`
      : `/servers/${props.serverId}/sites/${props.siteId}/queues`

    await $api(url, {
      method: isEdit ? 'PATCH' : 'POST',
      body: formValues,
    })
    toast.success(isEdit ? 'Queue worker updated' : 'Queue worker created')
    handleClose(false)
    if (isEdit) {
      emit('updated')
    } else {
      emit('created')
    }
  } catch (error: unknown) {
    const err = error as { data?: { errors?: Record<string, string[]>; message?: string } }
    if (err.data?.errors) {
      for (const [field, messages] of Object.entries(err.data.errors)) {
        setFieldError(field as keyof typeof formValues, messages[0])
      }
    } else {
      toast.error(err.data?.message || `Failed to ${isEdit ? 'update' : 'create'} queue worker`)
    }
  } finally {
    isLoading.value = false
  }
})

const advancedValues = computed({
  get: () => values as QueueValues,
  set: (newValues: QueueValues) => setValues(newValues),
})
</script>

<template>
  <Dialog v-model:open="open" @update:open="handleClose">
    <DialogTrigger as-child>
      <Button>
        <Icon name="lucide:plus" class="mr-2 h-4 w-4" />
        Add Queue Worker
      </Button>
    </DialogTrigger>
    <DialogContent class="sm:max-w-xl">
      <SharedConfirmationDialog ref="confirmationDialog" />
      <DialogHeader>
        <DialogTitle>{{ queue ? 'Update Queue Worker' : 'Create Queue Worker' }}</DialogTitle>
        <DialogDescription>
          {{ queue ? 'Update the queue worker configuration.' : 'Configure a new Laravel queue worker for this site.' }}
        </DialogDescription>
      </DialogHeader>

      <form class="space-y-4" @submit.prevent="onSubmit">
        <div class="grid grid-cols-2 gap-4">
          <FormField v-slot="{ componentField }" name="queue_connection">
            <FormItem>
              <FormLabel>Connection</FormLabel>
              <FormControl>
                <Input placeholder="redis" v-bind="componentField" />
              </FormControl>
              <FormMessage />
            </FormItem>
          </FormField>

          <FormField v-slot="{ componentField }" name="queue">
            <FormItem>
              <FormLabel>Queue</FormLabel>
              <FormControl>
                <Input placeholder="default" v-bind="componentField" />
              </FormControl>
              <FormDescription>Name of the queue to process</FormDescription>
              <FormMessage />
            </FormItem>
          </FormField>
        </div>

        <FormField v-slot="{ componentField }" name="user">
          <FormItem>
            <FormLabel>User</FormLabel>
            <Select v-bind="componentField">
              <FormControl>
                <SelectTrigger>
                  <SelectValue placeholder="Select user" />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                <SelectItem
                  v-for="(label, value) in availableUsers"
                  :key="value"
                  :value="value"
                >
                  {{ label }}
                </SelectItem>
              </SelectContent>
            </Select>
            <FormDescription>User to run the queue worker as</FormDescription>
            <FormMessage />
          </FormItem>
        </FormField>

        <DialogFooter class="sm:justify-between">
          <Button type="button" variant="outline" @click="isAdvancedOpen = true">
            <Settings class="mr-2 h-4 w-4" />
            Advanced Options
          </Button>
          <Button type="submit" :disabled="isLoading">
            <Icon v-if="isLoading" name="lucide:loader-2" class="mr-2 h-4 w-4 animate-spin" />
            {{ queue ? 'Update' : 'Create' }}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>

  <SiteQueueAdvancedOptions
    v-model:open="isAdvancedOpen"
    :values="advancedValues"
    @update:values="setValues($event)"
  />
</template>
