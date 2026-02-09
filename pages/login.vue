<script setup lang="ts">
import { toast } from 'vue-sonner'
import { AnimatePresence, Motion } from 'motion-v'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { Label } from '~/components/ui/label'
import { Checkbox } from '~/components/ui/checkbox'
import { Separator } from '~/components/ui/separator'

definePageMeta({
  layout: 'guest',
  middleware: 'guest',
})

useHead({
  title: 'Sign in',
})

const email = ref('')
const password = ref('')
const remember = ref(false)
const passwordInputRef = ref<{ $el: HTMLInputElement } | null>(null)
const errors = ref<Record<string, string>>({})
const loading = ref(false)
const showPasswordField = ref(false)
const emailSubmitted = ref(false)
const userHasPasskeys = ref(false)
const showPasskeyOption = ref(false)
const passkeyLoading = ref(false)

const handleEmailSubmit = async () => {
  if (!email.value) return

  loading.value = true
  errors.value = {}

  try {
    const status = await checkUserStatus(email.value)

    if (!status.user_exists) {
      errors.value = { email: 'No account found with this email address.' }
      return
    }

    userHasPasskeys.value = status.has_two_factor
    showPasskeyOption.value = status.has_two_factor
    emailSubmitted.value = true
    showPasswordField.value = true
  } catch {
    errors.value = { email: 'An error occurred. Please try again.' }
  } finally {
    loading.value = false
  }
}

const { login, checkUserStatus, isLoading: authLoading, user } = useAuth()

const handlePasswordSubmit = async () => {
  loading.value = true
  errors.value = {}

  try {
    await login({ email: email.value, password: password.value })
    toast.success('Signed in successfully')

    // Redirect to onboarding if user hasn't completed it, otherwise dashboard
    if (!user.value?.onboarded) {
      navigateTo('/onboarding')
    } else {
      navigateTo('/dashboard')
    }
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'data' in error) {
      const fetchError = error as { data?: { message?: string; errors?: Record<string, string[]> } }
      if (fetchError.data?.errors) {
        const firstError = Object.values(fetchError.data.errors)[0]
        errors.value = { password: Array.isArray(firstError) ? firstError[0] : String(firstError) }
      } else {
        errors.value = { password: fetchError.data?.message || 'Invalid credentials' }
      }
    } else {
      errors.value = { password: 'An error occurred during login' }
    }
  } finally {
    loading.value = false
  }
}

const handleChangeEmail = () => {
  emailSubmitted.value = false
  showPasswordField.value = false
  password.value = ''
  userHasPasskeys.value = false
  showPasskeyOption.value = false
  errors.value = {}
}

const handlePasskeyLogin = async () => {
  passkeyLoading.value = true
  // TODO: Implement passkey authentication
  toast.info('Passkey authentication coming soon')
  passkeyLoading.value = false
}

// Focus password input when it appears
watch(showPasswordField, (show) => {
  if (show) {
    // Wait for animation to complete before focusing
    setTimeout(() => {
      passwordInputRef.value?.$el?.focus()
    }, 250)
  }
})
</script>

<template>
  <div>
    <div class="mb-8 flex items-center">
      <NuxtLink to="/" class="text-2xl font-bold">launchctl</NuxtLink>
    </div>

    <h3 class="mb-2 text-lg font-semibold text-foreground">Sign in to your account</h3>
    <p class="mb-8 text-sm text-muted-foreground">
      Don't have an account?
      <NuxtLink to="/register" class="font-medium text-primary hover:text-primary/90">
        Sign up
      </NuxtLink>
    </p>

    <ClientOnly>
      <AnimatePresence mode="wait">
        <!-- Email Form -->
        <Motion
          v-if="!showPasswordField"
          key="email-form"
          class="space-y-4"
          :initial="{ opacity: 0, x: -20 }"
          :animate="{ opacity: 1, x: 0 }"
          :exit="{ opacity: 0, x: -20 }"
          :transition="{ duration: 0.2, ease: 'easeOut' }"
        >
          <form class="space-y-4" @submit.prevent="handleEmailSubmit">
            <div class="space-y-2">
              <Label for="email">Email</Label>
              <Input
                id="email"
                v-model="email"
                type="email"
                placeholder="m@example.com"
                autofocus
                required
              />
              <p v-if="errors.email" class="text-sm text-destructive">{{ errors.email }}</p>
            </div>
            <Button type="submit" class="w-full" :disabled="loading || !email">
              <Icon v-if="loading" name="lucide:loader-2" class="mr-2 h-4 w-4 animate-spin" />
              {{ loading ? 'Checking...' : 'Continue' }}
            </Button>
          </form>
        </Motion>

        <!-- Password Form -->
        <Motion
          v-else
          key="password-form"
          class="space-y-4"
          :initial="{ opacity: 0, x: 20 }"
          :animate="{ opacity: 1, x: 0 }"
          :exit="{ opacity: 0, x: 20 }"
          :transition="{ duration: 0.2, ease: 'easeOut' }"
        >
          <Motion
            class="flex items-center justify-between"
            :initial="{ opacity: 0, y: -10 }"
            :animate="{ opacity: 1, y: 0 }"
            :transition="{ duration: 0.2, delay: 0.1 }"
          >
            <div class="flex-1">
              <p class="text-sm text-muted-foreground">Signing in as</p>
              <p class="font-medium">{{ email }}</p>
            </div>
            <Button type="button" variant="ghost" size="sm" @click="handleChangeEmail">
              Change
            </Button>
          </Motion>

          <!-- Passkey Option -->
          <Motion
            v-if="showPasskeyOption && userHasPasskeys"
            :initial="{ opacity: 0, y: 10 }"
            :animate="{ opacity: 1, y: 0 }"
            :transition="{ duration: 0.2, delay: 0.15 }"
          >
            <Button
              type="button"
              variant="outline"
              class="w-full"
              :disabled="passkeyLoading || loading"
              @click="handlePasskeyLogin"
            >
              <Icon v-if="passkeyLoading" name="lucide:loader-2" class="mr-2 h-4 w-4 animate-spin" />
              <Icon v-else name="lucide:fingerprint" class="mr-2 h-4 w-4" />
              {{ passkeyLoading ? 'Authenticating...' : 'Sign in with Passkey' }}
            </Button>
            <div class="relative my-6">
              <div class="absolute inset-0 flex items-center">
                <Separator class="w-full" />
              </div>
              <div class="relative flex justify-center text-xs uppercase">
                <span class="bg-background px-2 text-muted-foreground">Or use password</span>
              </div>
            </div>
          </Motion>

          <Motion
            :initial="{ opacity: 0, y: 10 }"
            :animate="{ opacity: 1, y: 0 }"
            :transition="{ duration: 0.2, delay: 0.2 }"
          >
            <form class="space-y-4" @submit.prevent="handlePasswordSubmit">
              <div class="space-y-2">
                <Label for="password">Password</Label>
                <Input
                  id="password"
                  ref="passwordInputRef"
                  v-model="password"
                  type="password"
                  required
                />
                <p v-if="errors.password" class="text-sm text-destructive">{{ errors.password }}</p>
              </div>

              <div class="flex items-center space-x-2">
                <Checkbox id="remember" v-model="remember" />
                <Label for="remember" class="text-sm font-normal">Remember me</Label>
              </div>

              <Button type="submit" class="w-full" :disabled="loading || authLoading">
                <Icon v-if="loading || authLoading" name="lucide:loader-2" class="mr-2 h-4 w-4 animate-spin" />
                {{ loading || authLoading ? 'Signing in...' : 'Sign in' }}
              </Button>
            </form>
          </Motion>
        </Motion>
      </AnimatePresence>

      <!-- SSR Fallback -->
      <template #fallback>
        <form class="space-y-4" @submit.prevent="handleEmailSubmit">
          <div class="space-y-2">
            <Label for="email">Email</Label>
            <Input
              id="email"
              v-model="email"
              type="email"
              placeholder="m@example.com"
              autofocus
              required
            />
            <p v-if="errors.email" class="text-sm text-destructive">{{ errors.email }}</p>
          </div>
          <Button type="submit" class="w-full" :disabled="loading || !email">
            <Icon v-if="loading" name="lucide:loader-2" class="mr-2 h-4 w-4 animate-spin" />
            {{ loading ? 'Checking...' : 'Continue' }}
          </Button>
        </form>
      </template>
    </ClientOnly>

    <p class="mt-6 text-sm text-muted-foreground">
      Forgot your password?
      <NuxtLink to="/forgot-password" class="font-medium text-primary hover:text-primary/90">
        Reset password
      </NuxtLink>
    </p>
  </div>
</template>
