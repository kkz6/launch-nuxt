<script setup lang="ts">
import { toast } from 'vue-sonner'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { Label } from '~/components/ui/label'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select'
import type { Server } from '~/types'

const servers = ref<Server[]>([])
const selectedServerId = ref('')
const auditEmail = ref('')
const auditLoading = ref(false)
const isLoadingServers = ref(true)
const confirmationDialog = ref<InstanceType<typeof import('~/components/shared/ConfirmationDialog.vue').default> | null>(null)

const fetchServers = async () => {
  isLoadingServers.value = true
  try {
    const response = await $api<{ data: Server[] }>('/servers')
    servers.value = response.data.filter((s: Server) => s.connected)
  } catch {
    // Silent fail - select will show empty state
  } finally {
    isLoadingServers.value = false
  }
}

const runVulnerabilityAudit = async () => {
  if (!selectedServerId.value) {
    toast.error('Please select a server')
    return
  }

  if (!confirmationDialog.value) return

  const server = servers.value.find((s) => s.id === selectedServerId.value)
  const result = await confirmationDialog.value.show({
    title: 'Start Security Audit',
    description: `This will run a comprehensive security audit on "${server?.name || 'the selected server'}". The results will be sent to your email when completed.`,
    confirmText: 'Start Audit',
    cancelText: 'Cancel',
  })

  if (!result.ok) return

  auditLoading.value = true
  try {
    const response = await $api<{ message: string }>(`/servers/${selectedServerId.value}/vulnerability-audit`, {
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

onMounted(fetchServers)
</script>

<template>
  <div class="divide-y">
    <SharedConfirmationDialog ref="confirmationDialog" />

    <!-- Passkeys Section -->
    <div class="px-6 pb-6">
      <h3 class="mb-1 text-base font-semibold">Passkeys</h3>
      <p class="mb-4 text-sm text-muted-foreground">
        Use passkeys for passwordless authentication.
      </p>
      <SettingsPasskeys />
    </div>

    <!-- Two-Factor Authentication Section -->
    <div class="px-6 py-6">
      <h3 class="mb-1 text-base font-semibold">Two-Factor Authentication</h3>
      <p class="mb-4 text-sm text-muted-foreground">
        Add an extra layer of security to your account.
      </p>
      <SettingsTwoFactor />
    </div>

    <!-- Server Security Audit Section -->
    <div class="px-6 pt-6">
      <h3 class="mb-1 flex items-center gap-2 text-base font-semibold">
        <Icon name="lucide:shield" class="h-4 w-4" />
        Server Security Audit
      </h3>
      <p class="mb-4 text-sm text-muted-foreground">
        Run a comprehensive security audit on a server to identify potential
        vulnerabilities and security issues.
      </p>

      <form class="space-y-4" @submit.prevent="runVulnerabilityAudit">
        <div class="space-y-2">
          <Label>Server</Label>
          <Select v-model="selectedServerId">
            <SelectTrigger>
              <SelectValue placeholder="Select a server" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <template v-if="isLoadingServers">
                  <SelectLabel class="text-muted-foreground">Loading servers...</SelectLabel>
                </template>
                <template v-else-if="servers.length > 0">
                  <SelectItem
                    v-for="server in servers"
                    :key="server.id"
                    :value="server.id"
                  >
                    {{ server.name }} ({{ server.public_ipv4 }})
                  </SelectItem>
                </template>
                <template v-else>
                  <SelectLabel class="text-muted-foreground">No connected servers</SelectLabel>
                </template>
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>

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

        <Button type="submit" :disabled="auditLoading || !selectedServerId">
          <Icon v-if="auditLoading" name="lucide:loader-2" class="mr-2 h-4 w-4 animate-spin" />
          {{ auditLoading ? 'Running Security Audit...' : 'Start Security Audit' }}
        </Button>
      </form>
    </div>
  </div>
</template>
