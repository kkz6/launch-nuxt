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
import { serverService } from '~/services/serverService'
import type { DockerServiceKind } from '~/types'

interface Props {
  serverId: string
  // Kinds already installed on this server — disabled in the picker.
  installedKinds?: DockerServiceKind[]
}

const props = withDefaults(defineProps<Props>(), {
  installedKinds: () => [],
})
const emit = defineEmits<{ created: [] }>()

const open = defineModel<boolean>('open', { default: false })
const isSubmitting = ref(false)

const allKinds: { value: DockerServiceKind; label: string; default_image: string }[] = [
  { value: 'postgres', label: 'PostgreSQL', default_image: 'postgres:16' },
  { value: 'mysql', label: 'MySQL', default_image: 'mysql:8.0' },
  { value: 'redis', label: 'Redis', default_image: 'redis:7-alpine' },
]

const availableKinds = computed(() =>
  allKinds.filter((k) => !props.installedKinds.includes(k.value)),
)

const form = reactive({
  kind: '' as DockerServiceKind | '',
  image: '',
  username: '',
  password: '',
  database_name: '',
})

const requiresDatabaseName = computed(
  () => form.kind === 'postgres' || form.kind === 'mysql',
)

watch(
  () => form.kind,
  (kind) => {
    const meta = allKinds.find((k) => k.value === kind)
    form.image = meta?.default_image ?? ''
  },
)

watch(open, (isOpen) => {
  if (isOpen) {
    const first = availableKinds.value[0]
    form.kind = first?.value ?? ('' as DockerServiceKind | '')
    form.image = first?.default_image ?? ''
    form.username = ''
    form.password = ''
    form.database_name = ''
  }
})

const submit = async () => {
  if (!form.kind) {
    toast.error('Pick a kind')
    return
  }
  isSubmitting.value = true
  try {
    await serverService.dockerServices.install(props.serverId, {
      kind: form.kind,
      image: form.image || undefined,
      username: form.username || undefined,
      password: form.password || undefined,
      database_name: form.database_name || undefined,
    })
    toast.success('Docker service installation started')
    open.value = false
    emit('created')
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to install docker service'
    toast.error(message)
  } finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="sm:max-w-lg">
      <DialogHeader>
        <DialogTitle>Install docker service</DialogTitle>
        <DialogDescription>
          Run a managed Postgres, MySQL, or Redis container on this Docker server.
        </DialogDescription>
      </DialogHeader>

      <form class="grid w-full gap-4" @submit.prevent="submit">
        <div class="space-y-2">
          <Label for="ds-kind">Kind</Label>
          <Select v-model="form.kind">
            <SelectTrigger id="ds-kind">
              <SelectValue placeholder="Select kind" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem
                v-for="k in availableKinds"
                :key="k.value"
                :value="k.value"
              >
                {{ k.label }}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div class="space-y-2">
          <Label for="ds-image">Image (optional)</Label>
          <Input
            id="ds-image"
            v-model="form.image"
            placeholder="postgres:16"
            autocomplete="off"
          />
          <p class="text-xs text-muted-foreground">
            Leave default to use the platform-supported version.
          </p>
        </div>

        <div v-if="requiresDatabaseName" class="space-y-2">
          <Label for="ds-database">Initial database name</Label>
          <Input
            id="ds-database"
            v-model="form.database_name"
            placeholder="appdb"
            autocomplete="off"
          />
        </div>

        <div v-if="requiresDatabaseName" class="space-y-2">
          <Label for="ds-username">Admin username</Label>
          <Input
            id="ds-username"
            v-model="form.username"
            placeholder="launch"
            autocomplete="off"
          />
        </div>

        <div class="space-y-2">
          <Label for="ds-password">
            {{ form.kind === 'redis' ? 'AUTH password' : 'Admin password' }}
          </Label>
          <Input
            id="ds-password"
            v-model="form.password"
            type="password"
            placeholder="Auto-generated if blank"
            autocomplete="new-password"
          />
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            :disabled="isSubmitting"
            @click="open = false"
          >
            Cancel
          </Button>
          <Button type="submit" :disabled="isSubmitting || !form.kind">
            <Icon v-if="isSubmitting" name="lucide:loader-2" class="mr-2 h-4 w-4 animate-spin" />
            Install
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
</template>
