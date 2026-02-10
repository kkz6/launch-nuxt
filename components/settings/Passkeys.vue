<script setup lang="ts">
import { toast } from 'vue-sonner'
import { base64UrlToArrayBuffer, arrayBufferToBase64Url } from '~/utils/webauthn'
import { Button } from '~/components/ui/button'
import { Badge } from '~/components/ui/badge'
import { Input } from '~/components/ui/input'
import { Label } from '~/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '~/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '~/components/ui/dropdown-menu'

interface Passkey {
  id: string
  name: string
  created_at: string
  last_used_at: string | null
}

const passkeys = ref<Passkey[]>([])
const isLoading = ref(false)
const error = ref<string | null>(null)
const isAddDialogOpen = ref(false)
const editingPasskey = ref<string | null>(null)
const passkeyName = ref('')
const editName = ref('')
const confirmationDialog = ref<InstanceType<typeof import('~/components/shared/ConfirmationDialog.vue').default> | null>(null)

const canUsePasskeys = computed(() => {
  if (typeof window === 'undefined') return false
  return window.PublicKeyCredential !== undefined && window.isSecureContext
})

const fetchPasskeys = async () => {
  if (!canUsePasskeys.value) return

  isLoading.value = true
  try {
    const response = await $api<{ data: Passkey[] }>('/user/passkeys')
    passkeys.value = response.data || []
  } catch {
    error.value = 'Failed to load passkeys'
  } finally {
    isLoading.value = false
  }
}

const registerPasskey = async () => {
  if (!canUsePasskeys.value) return

  isLoading.value = true
  error.value = null

  try {
    const optionsResponse = await $api<{ publicKey: PublicKeyCredentialCreationOptions }>('/user/passkeys/register/options', {
      method: 'POST',
      body: { name: passkeyName.value || 'My Passkey' },
    })

    const options = optionsResponse.publicKey

    options.challenge = base64UrlToArrayBuffer(options.challenge as unknown as string)
    options.user.id = base64UrlToArrayBuffer(options.user.id as unknown as string)
    if (options.excludeCredentials) {
      options.excludeCredentials = options.excludeCredentials.map((cred) => ({
        ...cred,
        id: base64UrlToArrayBuffer(cred.id as unknown as string),
      }))
    }

    const credential = await navigator.credentials.create({
      publicKey: options,
    }) as PublicKeyCredential

    if (!credential) {
      throw new Error('Failed to create credential')
    }

    const response = credential.response as AuthenticatorAttestationResponse

    await $api('/user/passkeys/register', {
      method: 'POST',
      body: {
        name: passkeyName.value || 'My Passkey',
        id: credential.id,
        rawId: arrayBufferToBase64Url(credential.rawId),
        type: credential.type,
        response: {
          clientDataJSON: arrayBufferToBase64Url(response.clientDataJSON),
          attestationObject: arrayBufferToBase64Url(response.attestationObject),
        },
      },
    })

    toast.success('Passkey registered successfully')
    isAddDialogOpen.value = false
    passkeyName.value = ''
    await fetchPasskeys()
  } catch (err: unknown) {
    const e = err as { name?: string; message?: string }
    if (e.name === 'NotAllowedError') {
      error.value = 'Registration was cancelled or not allowed'
    } else {
      error.value = e.message || 'Failed to register passkey'
    }
    toast.error(error.value)
  } finally {
    isLoading.value = false
  }
}

const updatePasskeyName = async (id: string) => {
  isLoading.value = true
  try {
    await $api(`/user/passkeys/${id}`, {
      method: 'PATCH',
      body: { name: editName.value },
    })
    toast.success('Passkey renamed successfully')
    editingPasskey.value = null
    editName.value = ''
    await fetchPasskeys()
  } catch {
    toast.error('Failed to rename passkey')
  } finally {
    isLoading.value = false
  }
}

const deletePasskey = async (id: string) => {
  if (!confirmationDialog.value) return

  const result = await confirmationDialog.value.show({
    title: 'Delete Passkey',
    description: 'Are you sure you want to delete this passkey? This action cannot be undone.',
    confirmText: 'Delete',
    cancelText: 'Cancel',
    destructive: true,
  })

  if (!result.ok) return

  isLoading.value = true
  try {
    await $api(`/user/passkeys/${id}`, {
      method: 'DELETE',
    })
    toast.success('Passkey deleted successfully')
    await fetchPasskeys()
  } catch {
    toast.error('Failed to delete passkey')
  } finally {
    isLoading.value = false
  }
}

const startEditing = (passkey: Passkey) => {
  editingPasskey.value = passkey.id
  editName.value = passkey.name
}

const cancelEditing = () => {
  editingPasskey.value = null
  editName.value = ''
}


onMounted(fetchPasskeys)
</script>

<template>
  <div class="space-y-4">
    <SharedConfirmationDialog ref="confirmationDialog" />

    <p v-if="canUsePasskeys" class="text-sm text-muted-foreground">
      Use passkeys for secure, passwordless sign in with Face ID, Touch ID, or Windows Hello.
    </p>
    <p v-else class="text-sm text-muted-foreground">
      Passkeys are not supported in this browser. Use a modern browser with HTTPS.
    </p>

    <template v-if="canUsePasskeys">
      <div v-if="error" class="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
        {{ error }}
      </div>

      <div class="flex items-center justify-between">
        <div class="text-sm text-muted-foreground">
          {{ passkeys.length === 0 ? 'No passkeys configured' : `${passkeys.length} passkey${passkeys.length === 1 ? '' : 's'} configured` }}
        </div>
        <Dialog v-model:open="isAddDialogOpen">
          <DialogTrigger as-child>
            <Button size="sm" :disabled="isLoading">
              <Icon name="lucide:plus" class="mr-1 block size-4" />
              Add Passkey
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Passkey</DialogTitle>
              <DialogDescription>
                Give your passkey a name to help you identify it later.
              </DialogDescription>
            </DialogHeader>
            <form class="space-y-4" @submit.prevent="registerPasskey">
              <div class="space-y-2">
                <Label for="passkey-name">Passkey Name</Label>
                <Input
                  id="passkey-name"
                  v-model="passkeyName"
                  placeholder="e.g., My iPhone, Work Laptop"
                />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" @click="isAddDialogOpen = false">
                  Cancel
                </Button>
                <Button type="submit" :disabled="isLoading">
                  <Icon v-if="isLoading" name="lucide:loader-2" class="mr-2 block size-4 animate-spin" />
                  Create Passkey
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div v-if="passkeys.length > 0" class="space-y-3">
        <div
          v-for="passkey in passkeys"
          :key="passkey.id"
          class="flex items-center justify-between rounded-lg border p-3"
        >
          <div class="flex items-center gap-3">
            <Icon name="lucide:smartphone" class="block size-4 text-muted-foreground" />
            <div>
              <template v-if="editingPasskey === passkey.id">
                <form class="flex items-center gap-2" @submit.prevent="updatePasskeyName(passkey.id)">
                  <Input v-model="editName" class="h-8 w-40" autofocus />
                  <Button type="submit" size="sm" :disabled="isLoading">Save</Button>
                  <Button type="button" variant="outline" size="sm" @click="cancelEditing">Cancel</Button>
                </form>
              </template>
              <template v-else>
                <div class="text-sm font-medium">{{ passkey.name }}</div>
                <div class="text-xs text-muted-foreground">
                  Created {{ passkey.created_at }}
                </div>
              </template>
            </div>
          </div>

          <div v-if="editingPasskey !== passkey.id" class="flex items-center gap-2">
            <Badge variant="secondary" class="text-xs">Active</Badge>
            <DropdownMenu>
              <DropdownMenuTrigger as-child>
                <Button variant="ghost" size="sm">
                  <Icon name="lucide:more-horizontal" class="block size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem @click="startEditing(passkey)">
                  <Icon name="lucide:edit" class="mr-2 block size-4" />
                  Rename
                </DropdownMenuItem>
                <DropdownMenuItem class="text-destructive" @click="deletePasskey(passkey.id)">
                  <Icon name="lucide:trash-2" class="mr-2 block size-4" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      <div v-else class="py-4 text-center text-muted-foreground">
        <Icon name="lucide:fingerprint" class="mx-auto mb-2 block size-8 opacity-50" />
        <p class="text-sm">Add a passkey for passwordless authentication.</p>
      </div>
    </template>
  </div>
</template>
