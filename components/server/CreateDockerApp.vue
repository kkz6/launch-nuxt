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
import { dockerAppService } from '~/services/dockerAppService'
import { dockerRegistryService } from '~/services/dockerRegistryService'
import type { DockerAppRestartPolicy, DockerRegistry } from '~/types'

interface Props {
  serverId: string
}

const props = defineProps<Props>()
const emit = defineEmits<{ created: [] }>()

const open = defineModel<boolean>('open', { default: false })
const isLoading = ref(false)
const errors = ref<Record<string, string>>({})

const registries = ref<DockerRegistry[]>([])
const isRegistriesLoading = ref(false)

const restartPolicies: { value: DockerAppRestartPolicy; label: string }[] = [
  { value: 'unless-stopped', label: 'Unless stopped' },
  { value: 'always', label: 'Always' },
  { value: 'on-failure', label: 'On failure' },
  { value: 'no', label: 'No' },
]

const PUBLIC_REGISTRY = '__public__'

const form = reactive({
  name: '',
  image: '',
  tag: 'latest',
  registry_credential_id: PUBLIC_REGISTRY as string,
  restart_policy: 'unless-stopped' as DockerAppRestartPolicy,
})

const fetchRegistries = async () => {
  isRegistriesLoading.value = true
  try {
    const res = await dockerRegistryService.list()
    registries.value = res.data ?? []
  } catch {
    // Quiet — public images still work without registries.
  } finally {
    isRegistriesLoading.value = false
  }
}

watch(open, (isOpen) => {
  if (isOpen) {
    form.name = ''
    form.image = ''
    form.tag = 'latest'
    form.registry_credential_id = PUBLIC_REGISTRY
    form.restart_policy = 'unless-stopped'
    errors.value = {}
    fetchRegistries()
  }
})

const validate = () => {
  errors.value = {}
  if (!/^[a-z0-9][a-z0-9_-]{0,62}$/.test(form.name)) {
    errors.value.name = 'Lowercase letters, numbers, dashes and underscores; max 63 chars'
  }
  if (!form.image.trim()) errors.value.image = 'Image is required'
  return Object.keys(errors.value).length === 0
}

const submit = async () => {
  if (!validate()) return
  isLoading.value = true
  try {
    await dockerAppService.create(props.serverId, {
      name: form.name,
      image: form.image,
      tag: form.tag || undefined,
      registry_credential_id:
        form.registry_credential_id === PUBLIC_REGISTRY
          ? undefined
          : form.registry_credential_id,
      restart_policy: form.restart_policy,
    })
    toast.success('Application will be deployed shortly')
    emit('created')
    open.value = false
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to create application'
    toast.error(message)
  } finally {
    isLoading.value = false
  }
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="sm:max-w-lg">
      <DialogHeader>
        <DialogTitle>Add application</DialogTitle>
        <DialogDescription>
          Pull a docker image and run it on this server. You can configure env vars, volumes, and domains after the first deploy.
        </DialogDescription>
      </DialogHeader>

      <form class="grid w-full gap-4" @submit.prevent="submit">
        <div class="space-y-2">
          <Label for="da-name">Name</Label>
          <Input id="da-name" v-model="form.name" placeholder="my-app" autocomplete="off" />
          <p v-if="errors.name" class="text-sm text-destructive">{{ errors.name }}</p>
          <p class="text-xs text-muted-foreground">Used as the container name (launch-app-&lt;your-name&gt;).</p>
        </div>

        <div class="grid grid-cols-3 gap-2">
          <div class="col-span-2 space-y-2">
            <Label for="da-image">Image</Label>
            <Input id="da-image" v-model="form.image" placeholder="ghcr.io/acme/web" autocomplete="off" />
            <p v-if="errors.image" class="text-sm text-destructive">{{ errors.image }}</p>
          </div>
          <div class="space-y-2">
            <Label for="da-tag">Tag</Label>
            <Input id="da-tag" v-model="form.tag" placeholder="latest" autocomplete="off" />
          </div>
        </div>

        <div class="space-y-2">
          <Label for="da-registry">Registry credential</Label>
          <Select v-model="form.registry_credential_id">
            <SelectTrigger id="da-registry">
              <SelectValue placeholder="Select credential" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem :value="PUBLIC_REGISTRY">
                Public (no auth)
              </SelectItem>
              <SelectItem v-for="r in registries" :key="r.id" :value="r.id">
                {{ r.name }} ({{ r.type_label }})
              </SelectItem>
            </SelectContent>
          </Select>
          <p class="text-xs text-muted-foreground">
            Add private registry credentials under Settings → Connections.
          </p>
        </div>

        <div class="space-y-2">
          <Label for="da-restart">Restart policy</Label>
          <Select v-model="form.restart_policy">
            <SelectTrigger id="da-restart">
              <SelectValue placeholder="Select policy" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem v-for="p in restartPolicies" :key="p.value" :value="p.value">
                {{ p.label }}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" :disabled="isLoading" @click="open = false">
            Cancel
          </Button>
          <Button type="submit" :disabled="isLoading">
            <Icon v-if="isLoading" name="lucide:loader-2" class="mr-2 h-4 w-4 animate-spin" />
            Create &amp; deploy
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
</template>
