<script setup lang="ts">
import { toast } from 'vue-sonner'
import { Eye, EyeOff } from 'lucide-vue-next'
import { Button } from '~/components/ui/button'
import { Toggle } from '~/components/ui/toggle'

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
const selectedFileIndex = ref<number | null>(null)
const contents = ref('')
const isLoading = ref(true)
const isFetching = ref(false)
const isUpdating = ref(false)
const isVisible = ref(true)
const confirmationDialog = ref<InstanceType<typeof import('~/components/shared/ConfirmationDialog.vue').default> | null>(null)

const selectedFile = computed(() => {
  if (selectedFileIndex.value === null) return null
  return files.value[selectedFileIndex.value]
})

const selectFile = (index: number) => {
  if (selectedFileIndex.value === index) {
    selectedFileIndex.value = null
    contents.value = ''
  } else {
    selectedFileIndex.value = index
  }
}

const getFileIcon = (fileName: string) => {
  const name = fileName.toLowerCase()
  if (name.includes('nginx') || name.includes('vhost')) return 'lucide:server'
  if (name.includes('env')) return 'lucide:file-key'
  if (name.includes('deploy') || name.includes('script')) return 'lucide:file-code'
  if (name.includes('php')) return 'lucide:file-code-2'
  if (name.includes('supervisor') || name.includes('worker')) return 'lucide:cpu'
  return 'lucide:file-text'
}

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
  if (newVal !== null) {
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

    <div class="mb-4">
      <h3 class="text-lg font-semibold">Files</h3>
      <p class="text-sm text-muted-foreground">View and edit site configuration files</p>
    </div>

    <div v-if="isLoading" class="flex items-center justify-center py-8">
      <Icon name="lucide:loader-2" class="h-6 w-6 animate-spin text-muted-foreground" />
    </div>

    <template v-else>
      <!-- File List -->
      <div class="space-y-3">
        <div
          v-for="(file, index) in files"
          :key="index"
          class="rounded-lg border bg-card overflow-hidden"
        >
          <!-- File Header (always visible) -->
          <button
            type="button"
            class="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50"
            :class="{ 'bg-muted/30': selectedFileIndex === index }"
            @click="selectFile(index)"
          >
            <div class="flex h-9 w-9 items-center justify-center rounded-md bg-muted">
              <Icon :name="getFileIcon(file.name)" class="h-4 w-4 text-muted-foreground" />
            </div>
            <div class="flex-1 min-w-0">
              <p class="font-medium truncate">{{ file.name }}</p>
              <p v-if="file.description" class="text-sm text-muted-foreground truncate">
                {{ file.description }}
              </p>
            </div>
            <Icon
              name="lucide:chevron-down"
              class="h-4 w-4 text-muted-foreground transition-transform"
              :class="{ 'rotate-180': selectedFileIndex === index }"
            />
          </button>

          <!-- File Content (expandable) -->
          <div v-if="selectedFileIndex === index" class="border-t">
            <div v-if="isFetching" class="flex items-center justify-center py-8">
              <Icon name="lucide:loader-2" class="mr-2 h-5 w-5 animate-spin" />
              <span class="text-sm text-muted-foreground">Loading file contents...</span>
            </div>

            <div v-else-if="isUpdating" class="flex items-center justify-center py-8">
              <Icon name="lucide:loader-2" class="mr-2 h-5 w-5 animate-spin" />
              <span class="text-sm text-muted-foreground">Updating file...</span>
            </div>

            <template v-else>
              <div class="flex items-center justify-end border-b px-4 py-2">
                <Toggle
                  :pressed="!isVisible"
                  aria-label="Toggle visibility"
                  size="sm"
                  @click="isVisible = !isVisible"
                >
                  <EyeOff v-if="isVisible" class="h-4 w-4" />
                  <Eye v-else class="h-4 w-4" />
                  <span class="ml-2 text-sm">{{ isVisible ? 'Show' : 'Hide' }}</span>
                </Toggle>
              </div>

              <div class="p-4 space-y-4">
                <SharedCodeEditor
                  :model-value="contents ?? ''"
                  :disabled="isVisible"
                  :masked="isVisible"
                  class="h-80"
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

        <!-- Empty State -->
        <div v-if="files.length === 0" class="rounded-lg border bg-card p-8 text-center">
          <Icon name="lucide:file-x" class="mx-auto h-10 w-10 text-muted-foreground" />
          <p class="mt-2 text-sm text-muted-foreground">No configuration files available</p>
        </div>
      </div>
    </template>
  </div>
</template>
