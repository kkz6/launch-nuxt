<script setup lang="ts">
import { toast } from 'vue-sonner'
import { Button } from '~/components/ui/button'
import { Badge } from '~/components/ui/badge'
import { Input } from '~/components/ui/input'
import { Label } from '~/components/ui/label'
import { PinInput, PinInputGroup, PinInputSeparator, PinInputSlot } from '~/components/ui/pin-input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '~/components/ui/dialog'
import type { PersonalAccessToken, PersonalAccessTokenCreated } from '~/types'

const { user } = useAuth()

const tokens = ref<PersonalAccessToken[]>([])
const isLoading = ref(false)
const isCreateDialogOpen = ref(false)
const tokenName = ref('')
const twoFactorCode = ref<number[]>([])
const twoFactorError = ref('')
const createdToken = ref<PersonalAccessTokenCreated | null>(null)
const copied = ref(false)
const confirmationDialog = ref<InstanceType<typeof import('~/components/shared/ConfirmationDialog.vue').default> | null>(null)

const hasTwoFactor = computed(() => user.value?.two_factor_enabled)

const fetchTokens = async () => {
  isLoading.value = true
  try {
    const response = await $api<{ data: PersonalAccessToken[] }>('/user/tokens')
    tokens.value = response.data || []
  } catch {
    toast.error('Failed to load tokens')
  } finally {
    isLoading.value = false
  }
}

const createToken = async (codeValue?: string) => {
  if (!tokenName.value.trim()) {
    toast.error('Please enter a token name')
    return
  }

  const code = codeValue ?? twoFactorCode.value.join('')

  if (hasTwoFactor.value && code.length !== 6) {
    return
  }

  isLoading.value = true
  twoFactorError.value = ''
  try {
    const body: Record<string, string> = { name: tokenName.value }
    if (hasTwoFactor.value) {
      body.code = code
    }

    const response = await $api<{ data: PersonalAccessTokenCreated }>('/user/tokens', {
      method: 'POST',
      body,
    })
    createdToken.value = response.data
    tokenName.value = ''
    twoFactorCode.value = []
    isCreateDialogOpen.value = false
    await fetchTokens()
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'data' in error) {
      const fetchError = error as { data?: { errors?: Record<string, string[]> } }
      if (fetchError.data?.errors?.code) {
        twoFactorError.value = fetchError.data.errors.code[0]
        return
      }
    }
    toast.error('Failed to create token')
  } finally {
    isLoading.value = false
  }
}

const copyToken = async () => {
  if (!createdToken.value) return
  try {
    await navigator.clipboard.writeText(createdToken.value.plain_text_token)
    copied.value = true
    toast.success('Token copied to clipboard')
    setTimeout(() => { copied.value = false }, 2000)
  } catch {
    toast.error('Failed to copy token')
  }
}

const closeCreatedDialog = () => {
  createdToken.value = null
  copied.value = false
}

const revokeToken = async (id: string, name: string) => {
  if (!confirmationDialog.value) return

  const result = await confirmationDialog.value.show({
    title: 'Revoke Token',
    description: `Are you sure you want to revoke "${name}"? Any applications using this token will lose access immediately.`,
    confirmText: 'Revoke',
    cancelText: 'Cancel',
    destructive: true,
  })

  if (!result.ok) return

  try {
    await $api(`/user/tokens/${id}`, { method: 'DELETE' })
    toast.success('Token revoked')
    await fetchTokens()
  } catch {
    toast.error('Failed to revoke token')
  }
}

const formatDate = (dateStr: string | null) => {
  if (!dateStr) return 'Never'
  const date = new Date(dateStr)
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

const formatLastUsed = (dateStr: string | null) => {
  if (!dateStr) return 'Never used'
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
  return formatDate(dateStr)
}

onMounted(fetchTokens)
</script>

<template>
  <div class="space-y-4">
    <SharedConfirmationDialog ref="confirmationDialog" />

    <!-- Token Created Dialog -->
    <Dialog :open="!!createdToken" @update:open="closeCreatedDialog">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Token Created</DialogTitle>
          <DialogDescription>
            Copy your token now. You won't be able to see it again.
          </DialogDescription>
        </DialogHeader>
        <div v-if="createdToken" class="space-y-3">
          <div class="flex items-center gap-2">
            <code class="min-w-0 flex-1 break-all rounded-md border bg-muted px-3 py-2 text-sm">
              {{ createdToken.plain_text_token }}
            </code>
            <Button variant="outline" size="sm" @click="copyToken">
              <Icon :name="copied ? 'lucide:check' : 'lucide:copy'" class="block size-4" />
            </Button>
          </div>
          <div class="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-200">
            Make sure to store this token securely. It will not be shown again.
          </div>
        </div>
        <DialogFooter>
          <Button @click="closeCreatedDialog">
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- Create Token -->
    <div class="flex items-center justify-between">
      <div class="text-sm text-muted-foreground">
        {{ tokens.length === 0 ? 'No tokens created' : `${tokens.length} token${tokens.length === 1 ? '' : 's'}` }}
      </div>
      <Dialog v-model:open="isCreateDialogOpen" @update:open="(open: boolean) => { if (!open) { twoFactorCode = []; twoFactorError = '' } }">
        <DialogTrigger as-child>
          <Button size="sm" :disabled="isLoading">
            <Icon name="lucide:plus" class="mr-1 block size-4" />
            Create Token
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Personal Access Token</DialogTitle>
            <DialogDescription>
              Tokens are used to authenticate CLI tools and API integrations.
            </DialogDescription>
          </DialogHeader>
          <form class="space-y-4" @submit.prevent="createToken()">
            <div class="space-y-2">
              <Label for="token-name">Token Name</Label>
              <Input
                id="token-name"
                v-model="tokenName"
                placeholder="e.g., CI/CD Pipeline, CLI"
                autofocus
              />
            </div>
            <div v-if="hasTwoFactor" class="space-y-2">
              <Label>Authentication Code</Label>
              <div class="flex justify-center">
                <PinInput
                  v-model="twoFactorCode"
                  type="number"
                  :length="6"
                  @complete="(digits: number[]) => createToken(digits.join(''))"
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
              <p v-if="twoFactorError" class="text-center text-sm text-destructive">
                {{ twoFactorError }}
              </p>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" @click="isCreateDialogOpen = false">
                Cancel
              </Button>
              <Button type="submit" :disabled="isLoading || !tokenName.trim()">
                <Icon v-if="isLoading" name="lucide:loader-2" class="mr-2 block size-4 animate-spin" />
                Create Token
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>

    <!-- Token List -->
    <div v-if="isLoading && tokens.length === 0" class="py-4 text-center text-sm text-muted-foreground">
      Loading tokens...
    </div>

    <div v-else-if="tokens.length > 0" class="space-y-3">
      <div
        v-for="token in tokens"
        :key="token.id"
        class="flex items-center justify-between rounded-lg border p-3"
      >
        <div class="flex items-center gap-3">
          <Icon name="lucide:key" class="block size-4 text-muted-foreground" />
          <div>
            <div class="text-sm font-medium">{{ token.name }}</div>
            <div class="text-xs text-muted-foreground">
              Created {{ formatDate(token.created_at) }}
              <template v-if="token.last_used_at">
                &middot; Last used {{ formatLastUsed(token.last_used_at) }}
              </template>
              <template v-else>
                &middot; Never used
              </template>
            </div>
          </div>
        </div>

        <div class="flex items-center gap-2">
          <Badge v-if="token.expires_at" variant="outline" class="text-xs">
            Expires {{ formatDate(token.expires_at) }}
          </Badge>
          <Button
            variant="ghost"
            size="sm"
            class="text-destructive hover:text-destructive"
            @click="revokeToken(token.id, token.name)"
          >
            Revoke
          </Button>
        </div>
      </div>
    </div>

    <div v-else class="py-4 text-center text-muted-foreground">
      <Icon name="lucide:key" class="mx-auto mb-2 block size-8 opacity-50" />
      <p class="text-sm">Create a token to authenticate CLI tools and API integrations.</p>
    </div>
  </div>
</template>
