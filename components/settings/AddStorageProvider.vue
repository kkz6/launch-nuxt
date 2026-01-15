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
  access_key: '',
  secret_key: '',
  bucket: '',
  region: '',
  endpoint: '',
})
const errors = ref<Record<string, string>>({})

const providers = [
  { value: 's3', label: 'Amazon S3', icon: 'simple-icons:amazons3' },
  { value: 'spaces', label: 'DigitalOcean Spaces', icon: 'simple-icons:digitalocean' },
  { value: 'backblaze', label: 'Backblaze B2', icon: 'simple-icons:backblaze' },
  { value: 'wasabi', label: 'Wasabi', icon: 'lucide:database' },
]

const s3Regions = [
  { value: 'us-east-1', label: 'US East (N. Virginia)' },
  { value: 'us-east-2', label: 'US East (Ohio)' },
  { value: 'us-west-1', label: 'US West (N. California)' },
  { value: 'us-west-2', label: 'US West (Oregon)' },
  { value: 'eu-west-1', label: 'EU (Ireland)' },
  { value: 'eu-west-2', label: 'EU (London)' },
  { value: 'eu-central-1', label: 'EU (Frankfurt)' },
  { value: 'ap-southeast-1', label: 'Asia Pacific (Singapore)' },
  { value: 'ap-southeast-2', label: 'Asia Pacific (Sydney)' },
  { value: 'ap-northeast-1', label: 'Asia Pacific (Tokyo)' },
]

const spacesRegions = [
  { value: 'nyc3', label: 'New York 3' },
  { value: 'sfo3', label: 'San Francisco 3' },
  { value: 'ams3', label: 'Amsterdam 3' },
  { value: 'sgp1', label: 'Singapore 1' },
  { value: 'fra1', label: 'Frankfurt 1' },
]

const currentRegions = computed(() => {
  if (provider.value === 's3') return s3Regions
  if (provider.value === 'spaces') return spacesRegions
  return []
})

const showRegion = computed(() => ['s3', 'spaces'].includes(provider.value))
const showEndpoint = computed(() => ['backblaze', 'wasabi'].includes(provider.value))

const resetForm = () => {
  provider.value = ''
  label.value = ''
  credentials.value = { access_key: '', secret_key: '', bucket: '', region: '', endpoint: '' }
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
  if (!credentials.value.access_key.trim()) {
    errors.value.access_key = 'Access key is required'
  }
  if (!credentials.value.secret_key.trim()) {
    errors.value.secret_key = 'Secret key is required'
  }
  if (!credentials.value.bucket.trim()) {
    errors.value.bucket = 'Bucket name is required'
  }
  if (showRegion.value && !credentials.value.region) {
    errors.value.region = 'Region is required'
  }
  if (showEndpoint.value && !credentials.value.endpoint.trim()) {
    errors.value.endpoint = 'Endpoint is required'
  }

  return Object.keys(errors.value).length === 0
}

const onSubmit = async () => {
  if (!validate()) return

  isLoading.value = true

  try {
    await $api('/storage-providers', {
      method: 'POST',
      body: {
        provider: provider.value,
        label: label.value,
        access_key: credentials.value.access_key,
        secret_key: credentials.value.secret_key,
        bucket: credentials.value.bucket,
        region: credentials.value.region || undefined,
        endpoint: credentials.value.endpoint || undefined,
      },
    })

    toast.success('Storage provider connected')
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
        <DialogTitle>Connect Storage Provider</DialogTitle>
        <DialogDescription>
          Connect a storage provider for backups and file storage
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
            placeholder="My S3 Bucket"
          />
          <p v-if="errors.label" class="text-sm text-destructive">{{ errors.label }}</p>
        </div>

        <div class="space-y-2">
          <Label for="access_key">Access Key</Label>
          <Input
            id="access_key"
            v-model="credentials.access_key"
            placeholder="Enter access key"
          />
          <p v-if="errors.access_key" class="text-sm text-destructive">{{ errors.access_key }}</p>
        </div>

        <div class="space-y-2">
          <Label for="secret_key">Secret Key</Label>
          <Input
            id="secret_key"
            v-model="credentials.secret_key"
            type="password"
            placeholder="Enter secret key"
          />
          <p v-if="errors.secret_key" class="text-sm text-destructive">{{ errors.secret_key }}</p>
        </div>

        <div class="space-y-2">
          <Label for="bucket">Bucket Name</Label>
          <Input
            id="bucket"
            v-model="credentials.bucket"
            placeholder="my-bucket"
          />
          <p v-if="errors.bucket" class="text-sm text-destructive">{{ errors.bucket }}</p>
        </div>

        <div v-if="showRegion" class="space-y-2">
          <Label>Region</Label>
          <Select v-model="credentials.region">
            <SelectTrigger>
              <SelectValue placeholder="Select a region" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem v-for="r in currentRegions" :key="r.value" :value="r.value">
                {{ r.label }}
              </SelectItem>
            </SelectContent>
          </Select>
          <p v-if="errors.region" class="text-sm text-destructive">{{ errors.region }}</p>
        </div>

        <div v-if="showEndpoint" class="space-y-2">
          <Label for="endpoint">Endpoint URL</Label>
          <Input
            id="endpoint"
            v-model="credentials.endpoint"
            placeholder="https://s3.us-west-001.backblazeb2.com"
          />
          <p v-if="errors.endpoint" class="text-sm text-destructive">{{ errors.endpoint }}</p>
        </div>

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
