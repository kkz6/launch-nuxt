<script setup lang="ts">
import { toast } from 'vue-sonner'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { Label } from '~/components/ui/label'

definePageMeta({
  layout: 'guest',
})

useHead({
  title: 'Two-factor Confirmation',
})

const config = useRuntimeConfig()

const code = ref('')
const recoveryCode = ref('')
const isRecovery = ref(false)
const errors = ref<Record<string, string>>({})
const loading = ref(false)

const handleSubmit = async () => {
  loading.value = true
  errors.value = {}

  try {
    const body = isRecovery.value
      ? { recovery_code: recoveryCode.value }
      : { code: code.value }

    const response = await $fetch<{ token: string; user: import('~/types').User }>(
      '/auth/two-factor-challenge',
      {
        method: 'POST',
        baseURL: config.public.apiBase as string,
        body,
      }
    )

    const { setToken, setUser } = useAuth()
    setToken(response.token)
    setUser(response.user)

    toast.success('Logged in successfully')
    navigateTo('/dashboard')
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'data' in error) {
      const fetchError = error as { data?: { message?: string; errors?: Record<string, string[]> } }
      const key = isRecovery.value ? 'recovery_code' : 'code'
      if (fetchError.data?.errors?.[key]) {
        errors.value = { [key]: fetchError.data.errors[key][0] }
      } else {
        errors.value = { [key]: fetchError.data?.message || 'Invalid code' }
      }
    } else {
      errors.value = { code: 'An error occurred. Please try again.' }
    }
  } finally {
    loading.value = false
  }
}

const toggleRecovery = () => {
  isRecovery.value = !isRecovery.value
  code.value = ''
  recoveryCode.value = ''
  errors.value = {}
}
</script>

<template>
  <div class="flex min-h-screen items-center justify-center">
    <div class="w-full max-w-md px-6">
      <div class="mb-8 flex items-center">
        <NuxtLink to="/" class="text-2xl font-bold">Launch</NuxtLink>
      </div>

      <h3 class="mb-2 text-lg font-semibold text-foreground">Two-factor Confirmation</h3>
      <p class="mb-8 text-sm text-muted-foreground">
        {{
          isRecovery
            ? 'Please confirm access to your account by entering one of your emergency recovery codes.'
            : 'Please confirm access to your account by entering the authentication code provided by your authenticator application.'
        }}
      </p>

      <form class="space-y-4" @submit.prevent="handleSubmit">
        <div v-if="isRecovery" class="space-y-2">
          <Label for="recovery_code">Recovery Code</Label>
          <Input
            id="recovery_code"
            v-model="recoveryCode"
            type="text"
            autocomplete="one-time-code"
            autofocus
            required
          />
          <p v-if="errors.recovery_code" class="text-sm text-destructive">
            {{ errors.recovery_code }}
          </p>
        </div>

        <div v-else class="space-y-2">
          <Label for="code">Code</Label>
          <Input
            id="code"
            v-model="code"
            type="text"
            inputmode="numeric"
            autocomplete="one-time-code"
            autofocus
            required
          />
          <p v-if="errors.code" class="text-sm text-destructive">{{ errors.code }}</p>
        </div>

        <Button type="submit" class="w-full" :disabled="loading">
          <Icon v-if="loading" name="lucide:loader-2" class="mr-2 h-4 w-4 animate-spin" />
          {{ loading ? 'Verifying...' : 'Log in' }}
        </Button>
      </form>

      <div class="mt-6 text-center">
        <button
          type="button"
          class="text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground"
          @click="toggleRecovery"
        >
          {{ isRecovery ? 'Use an authentication code' : 'Use a recovery code' }}
        </button>
      </div>
    </div>
  </div>
</template>
