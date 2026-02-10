<script setup lang="ts">
import { toast } from 'vue-sonner'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { Label } from '~/components/ui/label'
import { PinInput, PinInputGroup, PinInputSeparator, PinInputSlot } from '~/components/ui/pin-input'
import { authService } from '~/services/authService'

definePageMeta({
  layout: 'guest',
})

useHead({
  title: 'Two-factor Confirmation',
})

const otpDigits = ref<number[]>([])
const recoveryCode = ref('')
const isRecovery = ref(false)
const errors = ref<Record<string, string>>({})
const loading = ref(false)

const { setTokens, setCurrentTeamId } = useApi()
const { isInitialized } = useAuth()
const user = useState<import('~/types').User | null>('auth_user', () => null)

// Get the challenge token from sessionStorage
const challengeToken = ref('')

onMounted(() => {
  challengeToken.value = sessionStorage.getItem('2fa_challenge_token') || ''
  if (!challengeToken.value) {
    navigateTo('/login')
  }
})

const handleSubmit = async (codeValue?: string) => {
  if (!challengeToken.value) {
    navigateTo('/login')
    return
  }

  const code = codeValue ?? otpDigits.value.join('')

  if (!isRecovery.value && code.length !== 6) {
    return
  }

  loading.value = true
  errors.value = {}

  try {
    const body = isRecovery.value
      ? { challenge_token: challengeToken.value, recovery_code: recoveryCode.value }
      : { challenge_token: challengeToken.value, code }

    const response = await authService.twoFactor.challenge(body)

    // Store tokens from the response
    setTokens(response.data.access_token, response.data.refresh_token)

    // Set user state
    user.value = response.data.user
    isInitialized.value = true

    if (response.data.user.current_team_id) {
      setCurrentTeamId(response.data.user.current_team_id)
    }

    // Clean up the challenge token
    sessionStorage.removeItem('2fa_challenge_token')

    toast.success('Signed in successfully')
    navigateTo(response.data.user.onboarded ? '/dashboard' : '/onboarding')
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'data' in error) {
      const fetchError = error as {
        data?: { message?: string; errors?: Record<string, string[]> }
      }
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

const onOtpComplete = (digits: number[]) => {
  handleSubmit(digits.join(''))
}

const toggleRecovery = () => {
  isRecovery.value = !isRecovery.value
  otpDigits.value = [] as number[]
  recoveryCode.value = ''
  errors.value = {}
}
</script>

<template>
  <div>
    <div class="mb-8 flex items-center">
      <NuxtLink to="/" class="text-2xl font-bold">launchctl</NuxtLink>
    </div>

    <h3 class="mb-2 text-lg font-semibold text-foreground">
      Two-factor Confirmation
    </h3>
    <p class="mb-8 text-sm text-muted-foreground">
      {{
        isRecovery
          ? 'Please confirm access to your account by entering one of your emergency recovery codes.'
          : 'Please confirm access to your account by entering the authentication code provided by your authenticator application.'
      }}
    </p>

    <form class="space-y-6" @submit.prevent="handleSubmit()">
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
        <Label>Authentication Code</Label>
        <div class="flex justify-center">
          <PinInput
            v-model="otpDigits"
            type="number"
            :length="6"
            autofocus
            @complete="onOtpComplete"
          >
            <PinInputGroup>
              <PinInputSlot v-for="(_, index) in 3" :key="index" :index="index" />
            </PinInputGroup>
            <PinInputSeparator />
            <PinInputGroup>
              <PinInputSlot v-for="(_, index) in 3" :key="index + 3" :index="index + 3" />
            </PinInputGroup>
          </PinInput>
        </div>
        <p v-if="errors.code" class="text-sm text-center text-destructive">
          {{ errors.code }}
        </p>
      </div>

      <Button type="submit" class="w-full" :disabled="loading">
        <Icon
          v-if="loading"
          name="lucide:loader-2"
          class="mr-2 h-4 w-4 animate-spin"
        />
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
</template>
