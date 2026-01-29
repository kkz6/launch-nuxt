<script setup lang="ts">
import { toast } from 'vue-sonner'
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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '~/components/ui/collapsible'
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

// Provision script state
const provisionScript = ref('')
const provisionScriptLoading = ref(false)
const showScriptContent = ref(false)
const commandCopied = ref(false)
const scriptCopied = ref(false)

const canDelete = computed(() => siteCount.value === 0)

// Check if server is custom and needs provisioning
const isCustomServer = computed(() => props.server.provider === 'custom_server')
const needsProvisioning = computed(() => isCustomServer.value && props.server.status === 'new')

// Copy text to clipboard
const copyToClipboard = async (text: string, type: 'command' | 'script') => {
  try {
    await navigator.clipboard.writeText(text)
    if (type === 'command') {
      commandCopied.value = true
      setTimeout(() => { commandCopied.value = false }, 2000)
    } else {
      scriptCopied.value = true
      setTimeout(() => { scriptCopied.value = false }, 2000)
    }
    toast.success('Copied to clipboard')
  } catch {
    toast.error('Failed to copy to clipboard')
  }
}

// Fetch the provision script content
const fetchProvisionScript = async () => {
  if (provisionScript.value) return // Already fetched

  provisionScriptLoading.value = true
  try {
    const data = await $api<{ data: { script: string } }>(`/servers/${props.server.id}/provision-script-content`)
    provisionScript.value = data.data?.script || ''
  } catch (error: unknown) {
    const err = error as { data?: { message?: string } }
    toast.error(err.data?.message || 'Failed to fetch provision script')
  } finally {
    provisionScriptLoading.value = false
  }
}

onMounted(async () => {
  try {
    const data = await $api<{ data: { count: number } }>(`/servers/${props.server.id}/site-count`)
    siteCount.value = data.data?.count || 0
  } catch {
    siteCount.value = 0
  }

  // Fetch provision script for custom servers
  if (isCustomServer.value) {
    fetchProvisionScript()
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

    <!-- Server Information -->
    <div class="space-y-4">
      <div>
        <h3 class="text-lg font-medium">Server Information</h3>
        <p class="text-sm text-muted-foreground">
          Update your server name and description.
        </p>
      </div>

      <div class="space-y-4">
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

        <Button :disabled="isLoading" @click="updateServer">
          <Icon v-if="isLoading" name="lucide:loader-2" class="mr-2 h-4 w-4 animate-spin" />
          Save Changes
        </Button>
      </div>
    </div>

    <!-- Provision Command (Custom Servers Only) -->
    <template v-if="isCustomServer">
      <Separator />

      <div class="space-y-4">
        <div>
          <h3 class="flex items-center gap-2 text-lg font-medium">
            <Icon name="lucide:terminal" class="h-5 w-5" />
            Provision Command
          </h3>
          <p class="text-sm text-muted-foreground">
            Run this command as root on your server to authorize Launch to manage it.
          </p>
        </div>

        <!-- Quick Command -->
        <div v-if="server.provision_command" class="space-y-2">
          <Label>Quick Command</Label>
          <div class="flex items-center gap-2">
            <div class="flex-1 overflow-hidden rounded-md border bg-muted/50 p-3">
              <code class="break-all text-sm">{{ server.provision_command }}</code>
            </div>
            <Button
              variant="outline"
              size="icon"
              @click="copyToClipboard(server.provision_command!, 'command')"
            >
              <Icon
                :name="commandCopied ? 'lucide:check' : 'lucide:copy'"
                class="h-4 w-4"
              />
            </Button>
          </div>
          <p class="text-xs text-muted-foreground">
            This command downloads and runs the provisioning script from the server.
          </p>
        </div>

        <!-- Collapsible Script Content -->
        <Collapsible v-model:open="showScriptContent" class="space-y-2">
          <div class="flex items-center justify-between">
            <Label>Script Content (for local development)</Label>
            <CollapsibleTrigger as-child>
              <Button variant="ghost" size="sm">
                <Icon
                  :name="showScriptContent ? 'lucide:chevron-up' : 'lucide:chevron-down'"
                  class="mr-1 h-4 w-4"
                />
                {{ showScriptContent ? 'Hide' : 'Show' }} Script
              </Button>
            </CollapsibleTrigger>
          </div>

          <CollapsibleContent>
            <div class="space-y-2">
              <div v-if="provisionScriptLoading" class="flex items-center justify-center p-4">
                <Icon name="lucide:loader-2" class="h-5 w-5 animate-spin" />
              </div>
              <div v-else-if="provisionScript" class="relative">
                <div class="max-h-80 overflow-auto rounded-md border bg-muted/50">
                  <pre class="p-4 text-xs"><code>{{ provisionScript }}</code></pre>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  class="absolute right-2 top-2"
                  @click="copyToClipboard(provisionScript, 'script')"
                >
                  <Icon
                    :name="scriptCopied ? 'lucide:check' : 'lucide:copy'"
                    class="mr-1 h-3 w-3"
                  />
                  {{ scriptCopied ? 'Copied' : 'Copy' }}
                </Button>
              </div>
              <p class="text-xs text-muted-foreground">
                Use this if the server cannot reach the application URL (e.g., local development).
                Copy and paste this script directly into your server's terminal.
              </p>
            </div>
          </CollapsibleContent>
        </Collapsible>

        <!-- Status indicator -->
        <div v-if="needsProvisioning" class="flex items-start gap-3 rounded-lg bg-amber-50 p-4 dark:bg-amber-950/50">
          <Icon name="lucide:alert-triangle" class="mt-0.5 h-5 w-5 text-amber-600 dark:text-amber-400" />
          <div class="space-y-1">
            <p class="text-sm font-medium text-amber-800 dark:text-amber-200">
              Server pending provisioning
            </p>
            <p class="text-sm text-amber-700 dark:text-amber-300">
              Run the provision command on your server to allow Launch to connect and manage it.
            </p>
          </div>
        </div>
      </div>
    </template>

    <Separator />

    <!-- Archive Server -->
    <div class="space-y-4">
      <div>
        <h3 class="text-lg font-medium">Archive Server</h3>
        <p class="text-sm text-muted-foreground">
          Archive this server to remove access from the application while preserving
          the server data. You can unarchive it later to restore access.
        </p>
      </div>

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

      <AlertDialog v-model:open="showArchiveConfirm">
        <AlertDialogTrigger as-child>
          <Button
            variant="outline"
            class="border-orange-500/50 bg-orange-50 text-orange-600 hover:bg-orange-100 hover:text-orange-700 dark:border-orange-500/30 dark:bg-orange-950/50 dark:text-orange-400 dark:hover:bg-orange-900/50 dark:hover:text-orange-300"
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

    <Separator />

    <!-- Security Vulnerability Audit -->
    <div class="space-y-4">
      <div>
        <h3 class="flex items-center gap-2 text-lg font-medium">
          <Icon name="lucide:shield" class="h-5 w-5" />
          Security Vulnerability Audit
        </h3>
        <p class="text-sm text-muted-foreground">
          Run a comprehensive security audit on your server to identify potential
          vulnerabilities and security issues.
        </p>
      </div>

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

        <Button type="submit" :disabled="auditLoading">
          <Icon v-if="auditLoading" name="lucide:loader-2" class="mr-2 h-4 w-4 animate-spin" />
          {{ auditLoading ? 'Running Security Audit...' : 'Start Security Audit' }}
        </Button>
      </form>
    </div>

    <Separator />

    <!-- Danger Zone -->
    <div class="space-y-4">
      <div>
        <h3 class="text-lg font-medium text-destructive">Danger Zone</h3>
        <p class="text-sm text-muted-foreground">
          Permanently delete this server. This action cannot be undone.
        </p>
      </div>

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

      <Button
        variant="destructive"
        :disabled="!canDelete || deleteLoading"
        @click="deleteServer"
      >
        <Icon v-if="deleteLoading" name="lucide:loader-2" class="mr-2 h-4 w-4 animate-spin" />
        <Icon v-else name="lucide:trash-2" class="mr-2 h-4 w-4" />
        Delete Server
      </Button>
    </div>
  </div>
</template>
