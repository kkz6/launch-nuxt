<script setup lang="ts">
import { toast } from 'vue-sonner'
import { useForm } from 'vee-validate'
import { toTypedSchema } from '@vee-validate/zod'
import * as z from 'zod'
import { Button } from '~/components/ui/button'
import { Separator } from '~/components/ui/separator'
import { Label } from '~/components/ui/label'
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
import type { Site } from '~/types'

interface Props {
  serverId: string
  site: Site
}

const props = defineProps<Props>()

const emit = defineEmits<{
  updated: []
  deleted: []
}>()

const isLoading = ref(false)
const phpVersions = ref<Record<string, string>>({})
const tlsOptions = ref<Record<string, string>>({})
const sourceControlData = ref<{ id: string; provider: string; login: string; name: string; type: string } | null>(null)
const repositoryData = ref<{ id: number; name: string; full_name: string; default_branch: string; html_url: string } | null>(null)
const deletionResources = ref<{ queues: number; crons: number }>({ queues: 0, crons: 0 })
const confirmationDialog = ref<InstanceType<typeof import('~/components/shared/ConfirmationDialog.vue').default> | null>(null)

const siteSchema = toTypedSchema(
  z.object({
    php_version: z.string(),
    web_folder: z.string(),
    repository_branch: z.string().optional(),
  })
)

const { handleSubmit, setFieldError } = useForm({
  validationSchema: siteSchema,
  validateOnMount: false,
  initialValues: {
    php_version: props.site.php_version,
    web_folder: props.site.web_folder,
    repository_branch: props.site.repository_branch || '',
  },
})

const fetchSettings = async () => {
  try {
    const response = await $api<{
      data: {
        site: Site
        php_versions: Array<{ version: string; is_default: boolean }>
        tls_options: Array<{ value: string; label: string }>
        source_control: { id: string; provider: string; login: string; name: string; type: string } | null
        repository: { id: number; name: string; full_name: string; default_branch: string; html_url: string } | null
      }
    }>(`/servers/${props.serverId}/sites/${props.site.id}/settings`)

    // Transform php_versions array to Record
    phpVersions.value = (response.data.php_versions || []).reduce((acc, v) => {
      acc[`php${v.version.replace('.', '')}`] = `PHP ${v.version}${v.is_default ? ' (Default)' : ''}`
      return acc
    }, {} as Record<string, string>)

    // Transform tls_options array to Record
    tlsOptions.value = (response.data.tls_options || []).reduce((acc, opt) => {
      acc[opt.value] = opt.label
      return acc
    }, {} as Record<string, string>)

    // Store source control and repository data directly
    sourceControlData.value = response.data.source_control || null
    repositoryData.value = response.data.repository || null
  } catch {
    // Use defaults
  }
}

const fetchDeletionResources = async () => {
  try {
    const response = await $api<{ data: { queues: number; crons: number } }>(
      `/servers/${props.serverId}/sites/${props.site.id}/deletion-resources`
    )
    deletionResources.value = response.data
  } catch {
    // Default to 0 if endpoint doesn't exist
    deletionResources.value = { queues: 0, crons: 0 }
  }
}

const currentSourceControl = computed(() => {
  if (!sourceControlData.value) {
    return null
  }
  return {
    displayName: sourceControlData.value.name,
    provider: sourceControlData.value.provider,
  }
})

const getProviderIcon = (providerName: string) => {
  const name = providerName.toLowerCase()
  if (name.includes('github')) return 'simple-icons:github'
  if (name.includes('gitlab')) return 'simple-icons:gitlab'
  if (name.includes('bitbucket')) return 'simple-icons:bitbucket'
  return 'simple-icons:git'
}

const openExternalLink = (url: string) => {
  if (typeof window !== 'undefined') {
    window.open(url, '_blank', 'noopener,noreferrer')
  }
}

const onSubmit = handleSubmit(async (values) => {
  if (!confirmationDialog.value) return

  const result = await confirmationDialog.value.show({
    title: 'Update Settings',
    description: 'Are you sure you want to update these settings? This may trigger a configuration reload.',
    confirmText: 'Update',
    cancelText: 'Cancel',
  })

  if (!result.ok) {
    toast.info('Cancelled')
    return
  }

  isLoading.value = true

  try {
    // Backend exposes site Settings updates via the canonical site
    // resource (PUT /sites/:id with UpdateSiteRequest), not a
    // /settings sub-resource — the latter is GET-only. Hitting the
    // old PATCH /settings path used to return 405 and the toast
    // said "Failed to update settings".
    await $api(`/servers/${props.serverId}/sites/${props.site.id}`, {
      method: 'PUT',
      body: values,
    })
    toast.success('Settings updated')
    emit('updated')
  } catch (error: unknown) {
    const err = error as { data?: { errors?: Record<string, string[]>; message?: string } }
    if (err.data?.errors) {
      for (const [field, messages] of Object.entries(err.data.errors)) {
        setFieldError(field as keyof typeof values, messages[0])
      }
    } else {
      toast.error(err.data?.message || 'Failed to update settings')
    }
  } finally {
    isLoading.value = false
  }
})

const deleteSite = async () => {
  if (!confirmationDialog.value) return

  // Fetch deletion resources before showing confirmation
  await fetchDeletionResources()

  const result = await confirmationDialog.value.show({
    title: 'Delete Site',
    description: `Are you sure you want to delete "${props.site.address}"? This action cannot be undone and will remove all associated queues (${deletionResources.value.queues}) and cron jobs (${deletionResources.value.crons}).`,
    confirmText: 'Delete Site',
    cancelText: 'Cancel',
    destructive: true,
    helpText: 'Type the site address to confirm deletion:',
    inputVerificationText: props.site.address,
  })

  if (result.ok) {
    try {
      await $api(`/servers/${props.serverId}/sites/${props.site.id}`, {
        method: 'DELETE',
      })
      toast.success('Site deleted')
      emit('deleted')
      navigateTo(`/servers/${props.serverId}`)
    } catch (error: unknown) {
      const err = error as { data?: { message?: string } }
      toast.error(err.data?.message || 'Failed to delete site')
    }
  }
}

onMounted(fetchSettings)
</script>

<template>
  <div>
    <SharedConfirmationDialog ref="confirmationDialog" />

    <div class="space-y-6">
      <!-- General Settings (hidden for phpmyadmin since no configurable fields) -->
      <template v-if="site.type !== 'phpmyadmin'">
        <div>
          <h3 class="text-lg font-semibold">Site Settings</h3>
          <p class="text-sm text-muted-foreground">Configure your site settings</p>
        </div>

        <form class="space-y-6" @submit.prevent="onSubmit">
        <div class="grid grid-cols-2 gap-6">
          <FormField v-slot="{ componentField }" name="php_version">
            <FormItem>
              <FormLabel>PHP Version</FormLabel>
              <Select v-bind="componentField">
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select PHP version" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem
                    v-for="(label, value) in phpVersions"
                    :key="value"
                    :value="value"
                  >
                    {{ label }}
                  </SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          </FormField>

          <FormField v-if="!['wordpress'].includes(site.type)" v-slot="{ componentField }" name="web_folder">
            <FormItem>
              <FormLabel>Web Folder</FormLabel>
              <FormControl>
                <Input placeholder="/public" v-bind="componentField" />
              </FormControl>
              <FormMessage />
            </FormItem>
          </FormField>

          <!-- Repository Info -->
          <template v-if="repositoryData">
            <div class="space-y-2">
              <Label class="text-sm font-medium">Repository</Label>
              <div class="flex items-center gap-2 rounded-sm border border-border bg-muted/40 p-3">
                <Icon
                  v-if="currentSourceControl"
                  :name="getProviderIcon(currentSourceControl.provider)"
                  class="h-4 w-4 flex-shrink-0"
                />
                <div class="min-w-0 flex-1">
                  <p class="truncate text-sm font-medium">
                    {{ repositoryData.name }}
                  </p>
                  <p class="truncate text-xs text-muted-foreground">
                    {{ currentSourceControl?.displayName }} • {{ currentSourceControl?.provider }}
                  </p>
                </div>
                <Button
                  v-if="repositoryData.html_url"
                  type="button"
                  variant="ghost"
                  size="sm"
                  class="h-8 px-2"
                  @click="openExternalLink(repositoryData.html_url)"
                >
                  <Icon name="lucide:external-link" class="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>

            <FormField v-slot="{ componentField }" name="repository_branch">
              <FormItem>
                <FormLabel>Branch</FormLabel>
                <FormDescription class="mb-2 text-xs">
                  Current: <code class="rounded bg-muted px-1 py-0.5 text-xs">{{ site.repository_branch }}</code>
                </FormDescription>
                <FormControl>
                  <Input :placeholder="repositoryData.default_branch || 'main'" v-bind="componentField" />
                </FormControl>
                <FormMessage />
              </FormItem>
            </FormField>
          </template>
        </div>

        <Button type="submit" :disabled="isLoading">
          <Icon v-if="isLoading" name="lucide:loader-2" class="mr-2 h-4 w-4 animate-spin" />
          Update Settings
        </Button>
        </form>
        <Separator />
      </template>

      <!-- SSL Settings -->
      <div class="space-y-4">
        <div>
          <h3 class="text-lg font-medium">SSL Settings</h3>
          <p class="text-sm text-muted-foreground">
            Configure SSL/TLS certificate settings for your site
          </p>
        </div>
        <SiteUpdateSsl
          :server-id="serverId"
          :site="site"
          :tls-options="tlsOptions"
          @updated="emit('updated')"
        />
      </div>

      <!-- Deployment Settings -->
      <template v-if="site.type !== 'phpmyadmin'">
        <Separator />
        <div class="space-y-4">
          <div>
            <h3 class="text-lg font-medium">Deployment Settings</h3>
            <p class="text-sm text-muted-foreground">
              Configure deployment hooks and zero-downtime settings
            </p>
          </div>
          <SiteDeploymentSettings
            :server-id="serverId"
            :site="site"
            @updated="emit('updated')"
          />
        </div>
      </template>

      <!-- Delete Site -->
      <Separator />
      <div class="space-y-4 pt-2">
        <div>
          <h3 class="text-lg font-medium text-destructive">Danger Zone</h3>
          <p class="text-sm text-muted-foreground">
            Permanently delete this site and all its associated resources
          </p>
        </div>
        <Button variant="destructive" @click="deleteSite">
          <Icon name="lucide:trash-2" class="mr-2 h-4 w-4" />
          Delete Site
        </Button>
      </div>
    </div>
  </div>
</template>
