<script setup lang="ts">
import { toast } from 'vue-sonner'
import { Button } from '~/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '~/components/ui/dialog'
import { Input } from '~/components/ui/input'
import { Label } from '~/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select'

const emit = defineEmits<{
  created: []
}>()

const open = ref(false)
const isLoading = ref(false)
const provider = ref('')
const label = ref('')
const credentials = ref({
  api_token: '',
  access_key: '',
  secret_key: '',
})
const errors = ref<Record<string, string>>({})

const providers = [
  { value: 'cloudflare', label: 'Cloudflare', icon: 'simple-icons:cloudflare' },
  { value: 'route53', label: 'Amazon Route 53', icon: 'simple-icons:amazonaws' },
  { value: 'digitalocean', label: 'DigitalOcean DNS', icon: 'simple-icons:digitalocean' },
]

const needsApiToken = computed(() => ['cloudflare', 'digitalocean'].includes(provider.value))
const needsAwsCredentials = computed(() => provider.value === 'route53')

const resetForm = () => {
  provider.value = ''
  label.value = ''
  credentials.value = { api_token: '', access_key: '', secret_key: '' }
  errors.value = {}
}

const validate = () => {
  errors.value = {}

  if (!provider.value) {
    errors.value.provider = 'Please select a provider'
  }
  if (!label.value.trim()) {
    errors.value.label = 'Label is required'
  }

  if (needsApiToken.value && !credentials.value.api_token.trim()) {
    errors.value.api_token = 'API token is required'
  }

  if (needsAwsCredentials.value) {
    if (!credentials.value.access_key.trim()) {
      errors.value.access_key = 'Access key is required'
    }
    if (!credentials.value.secret_key.trim()) {
      errors.value.secret_key = 'Secret key is required'
    }
  }

  return Object.keys(errors.value).length === 0
}

const onSubmit = async () => {
  if (!validate()) return

  isLoading.value = true

  try {
    const body: Record<string, string> = {
      provider: provider.value,
      label: label.value,
    }

    if (needsApiToken.value) {
      body.api_token = credentials.value.api_token
    }

    if (needsAwsCredentials.value) {
      body.access_key = credentials.value.access_key
      body.secret_key = credentials.value.secret_key
    }

    await $api('/dns-providers', {
      method: 'POST',
      body,
    })

    toast.success('DNS provider connected')
    emit('created')
    open.value = false
    resetForm()
  } catch (error: unknown) {
    const err = error as { data?: { message?: string; errors?: Record<string, string[]> } }
    if (err.data?.errors) {
      for (const [field, messages] of Object.entries(err.data.errors)) {
        errors.value[field] = messages[0]
      }
    } else {
      toast.error(err.data?.message || 'Failed to connect provider')
    }
  } finally {
    isLoading.value = false
  }
}

watch(open, (isOpen) => {
  if (!isOpen) resetForm()
})
</script>

<template>
  <Dialog v-model:open="open">
    <DialogTrigger as-child>
      <Button variant="outline" size="sm">
        <Icon name="lucide:plus" class="mr-1.5 h-4 w-4" />
        Connect
      </Button>
    </DialogTrigger>
    <DialogContent class="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>Connect DNS Provider</DialogTitle>
        <DialogDescription>
          Connect a DNS provider for automatic DNS management
        </DialogDescription>
      </DialogHeader>

      <form class="space-y-4" @submit.prevent="onSubmit">
        <div class="space-y-2">
          <Label>Provider</Label>
          <Select v-model="provider">
            <SelectTrigger>
              <SelectValue placeholder="Select a provider" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem v-for="p in providers" :key="p.value" :value="p.value">
                <div class="flex items-center gap-2">
                  <Icon :name="p.icon" class="h-4 w-4" />
                  {{ p.label }}
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
          <p v-if="errors.provider" class="text-sm text-destructive">{{ errors.provider }}</p>
        </div>

        <div class="space-y-2">
          <Label for="label">Label</Label>
          <Input
            id="label"
            v-model="label"
            placeholder="My Cloudflare Account"
          />
          <p v-if="errors.label" class="text-sm text-destructive">{{ errors.label }}</p>
        </div>

        <!-- API Token (for Cloudflare, DigitalOcean) -->
        <div v-if="needsApiToken" class="space-y-2">
          <Label for="api_token">API Token</Label>
          <Input
            id="api_token"
            v-model="credentials.api_token"
            type="password"
            placeholder="Enter your API token"
          />
          <p v-if="errors.api_token" class="text-sm text-destructive">{{ errors.api_token }}</p>
        </div>

        <!-- AWS Credentials (for Route 53) -->
        <template v-if="needsAwsCredentials">
          <div class="space-y-2">
            <Label for="access_key">Access Key ID</Label>
            <Input
              id="access_key"
              v-model="credentials.access_key"
              placeholder="AKIAIOSFODNN7EXAMPLE"
            />
            <p v-if="errors.access_key" class="text-sm text-destructive">{{ errors.access_key }}</p>
          </div>

          <div class="space-y-2">
            <Label for="secret_key">Secret Access Key</Label>
            <Input
              id="secret_key"
              v-model="credentials.secret_key"
              type="password"
              placeholder="Enter your secret key"
            />
            <p v-if="errors.secret_key" class="text-sm text-destructive">{{ errors.secret_key }}</p>
          </div>
        </template>

        <DialogFooter>
          <Button type="button" variant="outline" @click="open = false">
            Cancel
          </Button>
          <Button type="submit" :disabled="isLoading">
            <Icon v-if="isLoading" name="lucide:loader-2" class="mr-2 h-4 w-4 animate-spin" />
            Connect
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
</template>
