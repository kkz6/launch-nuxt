<script setup lang="ts">
import { toast } from 'vue-sonner'
import { Eye, EyeOff } from 'lucide-vue-next'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/card'
import { Button } from '~/components/ui/button'
import { Label } from '~/components/ui/label'
import { Textarea } from '~/components/ui/textarea'
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
    const data = await $api<{ contents: string }>(selectedFile.value.show_route)
    contents.value = data.contents
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
    const response = await $api<{ message: string }>(selectedFile.value.update_route, {
      method: 'PATCH',
      body: { contents: contents.value },
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
  <Card class="bg-background">
    <SharedConfirmationDialog ref="confirmationDialog" />
    <CardHeader>
      <CardTitle class="text-xl">Files</CardTitle>
      <CardDescription>View and edit site configuration files</CardDescription>
    </CardHeader>

    <CardContent class="flex flex-col gap-4">
      <div v-if="isLoading" class="flex items-center justify-center py-8">
        <Icon name="lucide:loader-2" class="h-6 w-6 animate-spin text-muted-foreground" />
      </div>

      <template v-else>
        <div class="space-y-2">
          <Label>Select File</Label>
          <Select v-model="selectedFileIndex">
            <SelectTrigger class="w-full">
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

        <Card v-if="selectedFile" class="bg-background">
          <div v-if="isFetching" class="flex items-center justify-center py-8">
            <Icon name="lucide:loader-2" class="mr-2 h-5 w-5 animate-spin" />
            <span>Loading file contents...</span>
          </div>

          <div v-else-if="isUpdating" class="flex items-center justify-center py-8">
            <Icon name="lucide:loader-2" class="mr-2 h-5 w-5 animate-spin" />
            <span>Updating file...</span>
          </div>

          <template v-else>
            <CardHeader class="flex flex-row items-center justify-between">
              <div>
                <CardTitle class="text-xl">{{ selectedFile.name }}</CardTitle>
                <CardDescription v-if="selectedFile.description">
                  {{ selectedFile.description }}
                </CardDescription>
              </div>

              <Toggle
                :pressed="!isVisible"
                aria-label="Toggle visibility"
                @update:pressed="isVisible = !$event"
              >
                <EyeOff v-if="!isVisible" class="h-4 w-4 text-muted-foreground" />
                <Eye v-else class="h-4 w-4 text-muted-foreground" />
              </Toggle>
            </CardHeader>

            <CardContent class="w-full space-y-4">
              <div class="relative">
                <Textarea
                  v-model="contents"
                  :disabled="isVisible"
                  class="h-96 resize-none font-mono text-sm"
                  :class="{ 'blur-sm select-none': isVisible }"
                  placeholder="File contents will appear here..."
                />
                <div
                  v-if="isVisible"
                  class="absolute inset-0 flex cursor-pointer items-center justify-center rounded-md bg-background/50"
                  @click="isVisible = false"
                >
                  <span class="text-sm text-muted-foreground">Click to reveal and edit</span>
                </div>
              </div>

              <div class="flex justify-end">
                <Button :disabled="isVisible || isUpdating" @click="saveFile">
                  <Icon v-if="isUpdating" name="lucide:loader-2" class="mr-2 h-4 w-4 animate-spin" />
                  Save Changes
                </Button>
              </div>
            </CardContent>
          </template>
        </Card>
      </template>
    </CardContent>
  </Card>
</template>
