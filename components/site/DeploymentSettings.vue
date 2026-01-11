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
import { Textarea } from '~/components/ui/textarea'
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
  })
)

const siteProp = props.site as Site & {
  shared_directories?: string[]
  shared_files?: string[]
  writeable_directories?: string[]
  deployment_releases_retention?: number
  hook_before_updating_repository?: string
  hook_after_updating_repository?: string
  hook_before_making_current?: string
  hook_after_making_current?: string
}

const { handleSubmit, setFieldError, resetForm } = useForm({
  validationSchema: deploymentSchema,
  initialValues: {
    shared_directories: siteProp.shared_directories?.join('\n') || '',
    shared_files: siteProp.shared_files?.join('\n') || '',
    writeable_directories: siteProp.writeable_directories?.join('\n') || '',
    deployment_releases_retention: siteProp.deployment_releases_retention || 5,
    hook_before_updating_repository: siteProp.hook_before_updating_repository || '',
    hook_before_making_current: siteProp.hook_before_making_current || '',
    hook_after_making_current: siteProp.hook_after_making_current || '',
    hook_after_updating_repository: siteProp.hook_after_updating_repository || '',
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

      <form class="w-full space-y-4" @submit="onSubmit">
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

          <FormField v-slot="{ componentField }" name="shared_directories">
            <FormItem>
              <FormLabel>Shared Directories</FormLabel>
              <FormControl>
                <Textarea
                  class="h-36 font-mono text-sm"
                  placeholder="storage&#10;bootstrap/cache"
                  v-bind="componentField"
                />
              </FormControl>
              <FormDescription>
                Directories that should be shared between releases (one per line)
              </FormDescription>
              <FormMessage />
            </FormItem>
          </FormField>

          <FormField v-slot="{ componentField }" name="shared_files">
            <FormItem>
              <FormLabel>Shared Files</FormLabel>
              <FormControl>
                <Textarea
                  class="h-36 font-mono text-sm"
                  placeholder=".env"
                  v-bind="componentField"
                />
              </FormControl>
              <FormDescription>
                Files that should be shared between releases (one per line)
              </FormDescription>
              <FormMessage />
            </FormItem>
          </FormField>

          <FormField v-slot="{ componentField }" name="writeable_directories">
            <FormItem>
              <FormLabel>Writeable Directories</FormLabel>
              <FormControl>
                <Textarea
                  class="h-36 font-mono text-sm"
                  placeholder="storage&#10;bootstrap/cache"
                  v-bind="componentField"
                />
              </FormControl>
              <FormDescription>
                Directories that should be writable (one per line)
              </FormDescription>
              <FormMessage />
            </FormItem>
          </FormField>
        </template>

        <FormField v-slot="{ componentField }" name="hook_before_updating_repository">
          <FormItem>
            <FormLabel>Before Updating Repository</FormLabel>
            <FormControl>
              <Textarea
                class="h-36 font-mono text-sm"
                placeholder="# Commands to run before git pull"
                v-bind="componentField"
              />
            </FormControl>
            <FormDescription>
              Commands to run before updating the repository
            </FormDescription>
            <FormMessage />
          </FormItem>
        </FormField>

        <FormField v-slot="{ componentField }" name="hook_after_updating_repository">
          <FormItem>
            <FormLabel>After Updating Repository</FormLabel>
            <FormControl>
              <Textarea
                class="h-36 font-mono text-sm"
                placeholder="composer install --no-dev&#10;npm install &amp;&amp; npm run build"
                v-bind="componentField"
              />
            </FormControl>
            <FormDescription>
              Commands to run after updating the repository
            </FormDescription>
            <FormMessage />
          </FormItem>
        </FormField>

        <FormField v-slot="{ componentField }" name="hook_before_making_current">
          <FormItem>
            <FormLabel>Before Making Current</FormLabel>
            <FormControl>
              <Textarea
                class="h-36 font-mono text-sm"
                placeholder="php artisan migrate --force"
                v-bind="componentField"
              />
            </FormControl>
            <FormDescription>
              Commands to run before activating the new release
            </FormDescription>
            <FormMessage />
          </FormItem>
        </FormField>

        <FormField v-slot="{ componentField }" name="hook_after_making_current">
          <FormItem>
            <FormLabel>After Making Current</FormLabel>
            <FormControl>
              <Textarea
                class="h-36 font-mono text-sm"
                placeholder="php artisan cache:clear&#10;php artisan queue:restart"
                v-bind="componentField"
              />
            </FormControl>
            <FormDescription>
              Commands to run after activating the new release
            </FormDescription>
            <FormMessage />
          </FormItem>
        </FormField>

        <Button type="submit" :disabled="isLoading">
          <Icon v-if="isLoading" name="lucide:loader-2" class="mr-2 h-4 w-4 animate-spin" />
          Update Deployment Settings
        </Button>
      </form>
    </DialogContent>
  </Dialog>
</template>
