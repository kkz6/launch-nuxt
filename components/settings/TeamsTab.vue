<script setup lang="ts">
import { toast } from 'vue-sonner'
import { Badge } from '~/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '~/components/ui/avatar'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select'
import { Separator } from '~/components/ui/separator'

interface TeamMember {
  id: string
  name: string
  email: string
  profile_photo_url?: string
  role: string
}

interface Team {
  id: string
  name: string
  personal_team: boolean
  owner_id: string
}

const { user } = useAuth()

const members = ref<TeamMember[]>([])
const currentTeam = ref<Team | null>(null)
const isLoading = ref(true)
const isInviteOpen = ref(false)

const roles = [
  {
    value: 'owner',
    label: 'Owner',
    description: 'Full access to everything.',
  },
  {
    value: 'editor',
    label: 'Editor',
    description: 'Can create, update, and destroy everything except members, organization settings, and billing.',
  },
  {
    value: 'developer',
    label: 'Developer',
    description: 'Can create and update servers and sites but cannot delete them. Cannot manage organization settings or billing.',
  },
  {
    value: 'viewer',
    label: 'Viewer',
    description: 'Read-only access. Cannot read environment variables, service connection details, or access billing.',
  },
]

const isOwner = computed(() => {
  return currentTeam.value?.owner_id === String(user.value?.id)
})

const fetchTeamMembers = async () => {
  try {
    const teamId = user.value?.current_team_id
    if (!teamId) return

    const [teamResponse, membersResponse] = await Promise.all([
      $api<{ data: Team }>(`/teams/${teamId}`),
      $api<{ data: TeamMember[] }>(`/teams/${teamId}/members`),
    ])
    currentTeam.value = teamResponse.data
    members.value = membersResponse.data
  } catch {
    toast.error('Failed to load team members')
  } finally {
    isLoading.value = false
  }
}

const updateMemberRole = async (memberId: string, role: string) => {
  try {
    await $api(`/teams/${currentTeam.value?.id}/members/${memberId}`, {
      method: 'PUT',
      body: { role },
    })
    const member = members.value.find((m) => m.id === memberId)
    if (member) member.role = role
    toast.success('Role updated')
  } catch {
    toast.error('Failed to update role')
  }
}

const getMemberInitials = (name: string) => {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

const isCurrentUser = (memberId: string) => {
  return memberId === String(user.value?.id)
}

onMounted(fetchTeamMembers)
</script>

<template>
  <div class="divide-y">
    <div v-if="isLoading" class="flex items-center justify-center px-6 py-12">
      <Icon name="lucide:loader-2" class="h-6 w-6 animate-spin text-muted-foreground" />
    </div>

    <template v-else>
      <!-- Members Section -->
      <div class="px-6 pb-6">
        <!-- Members List -->
        <div class="space-y-1">
          <div
            v-for="member in members"
            :key="member.id"
            class="flex items-center justify-between py-2.5"
          >
            <div class="flex items-center gap-3">
              <Avatar class="h-8 w-8">
                <AvatarImage v-if="member.profile_photo_url" :src="member.profile_photo_url" />
                <AvatarFallback class="text-xs">
                  {{ getMemberInitials(member.name) }}
                </AvatarFallback>
              </Avatar>
              <div>
                <div class="flex items-center gap-1.5">
                  <span class="text-sm font-medium">{{ member.name }}</span>
                  <span v-if="isCurrentUser(member.id)" class="text-sm text-muted-foreground">(you)</span>
                </div>
                <span class="text-xs text-muted-foreground">{{ member.email }}</span>
              </div>
            </div>

            <Select
              :model-value="member.role"
              :disabled="!isOwner || member.role === 'owner'"
              @update:model-value="(value) => updateMemberRole(member.id, value as string)"
            >
              <SelectTrigger class="w-28 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem v-for="role in roles" :key="role.value" :value="role.value">
                  {{ role.label }}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <!-- Invite Member -->
        <button
          v-if="isOwner"
          class="mt-3 flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          @click="isInviteOpen = true"
        >
          <Icon name="lucide:plus" class="h-4 w-4" />
          Invite member
        </button>
      </div>

      <!-- Role Descriptions -->
      <div class="px-6 pt-6">
        <div class="space-y-4">
          <div
            v-for="role in roles"
            :key="role.value"
            class="grid grid-cols-[120px_1fr] gap-4 text-sm"
          >
            <span class="font-medium">{{ role.label }}</span>
            <span class="text-muted-foreground">{{ role.description }}</span>
          </div>
        </div>
      </div>
    </template>

    <!-- Invite Member Dialog -->
    <SettingsInviteMember
      v-model:open="isInviteOpen"
      :team-id="currentTeam?.id"
      @invited="fetchTeamMembers"
    />
  </div>
</template>
