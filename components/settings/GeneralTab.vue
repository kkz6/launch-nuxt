<script setup lang="ts">
import { toast } from 'vue-sonner'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { Label } from '~/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select'

const { user, setUser } = useAuth()
const colorMode = useColorMode()

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
  <div class="divide-y">
    <!-- Profile Section -->
    <div class="px-6 pb-6">
      <form class="space-y-4" @submit.prevent="onProfileSubmit">
        <div class="space-y-1.5">
          <Label for="name" class="text-xs font-medium text-muted-foreground">Name</Label>
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

        <div class="space-y-1.5">
          <Label for="email" class="text-xs font-medium text-muted-foreground">Email</Label>
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

        <Button :disabled="isLoading" type="submit" size="sm">
          <Icon
            v-if="isLoading"
            name="lucide:loader-2"
            class="mr-2 block size-4 animate-spin"
          />
          Save Changes
        </Button>
      </form>
    </div>

    <!-- Appearance Section -->
    <div class="px-6 py-6">
      <h3 class="mb-4 text-base font-semibold">Appearance</h3>
      <div class="space-y-1.5">
        <Label for="appearance" class="text-xs font-medium text-muted-foreground">Theme</Label>
        <Select v-model="appearance" @update:model-value="setColorModePreference">
          <SelectTrigger class="w-full sm:w-48">
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
    </div>

    <!-- Password Section -->
    <div class="px-6 pt-6">
      <h3 class="mb-4 text-base font-semibold">Update Password</h3>
      <form class="space-y-4" @submit.prevent="onPasswordSubmit">
        <div class="space-y-1.5">
          <Label for="current_password" class="text-xs font-medium text-muted-foreground">Current Password</Label>
          <Input
            id="current_password"
            v-model="currentPassword"
            type="password"
            class="sm:w-72"
            :class="{ 'border-destructive': passwordErrors.current_password }"
          />
          <p v-if="passwordErrors.current_password" class="text-sm text-destructive">
            {{ passwordErrors.current_password }}
          </p>
        </div>

        <div class="space-y-1.5">
          <Label for="password" class="text-xs font-medium text-muted-foreground">New Password</Label>
          <Input
            id="password"
            v-model="password"
            type="password"
            class="sm:w-72"
            :class="{ 'border-destructive': passwordErrors.password }"
          />
          <p v-if="passwordErrors.password" class="text-sm text-destructive">
            {{ passwordErrors.password }}
          </p>
        </div>

        <div class="space-y-1.5">
          <Label for="password_confirmation" class="text-xs font-medium text-muted-foreground">Confirm Password</Label>
          <Input
            id="password_confirmation"
            v-model="passwordConfirmation"
            type="password"
            class="sm:w-72"
            :class="{ 'border-destructive': passwordErrors.password_confirmation }"
          />
          <p v-if="passwordErrors.password_confirmation" class="text-sm text-destructive">
            {{ passwordErrors.password_confirmation }}
          </p>
        </div>

        <Button :disabled="isPasswordLoading" type="submit" size="sm">
          <Icon
            v-if="isPasswordLoading"
            name="lucide:loader-2"
            class="mr-2 block size-4 animate-spin"
          />
          Update Password
        </Button>
      </form>
    </div>
  </div>
</template>
