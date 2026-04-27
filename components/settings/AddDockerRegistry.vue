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
import { dockerRegistryService } from '~/services/dockerRegistryService'
import type { DockerRegistryType } from '~/types'

const emit = defineEmits<{ created: [] }>()

const open = ref(false)
const isLoading = ref(false)

const types: { value: DockerRegistryType; label: string; defaultURL: string; icon: string }[] = [
  { value: 'docker_hub', label: 'Docker Hub', defaultURL: 'https://index.docker.io/v1/', icon: 'simple-icons:docker' },
  { value: 'ghcr', label: 'GitHub Container Registry', defaultURL: 'ghcr.io', icon: 'simple-icons:github' },
  { value: 'generic', label: 'Generic Registry', defaultURL: '', icon: 'lucide:database' },
]

const form = reactive({
  name: '',
  type: 'docker_hub' as DockerRegistryType,
  url: 'https://index.docker.io/v1/',
  username: '',
  password: '',
})
const errors = ref<Record<string, string>>({})

watch(open, (isOpen) => {
  if (isOpen) {
    form.name = ''
    form.type = 'docker_hub'
    form.url = 'https://index.docker.io/v1/'
    form.username = ''
    form.password = ''
    errors.value = {}
  }
})

watch(
  () => form.type,
  (newType) => {
    const matched = types.find((t) => t.value === newType)
    if (!matched) return
    const stockURLs = types.map((t) => t.defaultURL).filter(Boolean)
    if (form.url === '' || stockURLs.includes(form.url)) {
      form.url = matched.defaultURL
    }
  },
)

const validate = () => {
  errors.value = {}
  if (!form.name.trim()) errors.value.name = 'Name is required'
  if (form.type === 'generic' && !form.url.trim()) errors.value.url = 'URL is required for generic registries'
  if (!form.username.trim()) errors.value.username = 'Username is required'
  if (!form.password.trim()) errors.value.password = 'Password is required'
  return Object.keys(errors.value).length === 0
}

const submit = async () => {
  if (!validate()) return
  isLoading.value = true
  try {
    await dockerRegistryService.create({
      name: form.name,
      type: form.type,
      url: form.url || undefined,
      username: form.username,
      password: form.password,
    })
    toast.success('Docker registry created')
    emit('created')
    open.value = false
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to save docker registry'
    toast.error(message)
  } finally {
    isLoading.value = false
  }
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogTrigger as-child>
      <Button variant="outline">
        <Icon name="lucide:plus" class="mr-2 h-4 w-4" />
        Add Docker Registry
      </Button>
    </DialogTrigger>

    <DialogContent class="sm:max-w-lg">
      <DialogHeader>
        <DialogTitle>Add docker registry</DialogTitle>
        <DialogDescription>
          Save credentials for a private registry so applications can pull images at deploy time.
        </DialogDescription>
      </DialogHeader>

      <form class="grid w-full gap-4" @submit.prevent="submit">
        <div class="space-y-2">
          <Label for="dr-name">Name</Label>
          <Input id="dr-name" v-model="form.name" placeholder="Acme GHCR" autocomplete="off" />
          <p v-if="errors.name" class="text-sm text-destructive">{{ errors.name }}</p>
        </div>

        <div class="space-y-2">
          <Label for="dr-type">Type</Label>
          <Select v-model="form.type">
            <SelectTrigger id="dr-type">
              <SelectValue placeholder="Select type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem v-for="t in types" :key="t.value" :value="t.value">
                <span class="flex items-center gap-2">
                  <Icon :name="t.icon" class="h-4 w-4" />
                  {{ t.label }}
                </span>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div class="space-y-2">
          <Label for="dr-url">Registry URL</Label>
          <Input
            id="dr-url"
            v-model="form.url"
            :placeholder="form.type === 'generic' ? 'registry.example.com' : ''"
            autocomplete="off"
          />
          <p v-if="errors.url" class="text-sm text-destructive">{{ errors.url }}</p>
        </div>

        <div class="space-y-2">
          <Label for="dr-username">Username</Label>
          <Input id="dr-username" v-model="form.username" placeholder="username or robot account" autocomplete="off" />
          <p v-if="errors.username" class="text-sm text-destructive">{{ errors.username }}</p>
        </div>

        <div class="space-y-2">
          <Label for="dr-password">Password / token</Label>
          <Input
            id="dr-password"
            v-model="form.password"
            type="password"
            placeholder="PAT for ghcr, password for hub"
            autocomplete="new-password"
          />
          <p v-if="errors.password" class="text-sm text-destructive">{{ errors.password }}</p>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" :disabled="isLoading" @click="open = false">
            Cancel
          </Button>
          <Button type="submit" :disabled="isLoading">
            <Icon v-if="isLoading" name="lucide:loader-2" class="mr-2 h-4 w-4 animate-spin" />
            Create
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
</template>
