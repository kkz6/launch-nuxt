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
import { Label } from '~/components/ui/label'
import { Switch } from '~/components/ui/switch'
import type { Site } from '~/types'

interface Props {
  serverId: string
  site: Site
}

const props = defineProps<Props>()

const emit = defineEmits<{
  updated: []
}>()

const isOpen = ref(false)
const isLoading = ref(false)
const confirmationDialog = ref<InstanceType<typeof import('~/components/shared/ConfirmationDialog.vue').default> | null>(null)

interface SiteDeploymentFields {
  shared_directories?: string[]
  shared_files?: string[]
  writeable_directories?: string[]
  hook_before_updating_repository?: string
  hook_after_updating_repository?: string
  hook_before_making_current?: string
  hook_after_making_current?: string
  deployment_releases_retention?: number
  queue_deployments?: boolean
}

const deploymentSchema = toTypedSchema(
  z.object({
    deployment_releases_retention: z.coerce.number().min(1).max(50).optional(),
    shared_directories: z.string().optional(),
    writeable_directories: z.string().optional(),
    shared_files: z.string().optional(),
    hook_before_updating_repository: z.string().optional(),
    hook_after_updating_repository: z.string().optional(),
    hook_before_making_current: z.string().optional(),
    hook_after_making_current: z.string().optional(),
    queue_deployments: z.boolean().optional(),
  })
)

const getInitialValues = () => {
  const site = props.site as Site & SiteDeploymentFields
  return {
    shared_directories: site.shared_directories?.join('\n') || '',
    shared_files: site.shared_files?.join('\n') || '',
    writeable_directories: site.writeable_directories?.join('\n') || '',
    deployment_releases_retention: site.deployment_releases_retention || 5,
    hook_before_updating_repository: site.hook_before_updating_repository || '',
    hook_before_making_current: site.hook_before_making_current || '',
    hook_after_making_current: site.hook_after_making_current || '',
    hook_after_updating_repository: site.hook_after_updating_repository || '',
    queue_deployments: site.queue_deployments || false,
  }
}

const { handleSubmit, setFieldError, resetForm, setValues, values } = useForm({
  validationSchema: deploymentSchema,
  validateOnMount: false,
  initialValues: getInitialValues(),
})

const queueDeployments = computed({
  get: () => values.queue_deployments ?? false,
  set: (val: boolean) => setValues({ queue_deployments: val }),
})

const handleClose = (open = false) => {
  isOpen.value = open
  if (!open) {
    resetForm()
  }
}

// Reset form with current site values when dialog opens
watch(isOpen, (open) => {
  if (open) {
    setValues(getInitialValues())
  }
})

const onSubmit = handleSubmit(async (values) => {
  if (!confirmationDialog.value) return

  const result = await confirmationDialog.value.show({
    title: 'Update Deployment Settings',
    description: 'Are you sure you want to update deployment settings?',
    confirmText: 'Update',
    cancelText: 'Cancel',
  })

  if (!result.ok) {
    toast.info('Cancelled')
    return
  }

  isLoading.value = true

  try {
    await $api(`/servers/${props.serverId}/sites/${props.site.id}/deployment-settings`, {
      method: 'PATCH',
      body: values,
    })
    toast.success('Deployment settings updated')
    handleClose(false)
    emit('updated')
  } catch (error: unknown) {
    const err = error as { data?: { errors?: Record<string, string[]>; message?: string } }
    if (err.data?.errors) {
      for (const [field, messages] of Object.entries(err.data.errors)) {
        setFieldError(field as keyof typeof values, messages[0])
      }
    } else {
      toast.error(err.data?.message || 'Failed to update deployment settings')
    }
  } finally {
    isLoading.value = false
  }
})
</script>

<template>
  <Dialog v-model:open="isOpen" @update:open="handleClose">
    <DialogTrigger as-child>
      <Button>Deployment Settings</Button>
    </DialogTrigger>
    <DialogContent class="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
      <SharedConfirmationDialog ref="confirmationDialog" />
      <DialogHeader>
        <DialogTitle>Deployment Settings</DialogTitle>
        <DialogDescription>
          Configure deployment hooks and zero-downtime deployment settings
        </DialogDescription>
      </DialogHeader>

      <form class="w-full space-y-4" @submit.prevent="onSubmit">
        <div class="flex items-center justify-between rounded-lg border p-4">
          <div class="space-y-0.5">
            <Label>Queue Deployments</Label>
            <p class="text-sm text-muted-foreground">
              Queue deployments instead of running them immediately when one is already in progress
            </p>
          </div>
          <Switch v-model="queueDeployments" />
        </div>

        <template v-if="(site as any).zero_downtime_deployment">
          <FormField v-slot="{ componentField }" name="deployment_releases_retention">
            <FormItem>
              <FormLabel>Releases Retention</FormLabel>
              <FormControl>
                <Input type="number" :min="1" :max="50" v-bind="componentField" />
              </FormControl>
              <FormDescription>
                Number of deployment releases to keep on the server
              </FormDescription>
              <FormMessage />
            </FormItem>
          </FormField>

          <div class="space-y-2">
            <Label>Shared Directories</Label>
            <SharedCodeEditor
              :model-value="values.shared_directories || ''"
              class="h-36"
              placeholder="storage"
              :line-numbers="false"
              :fold-gutter="false"
              @update:model-value="(val: string) => setValues({ shared_directories: val })"
            />
            <p class="text-sm text-muted-foreground">
              Directories that should be shared between releases (one per line)
            </p>
          </div>

          <div class="space-y-2">
            <Label>Shared Files</Label>
            <SharedCodeEditor
              :model-value="values.shared_files || ''"
              class="h-36"
              placeholder=".env"
              :line-numbers="false"
              :fold-gutter="false"
              @update:model-value="(val: string) => setValues({ shared_files: val })"
            />
            <p class="text-sm text-muted-foreground">
              Files that should be shared between releases (one per line)
            </p>
          </div>

          <div class="space-y-2">
            <Label>Writeable Directories</Label>
            <SharedCodeEditor
              :model-value="values.writeable_directories || ''"
              class="h-36"
              placeholder="storage"
              :line-numbers="false"
              :fold-gutter="false"
              @update:model-value="(val: string) => setValues({ writeable_directories: val })"
            />
            <p class="text-sm text-muted-foreground">
              Directories that should be writable (one per line)
            </p>
          </div>
        </template>

        <div class="space-y-2">
          <Label>Before Updating Repository</Label>
          <SharedCodeEditor
            :model-value="values.hook_before_updating_repository || ''"
            class="h-36"
            placeholder="# Commands to run before git pull"
            @update:model-value="(val: string) => setValues({ hook_before_updating_repository: val })"
          />
          <p class="text-sm text-muted-foreground">
            Commands to run before updating the repository
          </p>
        </div>

        <div class="space-y-2">
          <Label>After Updating Repository</Label>
          <SharedCodeEditor
            :model-value="values.hook_after_updating_repository || ''"
            class="h-36"
            placeholder="composer install --no-dev"
            @update:model-value="(val: string) => setValues({ hook_after_updating_repository: val })"
          />
          <p class="text-sm text-muted-foreground">
            Commands to run after updating the repository
          </p>
        </div>

        <div class="space-y-2">
          <Label>Before Making Current</Label>
          <SharedCodeEditor
            :model-value="values.hook_before_making_current || ''"
            class="h-36"
            placeholder="php artisan migrate --force"
            @update:model-value="(val: string) => setValues({ hook_before_making_current: val })"
          />
          <p class="text-sm text-muted-foreground">
            Commands to run before activating the new release
          </p>
        </div>

        <div class="space-y-2">
          <Label>After Making Current</Label>
          <SharedCodeEditor
            :model-value="values.hook_after_making_current || ''"
            class="h-36"
            placeholder="php artisan cache:clear"
            @update:model-value="(val: string) => setValues({ hook_after_making_current: val })"
          />
          <p class="text-sm text-muted-foreground">
            Commands to run after activating the new release
          </p>
        </div>

        <Button type="submit" :disabled="isLoading">
          <Icon v-if="isLoading" name="lucide:loader-2" class="mr-2 h-4 w-4 animate-spin" />
          Update Deployment Settings
        </Button>
      </form>
    </DialogContent>
  </Dialog>
</template>
