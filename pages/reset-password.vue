<script setup lang="ts">
import { toast } from 'vue-sonner'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { Label } from '~/components/ui/label'

definePageMeta({
  layout: 'guest',
  middleware: 'guest',
})

useHead({
  title: 'Reset Password',
})

const route = useRoute()
const config = useRuntimeConfig()

const token = computed(() => route.query.token as string || '')
const emailFromQuery = computed(() => route.query.email as string || '')

const email = ref(emailFromQuery.value)
const password = ref('')
const passwordConfirmation = ref('')
const errors = ref<Record<string, string>>({})
const loading = ref(false)

const handleSubmit = async () => {
  loading.value = true
  errors.value = {}

  try {
    await $fetch('/auth/reset-password', {
      method: 'POST',
      baseURL: config.public.apiBase as string,
      body: {
        token: token.value,
        email: email.value,
        password: password.value,
        password_confirmation: passwordConfirmation.value,
      },
    })

    toast.success('Password has been reset successfully')
    navigateTo('/login')
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'data' in error) {
      const fetchError = error as { data?: { message?: string; errors?: Record<string, string[]> } }
      if (fetchError.data?.errors) {
        const errs: Record<string, string> = {}
        Object.entries(fetchError.data.errors).forEach(([key, value]) => {
          errs[key] = Array.isArray(value) ? value[0] : String(value)
        })
        errors.value = errs
      } else {
        errors.value = { password: fetchError.data?.message || 'An error occurred' }
      }
    } else {
      errors.value = { password: 'An error occurred. Please try again.' }
    }
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="flex min-h-screen items-center justify-center">
    <div class="w-full max-w-md px-6">
      <div class="mb-8 flex items-center">
        <NuxtLink to="/" class="text-2xl font-bold">Launch</NuxtLink>
      </div>

      <h3 class="mb-2 text-lg font-semibold text-foreground">Reset Password</h3>
      <p class="mb-8 text-sm text-muted-foreground">
        Enter your new password below to reset your account password.
      </p>

      <form class="space-y-4" @submit.prevent="handleSubmit">
        <div class="space-y-2">
          <Label for="email">Email</Label>
          <Input
            id="email"
            v-model="email"
            type="email"
            autocomplete="email"
            required
          />
          <p v-if="errors.email" class="text-sm text-destructive">{{ errors.email }}</p>
        </div>

        <div class="space-y-2">
          <Label for="password">New Password</Label>
          <Input
            id="password"
            v-model="password"
            type="password"
            autocomplete="new-password"
            required
          />
          <p v-if="errors.password" class="text-sm text-destructive">{{ errors.password }}</p>
        </div>

        <div class="space-y-2">
          <Label for="password_confirmation">Confirm Password</Label>
          <Input
            id="password_confirmation"
            v-model="passwordConfirmation"
            type="password"
            autocomplete="new-password"
            required
          />
          <p v-if="errors.password_confirmation" class="text-sm text-destructive">
            {{ errors.password_confirmation }}
          </p>
        </div>

        <Button type="submit" class="w-full" :disabled="loading">
          <Icon v-if="loading" name="lucide:loader-2" class="mr-2 h-4 w-4 animate-spin" />
          {{ loading ? 'Resetting...' : 'Reset Password' }}
        </Button>
      </form>
    </div>
  </div>
</template>
