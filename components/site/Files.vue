<script setup lang="ts">
import { toast } from 'vue-sonner'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/card'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'

interface FileEntry {
  name: string
  path: string
  type: 'file' | 'directory'
  size: number
  modified: string
  permissions: string
}

interface Props {
  serverId: string
  siteId: string
}

const props = defineProps<Props>()

const files = ref<FileEntry[]>([])
const currentPath = ref('')
const isLoading = ref(true)
const pathHistory = ref<string[]>([])

const fetchFiles = async (path: string = '') => {
  isLoading.value = true
  try {
    const data = await $api<{ data: FileEntry[]; path: string }>(`/servers/${props.serverId}/sites/${props.siteId}/files`, {
      params: { path },
    })
    files.value = data.data
    currentPath.value = data.path
  } catch {
    toast.error('Failed to load files')
  } finally {
    isLoading.value = false
  }
}

const navigateTo = (path: string) => {
  pathHistory.value.push(currentPath.value)
  fetchFiles(path)
}

const goBack = () => {
  const previousPath = pathHistory.value.pop()
  if (previousPath !== undefined) {
    fetchFiles(previousPath)
  }
}

const formatSize = (bytes: number): string => {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

onMounted(() => fetchFiles())
</script>

<template>
  <Card class="bg-background">
    <CardHeader>
      <CardTitle class="text-xl">Files</CardTitle>
      <CardDescription>Browse and manage site files</CardDescription>
    </CardHeader>
    <CardContent>
      <div class="mb-4 flex items-center gap-2">
        <Button variant="outline" size="sm" :disabled="pathHistory.length === 0" @click="goBack">
          <Icon name="lucide:arrow-left" class="h-4 w-4" />
        </Button>
        <div class="flex-1">
          <Input :model-value="currentPath" readonly class="font-mono text-sm" />
        </div>
        <Button variant="outline" size="sm" @click="() => fetchFiles(currentPath)">
          <Icon name="lucide:refresh-cw" class="h-4 w-4" />
        </Button>
      </div>

      <div v-if="isLoading" class="flex items-center justify-center py-8">
        <Icon name="lucide:loader-2" class="h-6 w-6 animate-spin text-muted-foreground" />
      </div>

      <div v-else-if="files.length === 0" class="flex flex-col items-center justify-center py-8 text-muted-foreground">
        <Icon name="lucide:folder-open" class="mb-2 h-8 w-8" />
        <span>Empty directory</span>
      </div>

      <div v-else class="rounded-md border">
        <div class="grid grid-cols-12 gap-4 border-b bg-muted/50 px-4 py-2 text-sm font-medium text-muted-foreground">
          <div class="col-span-6">Name</div>
          <div class="col-span-2">Size</div>
          <div class="col-span-2">Modified</div>
          <div class="col-span-2">Permissions</div>
        </div>
        <div
          v-for="file in files"
          :key="file.path"
          class="grid cursor-pointer grid-cols-12 gap-4 border-b px-4 py-2 text-sm hover:bg-muted/50 last:border-b-0"
          @click="file.type === 'directory' ? navigateTo(file.path) : null"
        >
          <div class="col-span-6 flex items-center gap-2">
            <Icon
              :name="file.type === 'directory' ? 'lucide:folder' : 'lucide:file'"
              class="h-4 w-4 text-muted-foreground"
            />
            <span :class="{ 'font-medium': file.type === 'directory' }">{{ file.name }}</span>
          </div>
          <div class="col-span-2 text-muted-foreground">
            {{ file.type === 'file' ? formatSize(file.size) : '-' }}
          </div>
          <div class="col-span-2 text-muted-foreground">
            <SharedDateTooltip :date="file.modified" />
          </div>
          <div class="col-span-2 font-mono text-muted-foreground">{{ file.permissions }}</div>
        </div>
      </div>
    </CardContent>
  </Card>
</template>
