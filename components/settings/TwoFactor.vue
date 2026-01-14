<script setup lang="ts">
import { toast } from 'vue-sonner'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { Label } from '~/components/ui/label'

const { user } = useAuth()

const isLoading = ref(false)
const enabling = ref(false)
const confirming = ref(false)
const disabling = ref(false)
const qrCode = ref<string | null>(null)
const setupKey = ref<string | null>(null)
const recoveryCodes = ref<string[]>([])
const showingRecoveryCodes = ref(false)
const otpCode = ref('')
const confirmationDialog = ref<InstanceType<typeof import('~/components/shared/ConfirmationDialog.vue').default> | null>(null)

const twoFactorEnabled = computed(() => {
  return !enabling.value && user.value?.two_factor_enabled
})

const showQrCode = async () => {
  try {
    const response = await $api<{ svg: string }>('/user/two-factor-qr-code')
    qrCode.value = response.svg
  } catch {
    toast.error('Failed to load QR code')
  }
}

const showSetupKey = async () => {
  try {
    const response = await $api<{ secretKey: string }>('/user/two-factor-secret-key')
    setupKey.value = response.secretKey
  } catch {
    toast.error('Failed to load setup key')
  }
}

const toggleRecoveryCodes = async () => {
  if (showingRecoveryCodes.value) {
    showingRecoveryCodes.value = false
    recoveryCodes.value = []
  } else {
    try {
      const response = await $api<string[]>('/user/two-factor-recovery-codes')
      recoveryCodes.value = response
      showingRecoveryCodes.value = true
    } catch {
      toast.error('Failed to load recovery codes')
    }
  }
}

const enableTwoFactorAuthentication = async () => {
  if (!confirmationDialog.value) return

  const result = await confirmationDialog.value.show({
    title: 'Enable Two-Factor Authentication',
    description: 'Please confirm your password to enable two-factor authentication.',
    confirmText: 'Enable',
    cancelText: 'Cancel',
    hasInput: true,
    helpText: 'Enter your password:',
  })

  if (!result.ok) return

  enabling.value = true
  try {
    await $api('/user/two-factor-authentication', {
      method: 'POST',
      body: { password: result.value },
    })
    await Promise.all([showQrCode(), showSetupKey()])
    confirming.value = true
  } catch (error: unknown) {
    const err = error as { data?: { message?: string } }
    toast.error(err.data?.message || 'Failed to enable two-factor authentication')
  } finally {
    enabling.value = false
  }
}

const confirmTwoFactorAuthentication = async () => {
  if (!otpCode.value || otpCode.value.length !== 6) {
    toast.error('Please enter a valid 6-digit code')
    return
  }

  isLoading.value = true
  try {
    await $api('/user/confirmed-two-factor-authentication', {
      method: 'POST',
      body: { code: otpCode.value },
    })
    toast.success('Two-factor authentication enabled successfully')
    confirming.value = false
    qrCode.value = null
    setupKey.value = null
    otpCode.value = ''
    window.location.reload()
  } catch (error: unknown) {
    const err = error as { data?: { message?: string } }
    toast.error(err.data?.message || 'Invalid code. Please try again.')
  } finally {
    isLoading.value = false
  }
}

const regenerateRecoveryCodes = async () => {
  if (!confirmationDialog.value) return

  const result = await confirmationDialog.value.show({
    title: 'Regenerate Recovery Codes',
    description: 'Please confirm your password to regenerate recovery codes.',
    confirmText: 'Regenerate',
    cancelText: 'Cancel',
    hasInput: true,
    helpText: 'Enter your password:',
  })

  if (!result.ok) return

  isLoading.value = true
  try {
    await $api('/user/two-factor-recovery-codes', {
      method: 'POST',
      body: { password: result.value },
    })
    if (showingRecoveryCodes.value) {
      const response = await $api<string[]>('/user/two-factor-recovery-codes')
      recoveryCodes.value = response
    }
    toast.success('Recovery codes regenerated successfully')
  } catch (error: unknown) {
    const err = error as { data?: { message?: string } }
    toast.error(err.data?.message || 'Failed to regenerate recovery codes')
  } finally {
    isLoading.value = false
  }
}

const disableTwoFactorAuthentication = async () => {
  if (!confirmationDialog.value) return

  const result = await confirmationDialog.value.show({
    title: 'Disable Two-Factor Authentication',
    description: 'Please confirm your password to disable two-factor authentication.',
    confirmText: 'Disable',
    cancelText: 'Cancel',
    destructive: true,
    hasInput: true,
    helpText: 'Enter your password:',
  })

  if (!result.ok) return

  disabling.value = true
  try {
    await $api('/user/two-factor-authentication', {
      method: 'DELETE',
      body: { password: result.value },
    })
    toast.success('Two-factor authentication disabled')
    confirming.value = false
    recoveryCodes.value = []
    showingRecoveryCodes.value = false
    window.location.reload()
  } catch (error: unknown) {
    const err = error as { data?: { message?: string } }
    toast.error(err.data?.message || 'Failed to disable two-factor authentication')
  } finally {
    disabling.value = false
  }
}
</script>

<template>
  <div class="space-y-4">
    <SharedConfirmationDialog ref="confirmationDialog" />

    <p class="text-sm text-muted-foreground">
      Add additional security using two-factor authentication with an authenticator app.
    </p>

    <div class="text-sm">
      <template v-if="twoFactorEnabled && !confirming">
        <span class="font-medium text-green-600 dark:text-green-400">Two-factor authentication is enabled.</span>
      </template>
      <template v-else-if="confirming">
        <span class="font-medium text-amber-600 dark:text-amber-400">Finish enabling two-factor authentication.</span>
      </template>
      <template v-else>
        <span class="text-muted-foreground">Two-factor authentication is not enabled.</span>
      </template>
    </div>

    <div v-if="twoFactorEnabled || confirming">
      <div v-if="qrCode" class="space-y-4">
        <p class="text-sm text-muted-foreground">
          Scan this QR code with your authenticator app or enter the setup key manually.
        </p>

        <div class="flex flex-col items-start gap-4">
          <!-- eslint-disable-next-line vue/no-v-html -->
          <div
            class="w-fit max-w-[160px] rounded-lg bg-white p-2 [&>svg]:h-auto [&>svg]:max-w-[140px] [&>svg]:w-full"
            v-html="qrCode"
          />
          <span v-if="setupKey" class="text-sm text-muted-foreground">
            Setup Key: <code class="rounded bg-muted px-1 py-0.5 font-mono text-xs">{{ setupKey }}</code>
          </span>
        </div>

        <div class="max-w-xs space-y-2">
          <Label for="otp-code">Verification Code</Label>
          <Input
            id="otp-code"
            v-model="otpCode"
            type="text"
            inputmode="numeric"
            pattern="[0-9]*"
            maxlength="6"
            placeholder="Enter 6-digit code"
            class="font-mono"
          />
        </div>
      </div>

      <div v-if="recoveryCodes.length > 0 && !confirming && showingRecoveryCodes" class="mt-4 space-y-2">
        <p class="text-sm text-muted-foreground">
          Store these recovery codes securely. They can recover your account if you lose access.
        </p>
        <div class="grid gap-1 rounded-lg bg-muted px-3 py-3 font-mono text-xs">
          <div v-for="code in recoveryCodes" :key="code">
            {{ code }}
          </div>
        </div>
      </div>
    </div>

    <div class="flex flex-wrap gap-2">
      <template v-if="!twoFactorEnabled && !confirming">
        <Button type="button" size="sm" :disabled="enabling" @click="enableTwoFactorAuthentication">
          <Icon v-if="enabling" name="lucide:loader-2" class="mr-1 block size-4 animate-spin" />
          Enable
        </Button>
      </template>
      <template v-else-if="confirming">
        <Button type="button" size="sm" :disabled="isLoading" @click="confirmTwoFactorAuthentication">
          <Icon v-if="isLoading" name="lucide:loader-2" class="mr-1 block size-4 animate-spin" />
          Confirm
        </Button>
      </template>
      <template v-else>
        <Button type="button" variant="destructive" size="sm" :disabled="disabling" @click="disableTwoFactorAuthentication">
          <Icon v-if="disabling" name="lucide:loader-2" class="mr-1 block size-4 animate-spin" />
          Disable
        </Button>
        <Button type="button" variant="outline" size="sm" :disabled="isLoading" @click="regenerateRecoveryCodes">
          Regenerate Codes
        </Button>
        <Button type="button" variant="outline" size="sm" @click="toggleRecoveryCodes">
          {{ showingRecoveryCodes ? 'Hide Codes' : 'Show Codes' }}
        </Button>
      </template>
    </div>
  </div>
</template>
