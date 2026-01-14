<script setup lang="ts">
import { toast } from 'vue-sonner'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { Label } from '~/components/ui/label'
import { Badge } from '~/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '~/components/ui/avatar'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '~/components/ui/collapsible'

interface Team {
  id: string
  name: string
  personal_team: boolean
  image_url?: string
  users_count?: number
  created_at: string
}

const { user, setUser } = useAuth()
const colorMode = useColorMode()

// Collapsible states
const profileOpen = ref(true)
const teamsOpen = ref(false)
const appearanceOpen = ref(false)
const passwordOpen = ref(false)

// Teams state
const teams = ref<Team[]>([])
const isTeamsLoading = ref(true)

const currentTeam = computed(() =>
  teams.value.find((t) => t.id === String(user.value?.current_team_id))
)

const fetchTeams = async () => {
  try {
    const response = await $api<{ data: Team[] }>('/teams')
    teams.value = response.data
  } catch {
    toast.error('Failed to load teams')
  } finally {
    isTeamsLoading.value = false
  }
}

const switchTeam = async (teamId: string) => {
  try {
    await $api(`/teams/${teamId}/switch`, { method: 'POST' })
    window.location.reload()
  } catch {
    toast.error('Failed to switch team')
  }
}

onMounted(fetchTeams)

// Profile form state
const isLoading = ref(false)
const name = ref(user.value?.name || '')
const email = ref(user.value?.email || '')
const profileErrors = ref<{ name?: string; email?: string }>({})

// Password form state
const isPasswordLoading = ref(false)
const currentPassword = ref('')
const password = ref('')
const passwordConfirmation = ref('')
const passwordErrors = ref<{ current_password?: string; password?: string; password_confirmation?: string }>({})

// Appearance state
const appearance = ref(colorMode.preference || 'system')

watch(
  user,
  (newUser) => {
    if (newUser) {
      name.value = newUser.name
      email.value = newUser.email
    }
  },
  { immediate: true }
)

const validateProfile = (): boolean => {
  profileErrors.value = {}
  if (!name.value.trim() || name.value.length < 2) {
    profileErrors.value.name = 'Name must be at least 2 characters'
  }
  if (!email.value.trim() || !email.value.includes('@')) {
    profileErrors.value.email = 'Please enter a valid email address'
  }
  return Object.keys(profileErrors.value).length === 0
}

const validatePassword = (): boolean => {
  passwordErrors.value = {}
  if (!currentPassword.value) {
    passwordErrors.value.current_password = 'Current password is required'
  }
  if (!password.value || password.value.length < 8) {
    passwordErrors.value.password = 'Password must be at least 8 characters'
  }
  if (password.value !== passwordConfirmation.value) {
    passwordErrors.value.password_confirmation = "Passwords don't match"
  }
  return Object.keys(passwordErrors.value).length === 0
}

const onProfileSubmit = async () => {
  if (!validateProfile()) return

  isLoading.value = true
  try {
    const response = await $api<{ data: { user: import('~/types').User } }>(
      '/user/profile',
      {
        method: 'PUT',
        body: { name: name.value, email: email.value },
      }
    )
    setUser(response.data.user)
    toast.success('Profile updated successfully')
  } catch (error: unknown) {
    const err = error as { data?: { errors?: Record<string, string[]>; message?: string } }
    if (err.data?.errors) {
      for (const [field, messages] of Object.entries(err.data.errors)) {
        profileErrors.value[field as keyof typeof profileErrors.value] = messages[0]
      }
    } else {
      toast.error(err.data?.message || 'Failed to update profile')
    }
  } finally {
    isLoading.value = false
  }
}

const onPasswordSubmit = async () => {
  if (!validatePassword()) return

  isPasswordLoading.value = true
  try {
    await $api('/user/password', {
      method: 'PUT',
      body: {
        current_password: currentPassword.value,
        password: password.value,
        password_confirmation: passwordConfirmation.value,
      },
    })
    toast.success('Password updated successfully')
    currentPassword.value = ''
    password.value = ''
    passwordConfirmation.value = ''
  } catch (error: unknown) {
    const err = error as { data?: { errors?: Record<string, string[]>; message?: string } }
    if (err.data?.errors) {
      for (const [field, messages] of Object.entries(err.data.errors)) {
        passwordErrors.value[field as keyof typeof passwordErrors.value] = messages[0]
      }
    } else {
      toast.error(err.data?.message || 'Failed to update password')
    }
  } finally {
    isPasswordLoading.value = false
  }
}

const setColorModePreference = (mode: unknown) => {
  if (typeof mode !== 'string') return
  if (mode !== 'light' && mode !== 'dark' && mode !== 'system') return
  colorMode.preference = mode
  if (mode === 'dark') {
    document.documentElement.classList.add('dark')
  } else if (mode === 'light') {
    document.documentElement.classList.remove('dark')
  } else {
    if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }
  toast.success('Theme updated')
}
</script>

<template>
  <div class="space-y-4">
    <!-- Profile Information -->
    <Collapsible v-model:open="profileOpen" class="rounded-lg border">
      <CollapsibleTrigger class="flex w-full items-center justify-between p-4 hover:bg-muted/50">
        <div class="flex items-center gap-2">
          <Icon name="lucide:user" class="size-4 text-muted-foreground" />
          <span class="font-medium">Profile Information</span>
        </div>
        <Icon
          name="lucide:chevron-down"
          class="size-4 text-muted-foreground transition-transform"
          :class="{ 'rotate-180': profileOpen }"
        />
      </CollapsibleTrigger>
      <CollapsibleContent class="border-t px-4 pb-4 pt-4">
        <form class="space-y-4" @submit.prevent="onProfileSubmit">
          <div class="space-y-2">
            <Label for="name">Name</Label>
            <Input
              id="name"
              v-model="name"
              type="text"
              :class="{ 'border-destructive': profileErrors.name }"
            />
            <p v-if="profileErrors.name" class="text-sm text-destructive">
              {{ profileErrors.name }}
            </p>
          </div>

          <div class="space-y-2">
            <Label for="email">Email</Label>
            <Input
              id="email"
              v-model="email"
              type="email"
              :class="{ 'border-destructive': profileErrors.email }"
            />
            <p v-if="profileErrors.email" class="text-sm text-destructive">
              {{ profileErrors.email }}
            </p>
          </div>

          <Button :disabled="isLoading" type="submit">
            <Icon
              v-if="isLoading"
              name="lucide:loader-2"
              class="mr-2 block size-4 animate-spin"
            />
            Save
          </Button>
        </form>
      </CollapsibleContent>
    </Collapsible>

    <!-- Teams -->
    <Collapsible v-model:open="teamsOpen" class="rounded-lg border">
      <CollapsibleTrigger class="flex w-full items-center justify-between p-4 hover:bg-muted/50">
        <div class="flex items-center gap-2">
          <Icon name="lucide:users" class="size-4 text-muted-foreground" />
          <span class="font-medium">Teams</span>
          <Badge v-if="teams.length" variant="secondary" class="ml-1">
            {{ teams.length }}
          </Badge>
        </div>
        <Icon
          name="lucide:chevron-down"
          class="size-4 text-muted-foreground transition-transform"
          :class="{ 'rotate-180': teamsOpen }"
        />
      </CollapsibleTrigger>
      <CollapsibleContent class="border-t px-4 pb-4 pt-4">
        <div v-if="isTeamsLoading" class="flex items-center justify-center py-8">
          <Icon name="lucide:loader-2" class="size-5 animate-spin text-muted-foreground" />
        </div>

        <div v-else class="space-y-3">
          <div
            v-for="team in teams"
            :key="team.id"
            class="flex items-center justify-between rounded-lg border p-3"
          >
            <div class="flex items-center gap-3">
              <Avatar class="size-9">
                <AvatarImage v-if="team.image_url" :src="team.image_url" />
                <AvatarFallback class="text-xs">
                  {{ team.name.slice(0, 2).toUpperCase() }}
                </AvatarFallback>
              </Avatar>
              <div>
                <div class="flex items-center gap-2">
                  <span class="text-sm font-medium">{{ team.name }}</span>
                  <Badge v-if="team.personal_team" variant="outline" class="text-xs">
                    Personal
                  </Badge>
                  <Badge
                    v-if="currentTeam?.id === team.id"
                    variant="secondary"
                    class="text-xs"
                  >
                    Current
                  </Badge>
                </div>
                <span class="text-xs text-muted-foreground">
                  {{ team.users_count || 1 }} {{ (team.users_count || 1) === 1 ? 'member' : 'members' }}
                </span>
              </div>
            </div>
            <Button
              v-if="currentTeam?.id !== team.id"
              variant="outline"
              size="sm"
              @click="switchTeam(team.id)"
            >
              Switch
            </Button>
          </div>

          <CreateTeam />
        </div>
      </CollapsibleContent>
    </Collapsible>

    <!-- Appearance -->
    <Collapsible v-model:open="appearanceOpen" class="rounded-lg border">
      <CollapsibleTrigger class="flex w-full items-center justify-between p-4 hover:bg-muted/50">
        <div class="flex items-center gap-2">
          <Icon name="lucide:palette" class="size-4 text-muted-foreground" />
          <span class="font-medium">Appearance</span>
        </div>
        <Icon
          name="lucide:chevron-down"
          class="size-4 text-muted-foreground transition-transform"
          :class="{ 'rotate-180': appearanceOpen }"
        />
      </CollapsibleTrigger>
      <CollapsibleContent class="border-t px-4 pb-4 pt-4">
        <div class="space-y-2">
          <Label for="appearance">Theme</Label>
          <Select v-model="appearance" @update:model-value="setColorModePreference">
            <SelectTrigger>
              <SelectValue placeholder="Select a theme" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="light">
                <div class="flex items-center gap-2">
                  <Icon name="lucide:sun" class="block size-4" />
                  Light
                </div>
              </SelectItem>
              <SelectItem value="dark">
                <div class="flex items-center gap-2">
                  <Icon name="lucide:moon" class="block size-4" />
                  Dark
                </div>
              </SelectItem>
              <SelectItem value="system">
                <div class="flex items-center gap-2">
                  <Icon name="lucide:laptop" class="block size-4" />
                  System
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CollapsibleContent>
    </Collapsible>

    <!-- Update Password -->
    <Collapsible v-model:open="passwordOpen" class="rounded-lg border">
      <CollapsibleTrigger class="flex w-full items-center justify-between p-4 hover:bg-muted/50">
        <div class="flex items-center gap-2">
          <Icon name="lucide:lock" class="size-4 text-muted-foreground" />
          <span class="font-medium">Update Password</span>
        </div>
        <Icon
          name="lucide:chevron-down"
          class="size-4 text-muted-foreground transition-transform"
          :class="{ 'rotate-180': passwordOpen }"
        />
      </CollapsibleTrigger>
      <CollapsibleContent class="border-t px-4 pb-4 pt-4">
        <form class="space-y-4" @submit.prevent="onPasswordSubmit">
          <div class="space-y-2">
            <Label for="current_password">Current Password</Label>
            <Input
              id="current_password"
              v-model="currentPassword"
              type="password"
              :class="{ 'border-destructive': passwordErrors.current_password }"
            />
            <p v-if="passwordErrors.current_password" class="text-sm text-destructive">
              {{ passwordErrors.current_password }}
            </p>
          </div>

          <div class="space-y-2">
            <Label for="password">New Password</Label>
            <Input
              id="password"
              v-model="password"
              type="password"
              :class="{ 'border-destructive': passwordErrors.password }"
            />
            <p v-if="passwordErrors.password" class="text-sm text-destructive">
              {{ passwordErrors.password }}
            </p>
          </div>

          <div class="space-y-2">
            <Label for="password_confirmation">Confirm Password</Label>
            <Input
              id="password_confirmation"
              v-model="passwordConfirmation"
              type="password"
              :class="{ 'border-destructive': passwordErrors.password_confirmation }"
            />
            <p v-if="passwordErrors.password_confirmation" class="text-sm text-destructive">
              {{ passwordErrors.password_confirmation }}
            </p>
          </div>

          <Button :disabled="isPasswordLoading" type="submit">
            <Icon
              v-if="isPasswordLoading"
              name="lucide:loader-2"
              class="mr-2 block size-4 animate-spin"
            />
            Update Password
          </Button>
        </form>
      </CollapsibleContent>
    </Collapsible>
  </div>
</template>
