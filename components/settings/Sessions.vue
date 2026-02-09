<script setup lang="ts">
import { toast } from 'vue-sonner'
import { Button } from '~/components/ui/button'
import { Badge } from '~/components/ui/badge'
import type { UserSession } from '~/types'

const sessions = ref<UserSession[]>([])
const isLoading = ref(false)
const confirmationDialog = ref<InstanceType<typeof import('~/components/shared/ConfirmationDialog.vue').default> | null>(null)

const fetchSessions = async () => {
  isLoading.value = true
  try {
    const response = await $api<{ data: UserSession[] }>('/user/sessions')
    sessions.value = response.data || []
  } catch {
    toast.error('Failed to load sessions')
  } finally {
    isLoading.value = false
  }
}

const revokeSession = async (id: string) => {
  if (!confirmationDialog.value) return

  const result = await confirmationDialog.value.show({
    title: 'Revoke Session',
    description: 'Are you sure you want to revoke this session? The device will be signed out.',
    confirmText: 'Revoke',
    cancelText: 'Cancel',
    destructive: true,
  })

  if (!result.ok) return

  try {
    await $api(`/user/sessions/${id}`, { method: 'DELETE' })
    toast.success('Session revoked')
    await fetchSessions()
  } catch {
    toast.error('Failed to revoke session')
  }
}

const revokeOtherSessions = async () => {
  if (!confirmationDialog.value) return

  const otherCount = sessions.value.filter(s => !s.is_current_device).length
  if (otherCount === 0) {
    toast.info('No other sessions to revoke')
    return
  }

  const result = await confirmationDialog.value.show({
    title: 'Log Out Other Sessions',
    description: `This will revoke ${otherCount} other session${otherCount === 1 ? '' : 's'}. Those devices will be signed out.`,
    confirmText: 'Log Out Others',
    cancelText: 'Cancel',
    destructive: true,
  })

  if (!result.ok) return

  try {
    await $api('/user/sessions', { method: 'DELETE' })
    toast.success('Other sessions revoked')
    await fetchSessions()
  } catch {
    toast.error('Failed to revoke sessions')
  }
}

const deviceIcon = (session: UserSession) => {
  if (!session.agent.is_desktop) return 'lucide:smartphone'
  return 'lucide:monitor'
}

const formatLastActive = (dateStr: string) => {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  return date.toLocaleDateString()
}

onMounted(fetchSessions)
</script>

<template>
  <div class="space-y-4">
    <SharedConfirmationDialog ref="confirmationDialog" />

    <div v-if="isLoading && sessions.length === 0" class="py-4 text-center text-sm text-muted-foreground">
      Loading sessions...
    </div>

    <template v-else>
      <div v-if="sessions.length > 1" class="flex justify-end">
        <Button variant="outline" size="sm" @click="revokeOtherSessions">
          Log Out Other Sessions
        </Button>
      </div>

      <div v-if="sessions.length > 0" class="space-y-3">
        <div
          v-for="session in sessions"
          :key="session.id"
          class="flex items-center justify-between rounded-lg border p-3"
        >
          <div class="flex items-center gap-3">
            <Icon :name="deviceIcon(session)" class="block size-5 text-muted-foreground" />
            <div>
              <div class="flex items-center gap-2 text-sm font-medium">
                {{ session.agent.browser }} on {{ session.agent.platform }}
                <Badge v-if="session.is_current_device" variant="secondary" class="text-xs">
                  This device
                </Badge>
              </div>
              <div class="text-xs text-muted-foreground">
                {{ session.ip_address }} &middot; {{ formatLastActive(session.last_active) }}
              </div>
            </div>
          </div>

          <Button
            v-if="!session.is_current_device"
            variant="ghost"
            size="sm"
            class="text-destructive hover:text-destructive"
            @click="revokeSession(session.id)"
          >
            Revoke
          </Button>
        </div>
      </div>

      <div v-else class="py-4 text-center text-muted-foreground">
        <Icon name="lucide:shield" class="mx-auto mb-2 block size-8 opacity-50" />
        <p class="text-sm">No active sessions found.</p>
      </div>
    </template>
  </div>
</template>
