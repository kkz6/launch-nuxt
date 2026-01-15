<script setup lang="ts">
import { toast } from 'vue-sonner'
import { Eye, EyeOff } from 'lucide-vue-next'
import { Button } from '~/components/ui/button'
import { Label } from '~/components/ui/label'
import { Toggle } from '~/components/ui/toggle'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select'

interface FileInfo {
  name: string
  description?: string
  show_route: string
  update_route: string
}

interface Props {
  serverId: string
  siteId: string
}

const props = defineProps<Props>()

const files = ref<FileInfo[]>([])
const selectedFileIndex = ref<string>('')
const contents = ref('')
const isLoading = ref(true)
const isFetching = ref(false)
const isUpdating = ref(false)
const isVisible = ref(true)
const confirmationDialog = ref<InstanceType<typeof import('~/components/shared/ConfirmationDialog.vue').default> | null>(null)

const selectedFile = computed(() => {
  if (selectedFileIndex.value === '') return null
  return files.value[Number(selectedFileIndex.value)]
})

const fetchFiles = async () => {
  isLoading.value = true
  try {
    const data = await $api<{ data: FileInfo[] }>(`/servers/${props.serverId}/sites/${props.siteId}/files`)
    files.value = data.data
  } catch {
    toast.error('Failed to load files')
  } finally {
    isLoading.value = false
  }
}

const fetchFileContents = async () => {
  if (!selectedFile.value) return

  isFetching.value = true
  try {
    const response = await $api<{ data: { content: string, path: string } }>(`/servers/${props.serverId}/sites/${props.siteId}/files/${selectedFile.value.show_route}`)
    contents.value = response.data.content || ''
  } catch {
    toast.error('Failed to load file contents')
  } finally {
    isFetching.value = false
  }
}

const saveFile = async () => {
  if (!selectedFile.value || !confirmationDialog.value) return

  const result = await confirmationDialog.value.show({
    title: `Update ${selectedFile.value.name}`,
    description: 'Are you sure you want to update this file? This action will overwrite the current file contents.',
    confirmText: 'Update',
    cancelText: 'Cancel',
  })

  if (!result.ok) {
    toast.info('Cancelled')
    return
  }

  isUpdating.value = true
  try {
    const response = await $api<{ message: string }>(`/servers/${props.serverId}/sites/${props.siteId}/files/${selectedFile.value.update_route}`, {
      method: 'PATCH',
      body: { content: contents.value },
    })
    toast.success(response.message || 'File updated successfully')
  } catch (error: unknown) {
    const err = error as { data?: { message?: string } }
    toast.error(err.data?.message || 'Failed to update file')
  } finally {
    isUpdating.value = false
  }
}

watch(selectedFileIndex, (newVal) => {
  if (newVal !== '') {
    contents.value = ''
    isVisible.value = true
    fetchFileContents()
  }
})

onMounted(fetchFiles)
</script>

<template>
  <div>
    <SharedConfirmationDialog ref="confirmationDialog" />

    <div class="mb-4 flex items-start justify-between gap-4">
      <div>
        <h3 class="text-lg font-semibold">Files</h3>
        <p class="text-sm text-muted-foreground">View and edit site configuration files</p>
      </div>
    </div>

    <div v-if="isLoading" class="flex items-center justify-center py-8">
      <Icon name="lucide:loader-2" class="h-6 w-6 animate-spin text-muted-foreground" />
    </div>

    <template v-else>
      <div class="space-y-4">
        <div class="space-y-2">
          <Label>Select File</Label>
          <Select v-model="selectedFileIndex">
            <SelectTrigger class="w-full max-w-sm">
              <SelectValue placeholder="Select a file to edit" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem
                v-for="(file, index) in files"
                :key="index"
                :value="String(index)"
              >
                {{ file.name }}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div v-if="selectedFile" class="rounded-lg border bg-card">
          <div v-if="isFetching" class="flex items-center justify-center py-8">
            <Icon name="lucide:loader-2" class="mr-2 h-5 w-5 animate-spin" />
            <span>Loading file contents...</span>
          </div>

          <div v-else-if="isUpdating" class="flex items-center justify-center py-8">
            <Icon name="lucide:loader-2" class="mr-2 h-5 w-5 animate-spin" />
            <span>Updating file...</span>
          </div>

          <template v-else>
            <div class="flex items-center justify-between border-b px-4 py-3">
              <div>
                <h4 class="font-medium">{{ selectedFile.name }}</h4>
                <p v-if="selectedFile.description" class="text-sm text-muted-foreground">
                  {{ selectedFile.description }}
                </p>
              </div>

              <Toggle
                :pressed="!isVisible"
                aria-label="Toggle visibility"
                @click="isVisible = !isVisible"
              >
                <EyeOff v-if="isVisible" class="h-4 w-4 text-muted-foreground" />
                <Eye v-else class="h-4 w-4 text-muted-foreground" />
              </Toggle>
            </div>

            <div class="space-y-4 p-4">
              <SharedCodeEditor
                :model-value="contents ?? ''"
                :disabled="isVisible"
                :masked="isVisible"
                class="h-96"
                @update:model-value="contents = $event"
              />

              <div class="flex justify-end">
                <Button :disabled="isVisible || isUpdating" @click="saveFile">
                  <Icon v-if="isUpdating" name="lucide:loader-2" class="mr-2 h-4 w-4 animate-spin" />
                  Save Changes
                </Button>
              </div>
            </div>
          </template>
        </div>
      </div>
    </template>
  </div>
</template>
