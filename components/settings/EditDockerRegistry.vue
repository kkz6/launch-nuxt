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
import { dockerRegistryService } from '~/services/dockerRegistryService'
import type { DockerRegistry } from '~/types'

interface Props {
  registry: DockerRegistry
}

const props = defineProps<Props>()
const emit = defineEmits<{ updated: [] }>()

const open = defineModel<boolean>('open', { default: false })
const isLoading = ref(false)
const errors = ref<Record<string, string>>({})

const form = reactive({
  name: props.registry.name,
  url: props.registry.url,
  username: props.registry.username,
  password: '',
})

watch(open, (isOpen) => {
  if (isOpen) {
    form.name = props.registry.name
    form.url = props.registry.url
    form.username = props.registry.username
    form.password = ''
    errors.value = {}
  }
})

const validate = () => {
  errors.value = {}
  if (!form.name.trim()) errors.value.name = 'Name is required'
  if (props.registry.type === 'generic' && !form.url.trim()) {
    errors.value.url = 'URL is required for generic registries'
  }
  return Object.keys(errors.value).length === 0
}

const submit = async () => {
  if (!validate()) return
  isLoading.value = true
  try {
    await dockerRegistryService.update(props.registry.id, {
      name: form.name,
      url: form.url || undefined,
      username: form.username || undefined,
      password: form.password || undefined,
    })
    toast.success('Docker registry updated')
    emit('updated')
    open.value = false
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to update docker registry'
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
        <DialogTitle>Edit docker registry</DialogTitle>
        <DialogDescription>
          Rotate credentials or rename. Type cannot be changed — delete and recreate to switch types.
        </DialogDescription>
      </DialogHeader>

      <form class="grid w-full gap-4" @submit.prevent="submit">
        <div class="space-y-2">
          <Label>Type</Label>
          <Input :model-value="props.registry.type_label" readonly disabled />
        </div>

        <div class="space-y-2">
          <Label for="dre-name">Name</Label>
          <Input id="dre-name" v-model="form.name" autocomplete="off" />
          <p v-if="errors.name" class="text-sm text-destructive">{{ errors.name }}</p>
        </div>

        <div class="space-y-2">
          <Label for="dre-url">Registry URL</Label>
          <Input id="dre-url" v-model="form.url" autocomplete="off" />
          <p v-if="errors.url" class="text-sm text-destructive">{{ errors.url }}</p>
        </div>

        <div class="space-y-2">
          <Label for="dre-username">Username</Label>
          <Input id="dre-username" v-model="form.username" autocomplete="off" />
        </div>

        <div class="space-y-2">
          <Label for="dre-password">New password / token</Label>
          <Input
            id="dre-password"
            v-model="form.password"
            type="password"
            placeholder="Leave blank to keep current"
            autocomplete="new-password"
          />
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" :disabled="isLoading" @click="open = false">
            Cancel
          </Button>
          <Button type="submit" :disabled="isLoading">
            <Icon v-if="isLoading" name="lucide:loader-2" class="mr-2 h-4 w-4 animate-spin" />
            Save changes
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
</template>
