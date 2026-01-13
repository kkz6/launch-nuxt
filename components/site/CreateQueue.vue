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
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '~/components/ui/form'
import { Input } from '~/components/ui/input'
import { Switch } from '~/components/ui/switch'

interface Props {
  serverId: string
  siteId: string
  directory?: string
  redisInstalled?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  directory: '',
  redisInstalled: false,
})

const emit = defineEmits<{
  created: []
}>()

const isOpen = ref(false)
const isLoading = ref(false)
const confirmationDialog = ref<InstanceType<typeof import('~/components/shared/ConfirmationDialog.vue').default> | null>(null)

const queueSchema = toTypedSchema(
  z.object({
    queue_connection: z.string().max(10),
    queue: z.string().max(10),
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

const { handleSubmit, resetForm, setFieldError } = useForm({
  validationSchema: queueSchema,
  validateOnMount: false,
  initialValues: {
    queue_connection: props.redisInstalled ? 'redis' : 'database',
    queue: 'default',
    max_seconds_per_job: 60,
    rest_seconds_on_empty: 10,
    failed_job_delay_seconds: 3,
    run_on_maintenance: false,
    run_with_listen: false,
    stop_wait_seconds: 10,
    directory: props.directory,
    numprocs: 1,
  },
})

const handleClose = (open = false) => {
  isOpen.value = open
  if (!open) {
    resetForm()
  }
}

const onSubmit = handleSubmit(async (values) => {
  if (!confirmationDialog.value) return

  const result = await confirmationDialog.value.show({
    title: 'Create Queue Worker',
    description: 'Are you sure you want to create this queue worker?',
    confirmText: 'Create',
    cancelText: 'Cancel',
  })

  if (!result.ok) {
    toast.info('Cancelled')
    return
  }

  isLoading.value = true

  try {
    await $api(`/servers/${props.serverId}/sites/${props.siteId}/queues`, {
      method: 'POST',
      body: values,
    })
    toast.success('Queue worker created')
    handleClose(false)
    emit('created')
  } catch (error: unknown) {
    const err = error as { data?: { errors?: Record<string, string[]>; message?: string } }
    if (err.data?.errors) {
      for (const [field, messages] of Object.entries(err.data.errors)) {
        setFieldError(field as keyof typeof values, messages[0])
      }
    } else {
      toast.error(err.data?.message || 'Failed to create queue worker')
    }
  } finally {
    isLoading.value = false
  }
})
</script>

<template>
  <Dialog v-model:open="isOpen" @update:open="handleClose">
    <DialogTrigger as-child>
      <Button>
        <Icon name="lucide:plus" class="mr-2 h-4 w-4" />
        Add Queue Worker
      </Button>
    </DialogTrigger>
    <DialogContent class="sm:max-w-3xl">
      <SharedConfirmationDialog ref="confirmationDialog" />
      <DialogHeader>
        <DialogTitle>Create Queue Worker</DialogTitle>
        <DialogDescription>
          Configure a new Laravel queue worker for this site.
        </DialogDescription>
      </DialogHeader>

      <form class="space-y-6" @submit.prevent="onSubmit">
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

        <div class="w-full border-b">
          <h3 class="pb-2 text-lg font-medium">Policies</h3>
        </div>

        <div class="grid grid-cols-2 gap-4">
          <FormField v-slot="{ componentField }" name="max_seconds_per_job">
            <FormItem>
              <FormLabel>Max Seconds Per Job</FormLabel>
              <FormControl>
                <Input type="number" v-bind="componentField" />
              </FormControl>
              <FormDescription>Maximum time a job can run</FormDescription>
              <FormMessage />
            </FormItem>
          </FormField>

          <FormField v-slot="{ componentField }" name="rest_seconds_on_empty">
            <FormItem>
              <FormLabel>Rest Seconds on Empty</FormLabel>
              <FormControl>
                <Input type="number" placeholder="3" v-bind="componentField" />
              </FormControl>
              <FormMessage />
            </FormItem>
          </FormField>

          <FormField v-slot="{ componentField }" name="failed_job_delay_seconds">
            <FormItem>
              <FormLabel>Failed Job Delay Seconds</FormLabel>
              <FormControl>
                <Input type="number" placeholder="0" v-bind="componentField" />
              </FormControl>
              <FormMessage />
            </FormItem>
          </FormField>

          <FormField v-slot="{ componentField }" name="max_tries">
            <FormItem>
              <FormLabel>Max Tries</FormLabel>
              <FormControl>
                <Input type="number" v-bind="componentField" />
              </FormControl>
              <FormMessage />
            </FormItem>
          </FormField>
        </div>

        <div class="w-full border-b">
          <h3 class="pb-2 text-lg font-medium">Configuration</h3>
        </div>

        <div class="grid grid-cols-2 gap-4">
          <FormField v-slot="{ componentField }" name="environment">
            <FormItem>
              <FormLabel>Environment</FormLabel>
              <FormControl>
                <Input placeholder="production" v-bind="componentField" />
              </FormControl>
              <FormMessage />
            </FormItem>
          </FormField>

          <FormField v-slot="{ componentField }" name="max_memory">
            <FormItem>
              <FormLabel>Max Memory (MB)</FormLabel>
              <FormControl>
                <Input type="number" placeholder="128" v-bind="componentField" />
              </FormControl>
              <FormMessage />
            </FormItem>
          </FormField>
        </div>

        <FormField v-slot="{ componentField }" name="directory">
          <FormItem>
            <FormLabel>Working Directory</FormLabel>
            <FormControl>
              <Input placeholder="/home/user/site.com" v-bind="componentField" />
            </FormControl>
            <FormMessage />
          </FormItem>
        </FormField>

        <div class="grid grid-cols-2 gap-4">
          <FormField v-slot="{ componentField }" name="numprocs">
            <FormItem>
              <FormLabel>Number of Processes</FormLabel>
              <FormControl>
                <Input type="number" v-bind="componentField" />
              </FormControl>
              <FormMessage />
            </FormItem>
          </FormField>

          <FormField v-slot="{ componentField }" name="stop_wait_seconds">
            <FormItem>
              <FormLabel>Graceful Shutdown (seconds)</FormLabel>
              <FormControl>
                <Input type="number" placeholder="10" v-bind="componentField" />
              </FormControl>
              <FormMessage />
            </FormItem>
          </FormField>
        </div>

        <FormField v-slot="{ value, handleChange }" name="run_with_listen">
          <FormItem class="flex flex-row items-center justify-between rounded-lg border p-4">
            <div class="space-y-0.5">
              <FormLabel>Run with Listen</FormLabel>
              <FormDescription>Use queue:listen instead of queue:work</FormDescription>
            </div>
            <FormControl>
              <Switch :checked="value" @update:checked="handleChange" />
            </FormControl>
          </FormItem>
        </FormField>

        <FormField v-slot="{ value, handleChange }" name="run_on_maintenance">
          <FormItem class="flex flex-row items-center justify-between rounded-lg border p-4">
            <div class="space-y-0.5">
              <FormLabel>Run on Maintenance</FormLabel>
              <FormDescription>Keep running when application is in maintenance mode</FormDescription>
            </div>
            <FormControl>
              <Switch :checked="value" @update:checked="handleChange" />
            </FormControl>
          </FormItem>
        </FormField>

        <DialogFooter>
          <Button type="submit" :disabled="isLoading">
            <Icon v-if="isLoading" name="lucide:loader-2" class="mr-2 h-4 w-4 animate-spin" />
            Create
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
</template>
