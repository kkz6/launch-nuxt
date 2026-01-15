<script setup lang="ts">
import { toast } from 'vue-sonner'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/card'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { Label } from '~/components/ui/label'
import { Textarea } from '~/components/ui/textarea'
import { Switch } from '~/components/ui/switch'
import { Separator } from '~/components/ui/separator'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '~/components/ui/alert-dialog'
import type { Server } from '~/types'

interface Props {
  server: Server
}

const props = defineProps<Props>()

const name = ref(props.server.name)
const description = ref(props.server.description || '')
const autoUpdate = ref(props.server.auto_update === 'true' || props.server.auto_update === '1')
const isLoading = ref(false)
const deleteLoading = ref(false)
const archiveLoading = ref(false)
const confirmationDialog = ref<InstanceType<typeof import('~/components/shared/ConfirmationDialog.vue').default> | null>(null)
const showArchiveConfirm = ref(false)
const auditLoading = ref(false)
const auditEmail = ref('')
const siteCount = ref(0)

const canDelete = computed(() => siteCount.value === 0)

onMounted(async () => {
  try {
    const data = await $api<{ data: { count: number } }>(`/servers/${props.server.id}/site-count`)
    siteCount.value = data.data?.count || 0
  } catch {
    siteCount.value = 0
  }
})

const updateServer = async () => {
  isLoading.value = true
  try {
    await $api(`/servers/${props.server.id}`, {
      method: 'PATCH',
      body: {
        name: name.value,
        description: description.value,
        auto_update: autoUpdate.value,
      },
    })
    toast.success('Server settings updated')
  } catch (error: unknown) {
    const err = error as { data?: { message?: string } }
    toast.error(err.data?.message || 'Failed to update server')
  } finally {
    isLoading.value = false
  }
}

const archiveServer = async () => {
  archiveLoading.value = true
  try {
    await $api(`/servers/${props.server.id}/archive`, {
      method: 'POST',
    })
    toast.success('Server is being archived. Access will be revoked shortly.')
    showArchiveConfirm.value = false
    navigateTo('/servers')
  } catch (error: unknown) {
    const err = error as { data?: { message?: string } }
    toast.error(err.data?.message || 'Unable to archive server')
  } finally {
    archiveLoading.value = false
  }
}

const runVulnerabilityAudit = async () => {
  if (!confirmationDialog.value) return

  const result = await confirmationDialog.value.show({
    title: 'Start Security Audit',
    description: 'This will run a comprehensive security audit on your server. The results will be sent to your email when completed.',
    confirmText: 'Start Audit',
    cancelText: 'Cancel',
  })

  if (!result.ok) return

  auditLoading.value = true
  try {
    const response = await $api<{ message: string }>(`/servers/${props.server.id}/vulnerability-audit`, {
      method: 'POST',
      body: auditEmail.value ? { email: auditEmail.value } : {},
    })
    toast.success(response.message || 'Vulnerability audit has been queued successfully')
    auditEmail.value = ''
  } catch (error: unknown) {
    const err = error as { data?: { message?: string } }
    toast.error(err.data?.message || 'Failed to start vulnerability audit')
  } finally {
    auditLoading.value = false
  }
}

const deleteServer = async () => {
  if (siteCount.value > 0) {
    toast.error('Cannot delete server with active sites. Please delete all sites first.')
    return
  }

  if (!confirmationDialog.value) return

  const result = await confirmationDialog.value.show({
    title: 'Delete Server',
    description: `Are you sure you want to delete "${props.server.name}"? This action cannot be undone and will permanently remove the server from your account.`,
    confirmText: 'Delete Server',
    cancelText: 'Cancel',
    destructive: true,
    helpText: 'Type the server name to confirm deletion:',
    inputVerificationText: props.server.name,
  })

  if (!result.ok) return

  deleteLoading.value = true
  try {
    await $api(`/servers/${props.server.id}`, {
      method: 'DELETE',
    })
    toast.success('Server deleted successfully')
    navigateTo('/servers')
  } catch (error: unknown) {
    const err = error as { data?: { message?: string } }
    toast.error(err.data?.message || 'Unable to delete server')
  } finally {
    deleteLoading.value = false
  }
}
</script>

<template>
  <div class="space-y-6">
    <SharedConfirmationDialog ref="confirmationDialog" />

    <!-- Server Information Card -->
    <Card>
      <CardHeader>
        <CardTitle>Server Information</CardTitle>
        <CardDescription>
          Update your server name and description. Changes will be saved immediately.
        </CardDescription>
      </CardHeader>
      <CardContent class="space-y-4">
        <div class="space-y-2">
          <Label for="name">Server Name</Label>
          <Input id="name" v-model="name" placeholder="Enter server name" />
        </div>

        <div class="space-y-2">
          <Label for="description">Description</Label>
          <Textarea
            id="description"
            v-model="description"
            placeholder="Enter a description for your server (optional)"
            :rows="3"
          />
        </div>

        <div class="flex items-center justify-between rounded-lg border p-4">
          <div class="space-y-0.5">
            <Label>Auto Updates</Label>
            <p class="text-sm text-muted-foreground">
              Automatically install security updates
            </p>
          </div>
          <Switch v-model="autoUpdate" />
        </div>

        <Button :disabled="isLoading" class="w-full sm:w-auto" @click="updateServer">
          <Icon v-if="isLoading" name="lucide:loader-2" class="mr-2 h-4 w-4 animate-spin" />
          Save Changes
        </Button>
      </CardContent>
    </Card>

    <Separator />

    <!-- Archive Server Card -->
    <Card>
      <CardHeader>
        <CardTitle>Archive Server</CardTitle>
        <CardDescription>
          Archive this server to remove access from the application while preserving
          the server data. You can unarchive it later to restore access.
        </CardDescription>
      </CardHeader>
      <CardContent class="flex flex-col gap-4">
        <div v-if="siteCount > 0" class="flex items-start gap-3 rounded-lg bg-blue-50 p-4 dark:bg-blue-950/50">
          <div class="space-y-1">
            <p class="text-sm font-medium text-blue-800 dark:text-blue-200">
              Server has active sites
            </p>
            <p class="text-sm text-blue-700 dark:text-blue-300">
              This server has {{ siteCount }} active site{{ siteCount !== 1 ? 's' : '' }}.
              Archiving will not affect the sites, but you won't be able to manage them through the dashboard.
            </p>
          </div>
        </div>

        <div>
          <AlertDialog v-model:open="showArchiveConfirm">
            <AlertDialogTrigger as-child>
              <Button
                variant="outline"
                class="w-full border-orange-500/50 bg-orange-50 text-orange-600 hover:bg-orange-100 hover:text-orange-700 dark:border-orange-500/30 dark:bg-orange-950/50 dark:text-orange-400 dark:hover:bg-orange-900/50 dark:hover:text-orange-300 sm:w-auto"
              >
                Archive Server
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent class="max-w-lg">
              <AlertDialogHeader>
                <AlertDialogTitle>Archive Server</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to archive "{{ server.name }}"?
                </AlertDialogDescription>
              </AlertDialogHeader>
              <div class="space-y-4 py-2">
                <p class="text-sm text-muted-foreground">
                  This will revoke access keys and remove the server from your dashboard.
                  <template v-if="siteCount > 0">
                    The {{ siteCount }} active site{{ siteCount !== 1 ? 's' : '' }} will continue running
                    but cannot be managed.
                  </template>
                  You can unarchive it later by running the provision script again.
                </p>
              </div>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  :disabled="archiveLoading"
                  class="border-orange-500/50 bg-orange-50 text-orange-600 hover:bg-orange-100 hover:text-orange-700 dark:border-orange-500/30 dark:bg-orange-950/50 dark:text-orange-400 dark:hover:bg-orange-900/50 dark:hover:text-orange-300"
                  @click="archiveServer"
                >
                  <Icon v-if="archiveLoading" name="lucide:loader-2" class="mr-2 h-4 w-4 animate-spin" />
                  {{ archiveLoading ? 'Archiving...' : 'Yes, archive server' }}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </CardContent>
    </Card>

    <Separator />

    <!-- Security Audit Card -->
    <Card>
      <CardHeader>
        <CardTitle class="flex items-center gap-2">
          <Icon name="lucide:shield" class="h-5 w-5" />
          Security Vulnerability Audit
        </CardTitle>
        <CardDescription>
          Run a comprehensive security audit on your server to identify potential
          vulnerabilities and security issues. The report will be sent to your email
          when completed.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form class="space-y-4" @submit.prevent="runVulnerabilityAudit">
          <div class="space-y-2">
            <Label for="audit-email">Email Address (Optional)</Label>
            <Input
              id="audit-email"
              v-model="auditEmail"
              type="email"
              placeholder="Leave empty to use your account email"
            />
          </div>

          <div class="space-y-3">
            <div class="flex items-start gap-3 rounded-lg bg-blue-50 p-4 dark:bg-blue-950/50">
              <div class="space-y-1">
                <p class="text-sm font-medium text-blue-800 dark:text-blue-200">
                  What will be audited?
                </p>
                <ul class="list-inside list-disc space-y-1 text-sm text-blue-700 dark:text-blue-300">
                  <li>Security updates and patches</li>
                  <li>SSH configuration and security settings</li>
                  <li>User accounts and password policies</li>
                  <li>Network security and firewall settings</li>
                  <li>File permissions and SUID/SGID files</li>
                  <li>Running services and processes</li>
                  <li>System logs for security events</li>
                </ul>
              </div>
            </div>

            <Button
              type="submit"
              :disabled="auditLoading"
              class="w-full sm:w-auto"
            >
              <Icon v-if="auditLoading" name="lucide:loader-2" class="mr-2 h-4 w-4 animate-spin" />
              {{ auditLoading ? 'Running Security Audit...' : 'Start Security Audit' }}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>

    <Separator />

    <!-- Danger Zone Card -->
    <Card>
      <CardHeader>
        <CardTitle>Danger Zone</CardTitle>
        <CardDescription>
          Permanently delete this server. This action cannot be undone.
        </CardDescription>
      </CardHeader>
      <CardContent class="flex flex-col gap-4">
        <div v-if="!canDelete" class="flex items-start gap-3 rounded-lg bg-yellow-50 p-4 dark:bg-yellow-950/50">
          <div class="space-y-1">
            <p class="text-sm font-medium text-yellow-800 dark:text-yellow-200">
              Cannot delete server
            </p>
            <p class="text-sm text-yellow-700 dark:text-yellow-300">
              This server has {{ siteCount }} active site{{ siteCount !== 1 ? 's' : '' }}.
              Please delete all sites before removing the server.
            </p>
          </div>
        </div>

        <div>
          <Button
            variant="destructive"
            :disabled="!canDelete || deleteLoading"
            class="w-full sm:w-auto"
            @click="deleteServer"
          >
            <Icon v-if="deleteLoading" name="lucide:loader-2" class="mr-2 h-4 w-4 animate-spin" />
            Delete Server
          </Button>
        </div>
      </CardContent>
    </Card>
  </div>
</template>
